import uuid
from copy import deepcopy
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import (
    Document,
    DocumentContent,
    DocumentFavorite,
    DocumentPermission,
    DocumentPermissionSettings,
    DocumentVersion,
)
from app.models.folder import Folder
from app.models.organization import OrganizationMember
from app.models.space import Space
from app.models.user import User
from app.schemas.folder import AncestorItem
from app.services.comment_service import sync_comment_threads_with_content
from app.services.folder_service import (
    ensure_parent_folder_valid,
    get_document_ancestors as get_document_folder_ancestors,
    get_next_document_sort_order,
)
from app.services.event_stream_service import publish_document_event
from app.services.permission_service import (
    ROLE_RANK,
    can_comment_document as permission_can_comment_document,
    can_copy_document as permission_can_copy_document,
    can_delete_document as permission_can_delete_document,
    can_edit_document as permission_can_edit_document,
    can_export_document as permission_can_export_document,
    can_share_document as permission_can_share_document,
    can_transfer_document_owner as permission_can_transfer_document_owner,
    can_manage_document as permission_can_manage_document,
    can_manage_space,
    can_mcp_read_document,
    can_view_document as permission_can_view_document,
    get_effective_document_role,
    normalize_permission_level,
    role_at_least,
    setting_allows,
)
from app.schemas.document import (
    DocumentContentPayload,
    DocumentContentUpdateRequest,
    DocumentCreateRequest,
    DocumentDetail,
    FavoriteStatusResponse,
    DocumentSummary,
    LinkPreviewResponse,
    SearchResult,
)

SUPPORTED_DOCUMENT_TYPES = {"doc", "pdf"}


class MetadataHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.in_title = False
        self.meta: dict[str, str] = {}
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key.lower(): value or "" for key, value in attrs}
        tag = tag.lower()
        if tag == "title":
            self.in_title = True
            return
        if tag == "meta":
            key = attrs_dict.get("property") or attrs_dict.get("name")
            content = attrs_dict.get("content", "").strip()
            if key and content:
                self.meta[key.lower()] = content
            return
        if tag == "link":
            rel = attrs_dict.get("rel", "").lower()
            href = attrs_dict.get("href", "").strip()
            if rel and href:
                self.links.append({"rel": rel, "href": href})

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title += data


def normalize_external_url(raw_url: str) -> str:
    url = raw_url.strip()
    if not url:
        raise ValueError("URL is required")
    if url.startswith(("http://", "https://")):
        return url
    if "." in url and " " not in url:
        return f"https://{url}"
    raise ValueError("Invalid URL")


def infer_title_from_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.replace("www.", "").strip()
    return host or url


def extract_preview_metadata(url: str) -> dict[str, str]:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        },
    )
    try:
        with urlopen(request, timeout=6) as response:
            raw_bytes = response.read(512_000)
            content_type = response.headers.get("Content-Type", "")
    except Exception as exc:
        raise RuntimeError("Failed to fetch link metadata") from exc

    charset = "utf-8"
    if "charset=" in content_type:
        charset = content_type.split("charset=", 1)[1].split(";", 1)[0].strip() or "utf-8"

    html = raw_bytes.decode(charset, errors="ignore")
    parser = MetadataHTMLParser()
    parser.feed(html)

    title = (
        parser.meta.get("og:title")
        or parser.meta.get("twitter:title")
        or parser.title.strip()
        or infer_title_from_url(url)
    )
    description = (
        parser.meta.get("og:description")
        or parser.meta.get("description")
        or parser.meta.get("twitter:description")
        or ""
    )
    site_name = parser.meta.get("og:site_name") or infer_title_from_url(url)
    image = parser.meta.get("og:image") or parser.meta.get("twitter:image") or ""

    icon = ""
    for link in parser.links:
        if "icon" in link["rel"]:
            icon = link["href"]
            break

    if image:
        image = urljoin(url, image)
    if icon:
        icon = urljoin(url, icon)

    return {
        "title": title.strip(),
        "description": description.strip(),
        "site_name": site_name.strip(),
        "image": image.strip(),
        "icon": icon.strip(),
    }


def fetch_link_preview(url: str) -> LinkPreviewResponse:
    normalized_url = normalize_external_url(url)
    metadata = extract_preview_metadata(normalized_url)
    return LinkPreviewResponse(
        url=url,
        normalized_url=normalized_url,
        title=metadata["title"] or infer_title_from_url(normalized_url),
        description=metadata["description"],
        site_name=metadata["site_name"] or infer_title_from_url(normalized_url),
        icon=metadata["icon"],
        image=metadata["image"],
        view="link",
        status="ready",
    )


def extract_file_payload(content_json: dict | None) -> dict[str, object]:
    if not isinstance(content_json, dict):
        return {}

    file_info = content_json.get("file")
    if not isinstance(file_info, dict):
        return {}

    return {
        "file_url": str(file_info.get("url") or "") or None,
        "file_name": str(file_info.get("name") or "") or None,
        "mime_type": str(file_info.get("mime_type") or "") or None,
        "file_size": int(file_info.get("size")) if file_info.get("size") is not None else None,
    }


def build_default_content(title: str) -> dict:
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 1, "anchor": "intro"},
                "content": [{"type": "text", "text": title}],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Start writing here..."}],
            },
        ],
    }


def build_pdf_content(title: str, file_name: str, file_url: str, file_size: int) -> dict:
    return {
        "type": "pdf",
        "version": 1,
        "content": [],
        "file": {
            "name": file_name,
            "url": file_url,
            "mime_type": "application/pdf",
            "size": file_size,
            "title": title,
        },
    }


def extract_plain_text(node: dict) -> str:
    parts: list[str] = []

    def walk(value):
        if isinstance(value, dict):
            text = value.get("text")
            if isinstance(text, str):
                parts.append(text)
            for child in value.get("content", []):
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(node)
    return " ".join(part.strip() for part in parts if part.strip())


def get_default_user_id(db: Session) -> str | None:
    user = db.scalar(select(User).order_by(User.created_at.asc()).limit(1))
    return user.id if user else None


def get_user_organization_ids(db: Session, user_id: str | None) -> set[str]:
    if not user_id:
        return set()
    return set(
        db.scalars(
            select(OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user_id)
            .where(OrganizationMember.status == "active")
        ).all()
    )


def get_document_permission_levels(db: Session, document_id: str, user_id: str | None) -> set[str]:
    if not user_id:
        return set()
    organization_ids = get_user_organization_ids(db, user_id)
    statement = select(DocumentPermission.permission_level).where(DocumentPermission.document_id == document_id)
    filters = [
        (DocumentPermission.subject_type == "user") & (DocumentPermission.subject_id == user_id),
    ]
    if organization_ids:
        filters.append(
            (DocumentPermission.subject_type == "organization")
            & (DocumentPermission.subject_id.in_(organization_ids))
        )
    statement = statement.where(or_(*filters))
    return set(db.scalars(statement).all())


def can_view_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_view_document(db, document, user_id)


def can_edit_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_edit_document(db, document, user_id)


def can_manage_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_manage_document(db, document, user_id)


def can_comment_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_comment_document(db, document, user_id)


def can_share_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_share_document(db, document, user_id)


def can_copy_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_copy_document(db, document, user_id)


def can_export_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_export_document(db, document, user_id)


def can_delete_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_delete_document(db, document, user_id)


def can_transfer_document_owner(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_transfer_document_owner(db, document, user_id)


def can_create_document_in_space(db: Session, space: Space, user_id: str) -> bool:
    return can_manage_space(db, space, user_id)


def get_favorite_document_ids(db: Session, user_id: str | None) -> set[str]:
    if user_id is None:
        return set()

    rows = db.scalars(
        select(DocumentFavorite.document_id).where(DocumentFavorite.user_id == user_id)
    ).all()
    return set(rows)


def get_or_create_latest_content(db: Session, document: Document) -> DocumentContent:
    latest_version_no = (
        db.scalar(
            select(func.max(DocumentContent.version_no)).where(DocumentContent.document_id == document.id)
        )
        or 1
    )
    content = db.scalar(
        select(DocumentContent).where(
            DocumentContent.document_id == document.id,
            DocumentContent.version_no == latest_version_no,
        )
    )
    if content is not None:
        return content

    content = DocumentContent(
        document_id=document.id,
        version_no=1,
        schema_version=1,
        content_json=build_default_content(document.title),
        plain_text=document.title,
        created_by=document.creator_id,
    )
    db.add(content)
    db.flush()
    return content


def build_document_detail_payload(
    db: Session,
    document: Document,
    *,
    user_id: str | None,
    force_can_edit: bool | None = None,
    force_can_manage: bool | None = None,
    force_can_comment: bool | None = None,
    force_is_shared_view: bool | None = None,
) -> DocumentDetail:
    content = get_or_create_latest_content(db, document)
    file_payload = extract_file_payload(content.content_json)
    can_edit = can_edit_document(db, document, user_id) and document.document_type != "pdf"
    can_manage = can_manage_document(db, document, user_id)
    can_comment = can_comment_document(db, document, user_id)
    can_share = can_share_document(db, document, user_id)
    can_copy = can_copy_document(db, document, user_id)
    can_export = can_export_document(db, document, user_id)
    can_delete = can_delete_document(db, document, user_id)
    can_transfer_owner = can_transfer_document_owner(db, document, user_id)
    effective_role = get_effective_document_role(db, document, user_id)
    is_shared_view = False

    if force_can_edit is not None:
        can_edit = force_can_edit
    if force_can_manage is not None:
        can_manage = force_can_manage
    if force_can_comment is not None:
        can_comment = force_can_comment
    if force_is_shared_view is not None:
        is_shared_view = force_is_shared_view
        if force_is_shared_view:
            can_share = False
            can_delete = False
            can_transfer_owner = False
            effective_role = "view"

    return DocumentDetail(
        id=document.id,
        title=document.title,
        owner_id=document.owner_id,
        document_type=document.document_type,
        status=document.status,
        visibility=document.visibility,
        updated_at=document.updated_at,
        space_id=document.space_id,
        folder_id=document.folder_id,
        sort_order=document.sort_order,
        is_deleted=document.is_deleted,
        is_favorited=document.id in get_favorite_document_ids(db, user_id),
        can_edit=can_edit,
        can_manage=can_manage,
        can_comment=can_comment,
        can_share=can_share,
        can_copy=can_copy,
        can_export=can_export,
        can_delete=can_delete,
        can_transfer_owner=can_transfer_owner,
        effective_role=effective_role,
        is_shared_view=is_shared_view,
        icon=document.icon,
        summary=document.summary,
        content=DocumentContentPayload(
            schema_version=content.schema_version,
            content_json=content.content_json,
            plain_text=content.plain_text,
        ),
        **file_payload,
    )


def ensure_supported_document_types(db: Session) -> None:
    db.execute(text("ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_document_type"))
    db.execute(
        text(
            "ALTER TABLE documents "
            "ADD CONSTRAINT chk_document_type CHECK (document_type IN ('doc', 'pdf', 'sheet', 'board', 'form', 'database'))"
        )
    )
    db.commit()


def _default_permission_settings() -> dict[str, str]:
    return {
        "comment_scope": "can_edit",
        "share_collaborator_scope": "full_access",
        "copy_scope": "can_view",
        "export_scope": "full_access",
    }


def list_documents(db: Session, state: str = "active", user_id: str | None = None) -> list[DocumentSummary]:
    favorite_ids = get_favorite_document_ids(db, user_id)
    statement = select(Document)
    if state == "active":
        statement = statement.where(Document.is_deleted.is_(False))
    elif state == "trash":
        statement = statement.where(Document.is_deleted.is_(True))

    statement = statement.order_by(Document.sort_order.asc(), Document.updated_at.desc())
    documents = list(db.scalars(statement).all())
    if not documents:
        return []

    document_ids = [doc.id for doc in documents]
    space_ids = {doc.space_id for doc in documents}
    spaces = {space.id: space for space in db.scalars(select(Space).where(Space.id.in_(space_ids))).all()}

    user = db.get(User, user_id) if user_id else None
    is_system_admin = bool(user and user.is_active and user.is_super_admin)
    organization_roles: dict[str, str] = {}
    if user_id:
        organization_roles = {
            organization_id: role
            for organization_id, role in db.execute(
                select(OrganizationMember.organization_id, OrganizationMember.role)
                .where(OrganizationMember.user_id == user_id)
                .where(OrganizationMember.status == "active")
            ).all()
        }

    permission_conditions = []
    if user_id:
        permission_conditions.append(
            (DocumentPermission.subject_type == "user") & (DocumentPermission.subject_id == user_id)
        )
    if organization_roles:
        permission_conditions.append(
            (DocumentPermission.subject_type == "organization")
            & (DocumentPermission.subject_id.in_(organization_roles.keys()))
        )

    document_roles: dict[str, str] = {}
    if permission_conditions:
        for document_id, permission_level in db.execute(
            select(DocumentPermission.document_id, DocumentPermission.permission_level)
            .where(DocumentPermission.document_id.in_(document_ids))
            .where(
                permission_conditions[0]
                if len(permission_conditions) == 1
                else permission_conditions[0] | permission_conditions[1]
            )
        ).all():
            normalized = normalize_permission_level(permission_level)
            current = document_roles.get(document_id, "none")
            if ROLE_RANK.get(normalized, 0) > ROLE_RANK.get(current, 0):
                document_roles[document_id] = normalized

    settings_by_document = {
        row.document_id: {
            "comment_scope": row.comment_scope,
            "share_collaborator_scope": row.share_collaborator_scope,
            "copy_scope": row.copy_scope,
            "export_scope": row.export_scope,
        }
        for row in db.scalars(
            select(DocumentPermissionSettings).where(DocumentPermissionSettings.document_id.in_(document_ids))
        ).all()
    }

    def effective_role(document: Document) -> str:
        if document.is_deleted:
            return "none"
        if user_id and (document.owner_id == user_id or document.creator_id == user_id):
            return "owner"
        space = spaces.get(document.space_id)
        organization_id = space.organization_id if space else None
        if is_system_admin or (organization_id and organization_roles.get(organization_id) in {"owner", "admin"}):
            return "view"
        member_role = document_roles.get(document.id, "none")
        if member_role != "none":
            return member_role
        if document.visibility == "public":
            return "view"
        return "none"

    summaries: list[DocumentSummary] = []
    default_settings = _default_permission_settings()
    for doc in documents:
        role = effective_role(doc)
        is_owner = bool(user_id and (doc.owner_id == user_id or doc.creator_id == user_id))
        if not role_at_least(role, "view") and not (state == "trash" and is_owner):
            continue

        settings = settings_by_document.get(doc.id, default_settings)
        can_manage = not doc.is_deleted and role_at_least(role, "full_access")
        can_edit = not doc.is_deleted and role_at_least(role, "edit")
        summaries.append(
            DocumentSummary(
                id=doc.id,
                title=doc.title,
                owner_id=doc.owner_id,
                document_type=doc.document_type,
                status=doc.status,
                visibility=doc.visibility,
                updated_at=doc.updated_at,
                space_id=doc.space_id,
                folder_id=doc.folder_id,
                sort_order=doc.sort_order,
                is_deleted=doc.is_deleted,
                is_favorited=doc.id in favorite_ids,
                can_edit=can_edit,
                can_manage=can_manage,
                can_comment=not doc.is_deleted and setting_allows(settings["comment_scope"], role),
                can_share=setting_allows(settings["share_collaborator_scope"], role),
                can_copy=setting_allows(settings["copy_scope"], role),
                can_export=setting_allows(settings["export_scope"], role),
                can_delete=can_manage,
                can_transfer_owner=not doc.is_deleted and is_owner,
                effective_role=role,
                is_shared_view=False,
            )
        )
    return summaries


def list_documents_for_mcp(
    db: Session,
    *,
    state: str = "active",
    user_id: str | None = None,
    folder_id: str | None = None,
    limit: int = 50,
) -> list[DocumentSummary]:
    normalized_state = state if state in {"active", "trash", "all"} else "active"
    safe_limit = max(1, min(limit, 200))
    favorite_ids = get_favorite_document_ids(db, user_id)
    statement = select(Document)
    if normalized_state == "active":
        statement = statement.where(Document.is_deleted.is_(False))
    elif normalized_state == "trash":
        statement = statement.where(Document.is_deleted.is_(True))
    if folder_id:
        statement = statement.where(Document.folder_id == folder_id)
    statement = statement.order_by(Document.sort_order.asc(), Document.updated_at.desc())

    items: list[DocumentSummary] = []
    for document in db.scalars(statement).all():
        if not can_mcp_read_document(db, document, user_id):
            continue
        is_owned = can_manage_document(db, document, user_id)
        items.append(
            DocumentSummary(
                id=document.id,
                title=document.title,
                owner_id=document.owner_id,
                document_type=document.document_type,
                status=document.status,
                visibility=document.visibility,
                updated_at=document.updated_at,
                space_id=document.space_id,
                folder_id=document.folder_id,
                sort_order=document.sort_order,
                is_deleted=document.is_deleted,
                is_favorited=document.id in favorite_ids,
                can_edit=is_owned and document.document_type != "pdf",
                can_manage=is_owned,
                can_comment=is_owned,
                can_share=is_owned,
                can_copy=True,
                can_export=is_owned,
                can_delete=is_owned,
                can_transfer_owner=is_owned,
                effective_role=get_effective_document_role(db, document, user_id),
                is_shared_view=False,
            )
        )
        if len(items) >= safe_limit:
            break
    return items


def search_documents(db: Session, query: str, user_id: str | None = None) -> list[SearchResult]:
    normalized_query = query.strip()
    if not normalized_query:
        return []

    favorite_ids = get_favorite_document_ids(db, user_id)
    latest_versions = (
        select(
            DocumentContent.document_id.label("document_id"),
            func.max(DocumentContent.version_no).label("version_no"),
        )
        .group_by(DocumentContent.document_id)
        .subquery()
    )

    statement = (
        select(Document, DocumentContent)
        .join(
            latest_versions,
            latest_versions.c.document_id == Document.id,
        )
        .join(
            DocumentContent,
            (DocumentContent.document_id == latest_versions.c.document_id)
            & (DocumentContent.version_no == latest_versions.c.version_no),
        )
        .where(Document.is_deleted.is_(False))
        .where(
            or_(
                Document.title.ilike(f"%{normalized_query}%"),
                DocumentContent.plain_text.ilike(f"%{normalized_query}%"),
            )
        )
        .order_by(Document.sort_order.asc(), Document.updated_at.desc())
    )

    results: list[SearchResult] = []
    for document, content in db.execute(statement).all():
        if not can_view_document(db, document, user_id):
            continue
        plain_text = content.plain_text or ""
        excerpt_source = plain_text if plain_text else document.title
        results.append(
            SearchResult(
                id=document.id,
                title=document.title,
                status=document.status,
                document_type=document.document_type,
                space_id=document.space_id,
                folder_id=document.folder_id,
                sort_order=document.sort_order,
                updated_at=document.updated_at,
                excerpt=build_search_excerpt(excerpt_source, normalized_query),
                is_favorited=document.id in favorite_ids,
            )
        )

    return results


def search_documents_for_mcp(
    db: Session,
    query: str,
    *,
    user_id: str | None = None,
    folder_id: str | None = None,
    limit: int = 20,
) -> list[SearchResult]:
    normalized_query = query.strip()
    if not normalized_query:
        return []

    safe_limit = max(1, min(limit, 100))
    favorite_ids = get_favorite_document_ids(db, user_id)
    latest_versions = (
        select(
            DocumentContent.document_id.label("document_id"),
            func.max(DocumentContent.version_no).label("version_no"),
        )
        .group_by(DocumentContent.document_id)
        .subquery()
    )

    statement = (
        select(Document, DocumentContent)
        .join(latest_versions, latest_versions.c.document_id == Document.id)
        .join(
            DocumentContent,
            (DocumentContent.document_id == latest_versions.c.document_id)
            & (DocumentContent.version_no == latest_versions.c.version_no),
        )
        .where(Document.is_deleted.is_(False))
        .where(
            or_(
                Document.title.ilike(f"%{normalized_query}%"),
                Document.summary.ilike(f"%{normalized_query}%"),
                DocumentContent.plain_text.ilike(f"%{normalized_query}%"),
            )
        )
        .order_by(Document.sort_order.asc(), Document.updated_at.desc())
    )
    if folder_id:
        statement = statement.where(Document.folder_id == folder_id)

    results: list[SearchResult] = []
    for document, content in db.execute(statement).all():
        if not can_mcp_read_document(db, document, user_id):
            continue
        results.append(
            SearchResult(
                id=document.id,
                title=document.title,
                status=document.status,
                document_type=document.document_type,
                space_id=document.space_id,
                folder_id=document.folder_id,
                sort_order=document.sort_order,
                updated_at=document.updated_at,
                excerpt=build_search_excerpt(content.plain_text or document.summary or document.title, normalized_query),
                is_favorited=document.id in favorite_ids,
            )
        )
        if len(results) >= safe_limit:
            break
    return results


def build_search_excerpt(text: str, query: str) -> str:
    clean_text = " ".join(text.split())
    if not clean_text:
        return ""

    lower_text = clean_text.lower()
    lower_query = query.lower()
    index = lower_text.find(lower_query)
    if index == -1:
        return clean_text[:140]

    start = max(index - 40, 0)
    end = min(index + len(query) + 80, len(clean_text))
    excerpt = clean_text[start:end].strip()
    if start > 0:
        excerpt = f"...{excerpt}"
    if end < len(clean_text):
        excerpt = f"{excerpt}..."
    return excerpt


def get_document_detail(db: Session, doc_id: str, user_id: str | None = None) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if not document or document.is_deleted or not can_view_document(db, document, user_id):
        return None
    return build_document_detail_payload(db, document, user_id=user_id)


def get_document_detail_for_mcp(db: Session, doc_id: str, user_id: str | None = None) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if not document or not can_mcp_read_document(db, document, user_id):
        return None
    return build_document_detail_payload(db, document, user_id=user_id)


def get_document_detail_for_share(db: Session, doc_id: str) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if not document or document.is_deleted:
        return None
    return build_document_detail_payload(
        db,
        document,
        user_id=None,
        force_can_edit=False,
        force_can_manage=False,
        force_can_comment=False,
        force_is_shared_view=True,
    )


def create_document(db: Session, payload: DocumentCreateRequest, current_user_id: str) -> DocumentDetail:
    space = db.get(Space, payload.space_id)
    if space is None:
        raise ValueError("Space not found")
    if not can_create_document_in_space(db, space, current_user_id):
        raise PermissionError("Not allowed to create document in this space")

    if payload.document_type not in SUPPORTED_DOCUMENT_TYPES:
        raise ValueError("Unsupported document type")
    if payload.document_type != "doc":
        raise ValueError("Use the PDF upload endpoint for PDF documents")
    ensure_parent_folder_valid(db, payload.space_id, payload.folder_id, current_user_id)

    owner_id = current_user_id
    parent_folder = db.get(Folder, payload.folder_id) if payload.folder_id else None
    document = Document(
        space_id=payload.space_id,
        parent_id=payload.parent_id,
        folder_id=payload.folder_id,
        creator_id=owner_id,
        owner_id=owner_id,
        title=payload.title or "Untitled",
        document_type=payload.document_type,
        status="draft",
        visibility=parent_folder.visibility if parent_folder else (payload.visibility if payload.visibility in {"private", "public"} else "private"),
        icon=payload.document_type,
        sort_order=get_next_document_sort_order(db, payload.space_id, payload.folder_id),
    )
    db.add(document)
    db.flush()

    content_json = build_default_content(document.title)
    content = DocumentContent(
        document_id=document.id,
        version_no=1,
        schema_version=1,
        content_json=content_json,
        plain_text=extract_plain_text(content_json),
        created_by=owner_id,
    )
    db.add(content)
    db.flush()

    version = DocumentVersion(
        document_id=document.id,
        content_id=content.id,
        version_no=1,
        message="Initial draft",
        created_by=owner_id,
    )
    db.add(version)
    db.flush()

    document.current_version_id = version.id
    db.commit()
    db.refresh(document)
    publish_document_event(db, "document.created", document, owner_id)
    db.commit()

    return get_document_detail(db, document.id, owner_id)  # type: ignore[return-value]


def create_pdf_document(
    db: Session,
    *,
    current_user_id: str,
    title: str,
    space_id: str,
    folder_id: str | None,
    file_name: str,
    file_bytes: bytes,
) -> DocumentDetail:
    space = db.get(Space, space_id)
    if space is None:
        raise ValueError("Space not found")
    if not can_create_document_in_space(db, space, current_user_id):
        raise PermissionError("Not allowed to upload PDF to this space")

    ensure_parent_folder_valid(db, space_id, folder_id, current_user_id)

    owner_id = current_user_id
    safe_name = Path(file_name).name
    if not safe_name.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are supported")

    file_id = f"{uuid.uuid4()}.pdf"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file_id
    file_path.write_bytes(file_bytes)

    document = Document(
        space_id=space_id,
        parent_id=None,
        folder_id=folder_id,
        creator_id=owner_id,
        owner_id=owner_id,
        title=title or Path(safe_name).stem or "未命名 PDF",
        document_type="pdf",
        status="uploaded",
        visibility=parent_folder.visibility if folder_id and (parent_folder := db.get(Folder, folder_id)) else "private",
        icon="pdf",
        summary=safe_name,
        sort_order=get_next_document_sort_order(db, space_id, folder_id),
    )
    db.add(document)
    db.flush()

    file_url = f"{settings.upload_url_prefix}/{file_id}"
    content_json = build_pdf_content(document.title, safe_name, file_url, len(file_bytes))
    content = DocumentContent(
        document_id=document.id,
        version_no=1,
        schema_version=1,
        content_json=content_json,
        plain_text=f"{document.title} {safe_name}".strip(),
        created_by=owner_id,
    )
    db.add(content)
    db.flush()

    version = DocumentVersion(
        document_id=document.id,
        content_id=content.id,
        version_no=1,
        message="PDF uploaded",
        created_by=owner_id,
    )
    db.add(version)
    db.flush()

    document.current_version_id = version.id
    db.commit()
    db.refresh(document)
    publish_document_event(db, "document.created", document, owner_id)
    db.commit()
    return get_document_detail(db, document.id, owner_id)  # type: ignore[return-value]


def move_document(
    db: Session,
    doc_id: str,
    *,
    folder_id: str | None,
    current_user_id: str,
) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if document is None or document.is_deleted:
        return None
    if not can_manage_document(db, document, current_user_id):
        raise PermissionError("Not allowed to move document")
    if folder_id is not None:
        target_folder = db.get(Folder, folder_id)
        if target_folder is None or target_folder.is_deleted:
            raise ValueError("Target folder not found")
        if target_folder.space_id != document.space_id:
            raise ValueError("Target folder is outside of the document space")
        if not can_view_document(db, document, current_user_id):
            raise PermissionError("Not allowed to move document")
        document.visibility = target_folder.visibility
    document.folder_id = folder_id
    document.sort_order = get_next_document_sort_order(db, document.space_id, folder_id)
    document.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    publish_document_event(db, "document.moved", document, current_user_id)
    db.commit()
    return get_document_detail(db, document.id, current_user_id)


def list_document_ancestors(db: Session, doc_id: str, user_id: str | None = None) -> list[AncestorItem]:
    document = db.get(Document, doc_id)
    if document is None or document.is_deleted or not can_view_document(db, document, user_id):
        return []
    return get_document_folder_ancestors(db, document, user_id)


def upload_image_asset(*, file_name: str, file_bytes: bytes, content_type: str) -> dict[str, str | int]:
    safe_name = Path(file_name).name or "image"
    mime_type = content_type.strip().lower()
    if mime_type not in {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"}:
        raise ValueError("Only PNG, JPG, GIF, and WEBP images are supported")

    extension = Path(safe_name).suffix.lower()
    if mime_type == "image/jpeg" and extension not in {".jpg", ".jpeg"}:
        extension = ".jpg"
    elif mime_type == "image/png" and extension != ".png":
        extension = ".png"
    elif mime_type == "image/gif" and extension != ".gif":
        extension = ".gif"
    elif mime_type == "image/webp" and extension != ".webp":
        extension = ".webp"

    file_id = f"{uuid.uuid4()}{extension or '.img'}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file_id
    file_path.write_bytes(file_bytes)

    return {
        "file_url": f"{settings.upload_url_prefix}/{file_id}",
        "file_name": safe_name,
        "mime_type": "image/jpeg" if mime_type == "image/jpg" else mime_type,
        "file_size": len(file_bytes),
    }


def update_document_content(
    db: Session,
    doc_id: str,
    payload: DocumentContentUpdateRequest,
    current_user_id: str,
) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if not document or document.is_deleted:
        return None
    if not can_edit_document(db, document, current_user_id):
        raise PermissionError("Not allowed to edit document")
    if document.document_type == "pdf":
        return get_document_detail(db, doc_id, current_user_id)

    next_version_no = (
        db.scalar(select(func.max(DocumentContent.version_no)).where(DocumentContent.document_id == doc_id)) or 0
    ) + 1

    plain_text = payload.plain_text or extract_plain_text(payload.content_json)
    content = DocumentContent(
        document_id=doc_id,
        version_no=next_version_no,
        schema_version=payload.schema_version,
        content_json=payload.content_json,
        plain_text=plain_text,
        created_by=current_user_id,
    )
    db.add(content)
    db.flush()

    version = DocumentVersion(
        document_id=doc_id,
        content_id=content.id,
        version_no=next_version_no,
        message="Autosave snapshot",
        created_by=current_user_id,
    )
    db.add(version)
    db.flush()

    document.current_version_id = version.id
    if payload.content_json.get("content"):
        first_heading = payload.content_json["content"][0]
        first_text = extract_plain_text(first_heading)
        if first_text:
            document.title = first_text[:255]
    document.summary = plain_text[:280] if plain_text else document.summary
    document.updated_at = datetime.now(timezone.utc)
    sync_comment_threads_with_content(db, doc_id, payload.content_json)

    db.commit()
    db.refresh(document)
    publish_document_event(db, "document.content_updated", document, current_user_id)
    db.commit()
    return get_document_detail(db, doc_id, current_user_id)


def rename_document(
    db: Session,
    doc_id: str,
    title: str,
    current_user_id: str,
) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if not document or document.is_deleted:
        return None
    if not can_manage_document(db, document, current_user_id):
        raise PermissionError("Not allowed to rename document")

    document.title = (title.strip() or "未命名文档")[:255]
    document.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    publish_document_event(db, "document.renamed", document, current_user_id)
    db.commit()
    return get_document_detail(db, doc_id, current_user_id)


def duplicate_document(db: Session, doc_id: str, current_user_id: str) -> DocumentDetail | None:
    source = db.get(Document, doc_id)
    if not source or source.is_deleted:
        return None
    if not can_copy_document(db, source, current_user_id):
        raise PermissionError("Not allowed to duplicate document")

    space = db.get(Space, source.space_id)
    if space is None:
        return None
    if not can_create_document_in_space(db, space, current_user_id):
        raise PermissionError("Not allowed to create document in this space")
    if source.folder_id is not None:
        ensure_parent_folder_valid(db, source.space_id, source.folder_id, current_user_id)

    latest_content = get_or_create_latest_content(db, source)
    document = Document(
        space_id=source.space_id,
        parent_id=None,
        folder_id=source.folder_id,
        creator_id=current_user_id,
        owner_id=current_user_id,
        title=f"{source.title} 副本"[:255],
        document_type=source.document_type,
        status=source.status,
        visibility=source.visibility,
        icon=source.icon,
        sort_order=get_next_document_sort_order(db, source.space_id, source.folder_id),
        cover_url=source.cover_url,
        summary=source.summary,
    )
    db.add(document)
    db.flush()

    content = DocumentContent(
        document_id=document.id,
        version_no=1,
        schema_version=latest_content.schema_version,
        content_json=deepcopy(latest_content.content_json),
        plain_text=latest_content.plain_text,
        created_by=current_user_id,
    )
    db.add(content)
    db.flush()

    version = DocumentVersion(
        document_id=document.id,
        content_id=content.id,
        version_no=1,
        message=f"Duplicated from {source.id}",
        created_by=current_user_id,
    )
    db.add(version)
    db.flush()

    document.current_version_id = version.id
    db.commit()
    db.refresh(document)
    publish_document_event(db, "document.created", document, current_user_id)
    publish_document_event(db, "document.duplicated", document, current_user_id)
    db.commit()
    return get_document_detail(db, document.id, current_user_id)


def soft_delete_document(db: Session, doc_id: str, user_id: str | None = None) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if not document:
        return None
    if not can_manage_document(db, document, user_id):
        raise PermissionError("Not allowed to delete document")

    document.is_deleted = True
    document.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    publish_document_event(db, "document.deleted", document, user_id)
    db.commit()
    return get_document_detail_including_deleted(db, doc_id, user_id)


def restore_document(db: Session, doc_id: str, user_id: str | None = None) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if not document:
        return None
    if user_id not in {document.owner_id, document.creator_id}:
        raise PermissionError("Not allowed to restore document")

    document.is_deleted = False
    document.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    publish_document_event(db, "document.restored", document, user_id)
    db.commit()
    return get_document_detail(db, doc_id, user_id)


def get_document_detail_including_deleted(db: Session, doc_id: str, user_id: str | None = None) -> DocumentDetail | None:
    document = db.get(Document, doc_id)
    if not document:
        return None
    return build_document_detail_payload(db, document, user_id=user_id)


def favorite_document(db: Session, doc_id: str, user_id: str) -> FavoriteStatusResponse | None:
    document = db.get(Document, doc_id)
    if document is None:
        return None
    if not can_view_document(db, document, user_id):
        raise PermissionError("Not allowed to favorite document")

    existing = db.scalar(
        select(DocumentFavorite).where(
            DocumentFavorite.document_id == doc_id,
            DocumentFavorite.user_id == user_id,
        )
    )
    if existing is None:
        db.add(DocumentFavorite(document_id=doc_id, user_id=user_id))
        db.commit()

    return FavoriteStatusResponse(document_id=doc_id, is_favorited=True)


def unfavorite_document(db: Session, doc_id: str, user_id: str) -> FavoriteStatusResponse | None:
    document = db.get(Document, doc_id)
    if document is None:
        return None
    if not can_view_document(db, document, user_id):
        raise PermissionError("Not allowed to unfavorite document")

    existing = db.scalar(
        select(DocumentFavorite).where(
            DocumentFavorite.document_id == doc_id,
            DocumentFavorite.user_id == user_id,
        )
    )
    if existing is not None:
        db.delete(existing)
        db.commit()

    return FavoriteStatusResponse(document_id=doc_id, is_favorited=False)
