from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentContent, DocumentVersion
from app.models.space import Space
from app.models.template import Template
from app.schemas.document import DocumentDetail
from app.schemas.template import (
    TemplateDetail,
    TemplateInstantiateRequest,
    TemplateInstantiateResponse,
    TemplateSummary,
)
from app.services.document_service import (
    extract_plain_text,
    get_default_user_id,
    get_document_detail,
)


def list_templates(db: Session) -> list[TemplateSummary]:
    statement = select(Template).where(Template.status == "published").order_by(Template.created_at.asc())
    return [TemplateSummary.model_validate(template) for template in db.scalars(statement).all()]


def get_template(db: Session, template_id: str) -> TemplateDetail | None:
    template = db.get(Template, template_id)
    if template is None:
        return None

    return TemplateDetail.model_validate(template)


def instantiate_template(
    db: Session,
    template_id: str,
    payload: TemplateInstantiateRequest,
) -> TemplateInstantiateResponse | None:
    template = db.get(Template, template_id)
    if template is None:
        return None

    owner_id = get_default_user_id(db)
    if owner_id is None:
        return None

    target_space_id = payload.space_id
    if target_space_id is None:
        default_space = db.scalar(select(Space).order_by(Space.created_at.asc()).limit(1))
        if default_space is None:
            return None
        target_space_id = default_space.id

    space = db.get(Space, target_space_id)
    if space is None:
        return None

    content_json = deepcopy(template.content_json)
    default_title = (
        payload.title
        or extract_title_from_template(content_json)
        or template.name
        or "Untitled"
    )

    if content_json.get("content"):
        first_node = content_json["content"][0]
        if isinstance(first_node, dict) and first_node.get("type") == "heading":
            first_node["content"] = [{"type": "text", "text": default_title}]

    document = Document(
        space_id=space.id,
        parent_id=None,
        creator_id=owner_id,
        owner_id=owner_id,
        title=default_title,
        document_type="doc",
        status="draft",
        icon="doc",
    )
    db.add(document)
    db.flush()

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
        message=f"Created from template: {template.name}",
        created_by=owner_id,
    )
    db.add(version)
    db.flush()

    document.current_version_id = version.id
    db.commit()
    db.refresh(document)

    detail = get_document_detail(db, document.id)
    if detail is None:
        return None

    return TemplateInstantiateResponse(template_id=template.id, document=detail)


def extract_title_from_template(content_json: dict) -> str | None:
    content = content_json.get("content")
    if not isinstance(content, list) or not content:
        return None

    first_node = content[0]
    if not isinstance(first_node, dict) or first_node.get("type") != "heading":
        return None

    text_parts = []
    for child in first_node.get("content", []):
        if isinstance(child, dict) and isinstance(child.get("text"), str):
            text_parts.append(child["text"])

    title = "".join(text_parts).strip()
    return title or None
