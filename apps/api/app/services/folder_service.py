from datetime import timezone, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentFavorite, DocumentPermission
from app.models.folder import Folder, FolderFavorite, TreeShortcut, UserTreePin
from app.models.organization import OrganizationMember
from app.models.space import Space
from app.models.user import User
from app.schemas.folder import (
    AncestorItem,
    FolderBulkMoveRequest,
    FolderChildrenResponse,
    FolderCreateRequest,
    FolderFavoriteStatusResponse,
    FolderReorderRequest,
    FolderSummary,
    TreePinRequest,
    TreePinResponse,
    TreeShortcutCreateRequest,
    TreeNodeActionsResponse,
    TreeNodeSummary,
)
from app.services.permission_service import (
    ROLE_RANK,
    can_access_space as permission_can_access_space,
    can_copy_document as permission_can_copy_document,
    can_delete_document as permission_can_delete_document,
    can_manage_document as permission_can_manage_document,
    can_manage_folder as permission_can_manage_folder,
    can_manage_space as permission_can_manage_space,
    can_share_document as permission_can_share_document,
    can_transfer_document_owner as permission_can_transfer_document_owner,
    can_view_document as permission_can_view_document,
    can_view_folder as permission_can_view_folder,
    normalize_permission_level,
)
from app.services.event_stream_service import publish_document_event, publish_folder_event


def get_next_folder_sort_order(db: Session, space_id: str, parent_folder_id: str | None) -> int:
    statement = select(func.max(Folder.sort_order)).where(Folder.space_id == space_id).where(Folder.is_deleted.is_(False))
    if parent_folder_id is None:
        statement = statement.where(Folder.parent_folder_id.is_(None))
    else:
        statement = statement.where(Folder.parent_folder_id == parent_folder_id)
    max_value = db.scalar(statement)
    return int(max_value or 0) + 1


def get_next_document_sort_order(db: Session, space_id: str, folder_id: str | None) -> int:
    statement = (
        select(func.max(Document.sort_order))
        .where(Document.space_id == space_id)
        .where(Document.is_deleted.is_(False))
    )
    if folder_id is None:
        statement = statement.where(Document.folder_id.is_(None))
    else:
        statement = statement.where(Document.folder_id == folder_id)
    max_value = db.scalar(statement)
    return int(max_value or 0) + 1


def get_next_shortcut_sort_order(db: Session, space_id: str, parent_folder_id: str | None) -> int:
    statement = (
        select(func.max(TreeShortcut.sort_order))
        .where(TreeShortcut.space_id == space_id)
        .where(TreeShortcut.is_deleted.is_(False))
    )
    if parent_folder_id is None:
        statement = statement.where(TreeShortcut.parent_folder_id.is_(None))
    else:
        statement = statement.where(TreeShortcut.parent_folder_id == parent_folder_id)
    max_value = db.scalar(statement)
    return int(max_value or 0) + 1


def apply_folder_visibility_to_descendants(db: Session, folder: Folder, visibility: str) -> None:
    descendants = db.scalars(
        select(Folder).where(Folder.parent_folder_id == folder.id).where(Folder.is_deleted.is_(False))
    ).all()
    for child in descendants:
        child.visibility = visibility
        child.updated_at = datetime.now(timezone.utc)
        apply_folder_visibility_to_descendants(db, child, visibility)

    documents = db.scalars(
        select(Document).where(Document.folder_id == folder.id).where(Document.is_deleted.is_(False))
    ).all()
    for document in documents:
        document.visibility = visibility
        document.updated_at = datetime.now(timezone.utc)


def is_descendant_folder(db: Session, *, folder_id: str, candidate_parent_id: str | None) -> bool:
    current_id = candidate_parent_id
    while current_id is not None:
        if current_id == folder_id:
            return True
        current = db.get(Folder, current_id)
        if current is None:
            break
        current_id = current.parent_folder_id
    return False


def can_access_space(db: Session, space: Space, user_id: str | None) -> bool:
    return permission_can_access_space(db, space, user_id)


def can_manage_space(db: Session, space: Space, user_id: str | None) -> bool:
    return permission_can_manage_space(db, space, user_id)


def can_view_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_view_document(db, document, user_id)


def can_manage_document(db: Session, document: Document, user_id: str | None) -> bool:
    return permission_can_manage_document(db, document, user_id)


def can_view_folder(db: Session, folder: Folder, user_id: str | None) -> bool:
    return permission_can_view_folder(db, folder, user_id)


def can_manage_folder(db: Session, folder: Folder, user_id: str | None) -> bool:
    return permission_can_manage_folder(db, folder, user_id)


class SpaceTreePermissionResolver:
    def __init__(self, db: Session, space: Space, user_id: str | None, documents: list[Document]) -> None:
        self.db = db
        self.space = space
        self.user_id = user_id
        self.is_system_admin = False
        self.is_space_member = False
        self.space_role: str | None = None
        self.can_view_space = False
        self.can_manage_space = False
        self.organization_permission_enabled = False
        self.document_roles: dict[str, str] = {}
        self._prepare_actor()
        self._prepare_document_roles(documents)

    def _prepare_actor(self) -> None:
        if not self.user_id:
            self.can_view_space = self.space.visibility == "public"
            self.can_manage_space = False
            return

        user = self.db.get(User, self.user_id)
        self.is_system_admin = bool(user and user.is_active and user.is_super_admin)

        if self.space.owner_id == self.user_id:
            self.can_view_space = True
            self.can_manage_space = True
            self.space_role = "owner"
            self.organization_permission_enabled = bool(self.space.organization_id)
            return

        if self.space.organization_id:
            self.space_role = self.db.scalar(
                select(OrganizationMember.role)
                .where(OrganizationMember.organization_id == self.space.organization_id)
                .where(OrganizationMember.user_id == self.user_id)
                .where(OrganizationMember.status == "active")
                .limit(1)
            )
            self.is_space_member = self.space_role is not None
            self.organization_permission_enabled = self.is_space_member

        self.can_view_space = self.is_system_admin or self.space.visibility == "public" or self.is_space_member
        self.can_manage_space = self.space_role in {"owner", "admin", "member"}

    def _prepare_document_roles(self, documents: list[Document]) -> None:
        if not self.user_id or not documents:
            return

        document_ids = [document.id for document in documents]
        conditions = [
            (DocumentPermission.subject_type == "user") & (DocumentPermission.subject_id == self.user_id)
        ]
        if self.organization_permission_enabled and self.space.organization_id:
            conditions.append(
                (DocumentPermission.subject_type == "organization")
                & (DocumentPermission.subject_id == self.space.organization_id)
            )

        rows = self.db.execute(
            select(DocumentPermission.document_id, DocumentPermission.permission_level)
            .where(DocumentPermission.document_id.in_(document_ids))
            .where(or_(*conditions))
        ).all()

        best_roles: dict[str, str] = {}
        for document_id, permission_level in rows:
            normalized = normalize_permission_level(permission_level)
            current = best_roles.get(document_id, "none")
            if ROLE_RANK.get(normalized, 0) > ROLE_RANK.get(current, 0):
                best_roles[document_id] = normalized
        self.document_roles = best_roles

    def can_view_folder(self, folder: Folder) -> bool:
        if folder.is_deleted:
            return False
        if self.is_system_admin:
            return True
        if folder.visibility == "public":
            return True
        return self.can_view_space

    def can_manage_folder(self, folder: Folder) -> bool:
        if not self.user_id:
            return False
        if folder.owner_id == self.user_id:
            return True
        return self.can_manage_space

    def can_view_document(self, document: Document) -> bool:
        if document.is_deleted:
            return False
        if self.user_id and (document.owner_id == self.user_id or document.creator_id == self.user_id):
            return True
        if self.is_system_admin:
            return True
        if self.space_role in {"owner", "admin"}:
            return True
        if ROLE_RANK.get(self.document_roles.get(document.id, "none"), 0) >= ROLE_RANK["view"]:
            return True
        if document.visibility == "public":
            return True
        return False

    def can_manage_document(self, document: Document) -> bool:
        if document.is_deleted:
            return False
        if self.user_id and (document.owner_id == self.user_id or document.creator_id == self.user_id):
            return True
        return ROLE_RANK.get(self.document_roles.get(document.id, "none"), 0) >= ROLE_RANK["full_access"]


def build_folder_summary(db: Session, folder: Folder, user_id: str | None) -> FolderSummary:
    return FolderSummary(
        id=folder.id,
        space_id=folder.space_id,
        parent_folder_id=folder.parent_folder_id,
        title=folder.title,
        visibility=folder.visibility,
        icon=folder.icon,
        sort_order=folder.sort_order,
        is_deleted=folder.is_deleted,
        updated_at=folder.updated_at,
        can_manage=can_manage_folder(db, folder, user_id),
        is_favorited=folder.id in get_favorite_folder_ids(db, user_id),
    )


def get_favorite_folder_ids(db: Session, user_id: str | None) -> set[str]:
    if not user_id:
        return set()
    return set(
        db.scalars(
            select(FolderFavorite.folder_id).where(FolderFavorite.user_id == user_id)
        ).all()
    )


def get_favorite_document_ids(db: Session, user_id: str | None) -> set[str]:
    if not user_id:
        return set()
    return set(
        db.scalars(
            select(DocumentFavorite.document_id).where(DocumentFavorite.user_id == user_id)
        ).all()
    )


def get_pinned_node_keys(db: Session, user_id: str | None, space_id: str) -> set[tuple[str, str]]:
    if not user_id:
        return set()
    rows = db.execute(
        select(UserTreePin.node_type, UserTreePin.node_id)
        .where(UserTreePin.user_id == user_id)
        .where(UserTreePin.space_id == space_id)
    ).all()
    return {(node_type, node_id) for node_type, node_id in rows}


def build_folder_tree_node(
    db: Session,
    folder: Folder,
    user_id: str | None,
    resolver: SpaceTreePermissionResolver | None = None,
    pinned_keys: set[tuple[str, str]] | None = None,
    favorite_folder_ids: set[str] | None = None,
) -> TreeNodeSummary:
    return TreeNodeSummary(
        id=folder.id,
        node_type="folder",
        title=folder.title,
        space_id=folder.space_id,
        parent_folder_id=folder.parent_folder_id,
        sort_order=folder.sort_order,
        visibility=folder.visibility,
        updated_at=folder.updated_at,
        can_manage=resolver.can_manage_folder(folder) if resolver else can_manage_folder(db, folder, user_id),
        document_type=None,
        is_deleted=folder.is_deleted,
        is_pinned=("folder", folder.id) in (pinned_keys or set()),
        is_favorited=folder.id in (favorite_folder_ids or set()),
        children=[],
    )


def build_document_tree_node(
    db: Session,
    document: Document,
    user_id: str | None,
    resolver: SpaceTreePermissionResolver | None = None,
    pinned_keys: set[tuple[str, str]] | None = None,
    favorite_document_ids: set[str] | None = None,
) -> TreeNodeSummary:
    return TreeNodeSummary(
        id=document.id,
        node_type="document",
        title=document.title,
        space_id=document.space_id,
        parent_folder_id=document.folder_id,
        sort_order=document.sort_order,
        visibility=document.visibility,
        updated_at=document.updated_at,
        can_manage=resolver.can_manage_document(document) if resolver else can_manage_document(db, document, user_id),
        document_type=document.document_type,
        is_deleted=document.is_deleted,
        is_pinned=("document", document.id) in (pinned_keys or set()),
        is_favorited=document.id in (favorite_document_ids or set()),
        children=[],
    )


def build_shortcut_tree_node(
    db: Session,
    shortcut: TreeShortcut,
    user_id: str | None,
    resolver: SpaceTreePermissionResolver | None = None,
    pinned_keys: set[tuple[str, str]] | None = None,
) -> TreeNodeSummary | None:
    target_title = shortcut.title_override
    target_visibility = "private"
    target_document_type = None
    if shortcut.target_type == "folder":
        target_folder = db.get(Folder, shortcut.target_id)
        if target_folder is None or target_folder.is_deleted:
            return None
        can_view = resolver.can_view_folder(target_folder) if resolver else can_view_folder(db, target_folder, user_id)
        if not can_view:
            return None
        target_title = target_title or target_folder.title
        target_visibility = target_folder.visibility
    elif shortcut.target_type == "document":
        target_document = db.get(Document, shortcut.target_id)
        if target_document is None or target_document.is_deleted:
            return None
        can_view = resolver.can_view_document(target_document) if resolver else can_view_document(db, target_document, user_id)
        if not can_view:
            return None
        target_title = target_title or target_document.title
        target_visibility = target_document.visibility
        target_document_type = target_document.document_type
    else:
        return None

    return TreeNodeSummary(
        id=shortcut.id,
        node_type="shortcut",
        title=target_title or "快捷方式",
        space_id=shortcut.space_id,
        parent_folder_id=shortcut.parent_folder_id,
        target_type=shortcut.target_type,
        target_id=shortcut.target_id,
        sort_order=shortcut.sort_order,
        visibility=target_visibility,
        updated_at=shortcut.updated_at,
        can_manage=shortcut.owner_user_id == user_id,
        document_type=target_document_type,
        is_deleted=shortcut.is_deleted,
        is_pinned=("shortcut", shortcut.id) in (pinned_keys or set()),
        children=[],
    )


def sort_tree_nodes(nodes: list[TreeNodeSummary]) -> list[TreeNodeSummary]:
    return sorted(nodes, key=lambda node: (0 if node.is_pinned else 1, node.sort_order, node.title.lower(), node.node_type, node.id))


def get_folder_detail(db: Session, folder_id: str, user_id: str | None = None) -> FolderSummary | None:
    folder = db.get(Folder, folder_id)
    if not folder or folder.is_deleted or not can_view_folder(db, folder, user_id):
        return None
    return build_folder_summary(db, folder, user_id)


def ensure_parent_folder_valid(db: Session, space_id: str, parent_folder_id: str | None, user_id: str) -> Folder | None:
    if parent_folder_id is None:
        return None
    folder = db.get(Folder, parent_folder_id)
    if folder is None or folder.is_deleted:
        raise ValueError("Parent folder not found")
    if folder.space_id != space_id:
        raise ValueError("Parent folder is outside of the target space")
    if not can_view_folder(db, folder, user_id):
        raise PermissionError("Not allowed to use the parent folder")
    return folder


def create_folder(db: Session, payload: FolderCreateRequest, current_user_id: str) -> FolderSummary:
    space = db.get(Space, payload.space_id)
    if space is None:
        raise ValueError("Space not found")
    if not can_manage_space(db, space, current_user_id):
        raise PermissionError("Not allowed to create folder in this space")

    ensure_parent_folder_valid(db, payload.space_id, payload.parent_folder_id, current_user_id)
    folder = Folder(
        space_id=payload.space_id,
        parent_folder_id=payload.parent_folder_id,
        creator_id=current_user_id,
        owner_id=current_user_id,
        title=(payload.title or "未命名文件夹").strip() or "未命名文件夹",
        visibility=(
            db.get(Folder, payload.parent_folder_id).visibility
            if payload.parent_folder_id and db.get(Folder, payload.parent_folder_id)
            else (payload.visibility if payload.visibility in {"private", "public"} else "private")
        ),
        icon="folder",
        sort_order=get_next_folder_sort_order(db, payload.space_id, payload.parent_folder_id),
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    publish_folder_event(db, "folder.created", folder, current_user_id)
    db.commit()
    return build_folder_summary(db, folder, current_user_id)


def rename_folder(
    db: Session,
    folder_id: str,
    title: str | None,
    current_user_id: str,
    visibility: str | None = None,
) -> FolderSummary | None:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.is_deleted:
        return None
    if not can_manage_folder(db, folder, current_user_id):
        raise PermissionError("Not allowed to rename folder")
    if title is not None:
        folder.title = title.strip() or "未命名文件夹"
    if visibility in {"private", "public"} and visibility != folder.visibility:
        folder.visibility = visibility
        apply_folder_visibility_to_descendants(db, folder, visibility)
    folder.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(folder)
    publish_folder_event(db, "folder.updated", folder, current_user_id)
    db.commit()
    return build_folder_summary(db, folder, current_user_id)


def delete_folder(db: Session, folder_id: str, current_user_id: str) -> FolderSummary | None:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.is_deleted:
        return None
    if not can_manage_folder(db, folder, current_user_id):
        raise PermissionError("Not allowed to delete folder")

    has_subfolders = db.scalar(
        select(Folder.id)
        .where(Folder.parent_folder_id == folder.id)
        .where(Folder.is_deleted.is_(False))
        .limit(1)
    )
    has_documents = db.scalar(
        select(Document.id)
        .where(Document.folder_id == folder.id)
        .where(Document.is_deleted.is_(False))
        .limit(1)
    )
    if has_subfolders or has_documents:
        raise ValueError("Folder is not empty")

    folder.is_deleted = True
    folder.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(folder)
    publish_folder_event(db, "folder.deleted", folder, current_user_id)
    db.commit()
    return build_folder_summary(db, folder, current_user_id)


def list_space_root_children(db: Session, space_id: str, user_id: str | None = None) -> FolderChildrenResponse:
    space = db.get(Space, space_id)
    if space is None:
        raise ValueError("Space not found")
    if not can_access_space(db, space, user_id):
        raise PermissionError("Not allowed to access this space")

    folders = db.scalars(
        select(Folder)
        .where(Folder.space_id == space_id)
        .where(Folder.parent_folder_id.is_(None))
        .where(Folder.is_deleted.is_(False))
        .order_by(Folder.sort_order.asc(), Folder.title.asc())
    ).all()

    documents = db.scalars(
        select(Document)
        .where(Document.space_id == space_id)
        .where(Document.folder_id.is_(None))
        .where(Document.is_deleted.is_(False))
        .order_by(Document.sort_order.asc(), Document.updated_at.desc())
    ).all()
    shortcuts = db.scalars(
        select(TreeShortcut)
        .where(TreeShortcut.space_id == space_id)
        .where(TreeShortcut.parent_folder_id.is_(None))
        .where(TreeShortcut.is_deleted.is_(False))
        .where(TreeShortcut.owner_user_id == user_id)
        .order_by(TreeShortcut.sort_order.asc(), TreeShortcut.updated_at.desc())
    ).all()
    resolver = SpaceTreePermissionResolver(db, space, user_id, documents)
    pinned_keys = get_pinned_node_keys(db, user_id, space_id)
    favorite_folder_ids = get_favorite_folder_ids(db, user_id)
    favorite_document_ids = get_favorite_document_ids(db, user_id)

    children: list[TreeNodeSummary] = [
        build_folder_tree_node(db, folder, user_id, resolver, pinned_keys, favorite_folder_ids)
        for folder in folders
        if resolver.can_view_folder(folder)
    ]
    children.extend(
        build_document_tree_node(db, document, user_id, resolver, pinned_keys, favorite_document_ids)
        for document in documents
        if resolver.can_view_document(document)
    )
    for shortcut in shortcuts:
        shortcut_node = build_shortcut_tree_node(db, shortcut, user_id, resolver, pinned_keys)
        if shortcut_node is not None:
            children.append(shortcut_node)
    return FolderChildrenResponse(folder=None, children=sort_tree_nodes(children))


def list_folder_children(db: Session, folder_id: str, user_id: str | None = None) -> FolderChildrenResponse | None:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.is_deleted:
        return None
    if not can_view_folder(db, folder, user_id):
        raise PermissionError("Not allowed to access this folder")
    space = db.get(Space, folder.space_id)
    if space is None:
        return None

    folders = db.scalars(
        select(Folder)
        .where(Folder.parent_folder_id == folder_id)
        .where(Folder.is_deleted.is_(False))
        .order_by(Folder.sort_order.asc(), Folder.title.asc())
    ).all()
    documents = db.scalars(
        select(Document)
        .where(Document.folder_id == folder_id)
        .where(Document.is_deleted.is_(False))
        .order_by(Document.sort_order.asc(), Document.updated_at.desc())
    ).all()
    shortcuts = db.scalars(
        select(TreeShortcut)
        .where(TreeShortcut.parent_folder_id == folder_id)
        .where(TreeShortcut.is_deleted.is_(False))
        .where(TreeShortcut.owner_user_id == user_id)
        .order_by(TreeShortcut.sort_order.asc(), TreeShortcut.updated_at.desc())
    ).all()
    resolver = SpaceTreePermissionResolver(db, space, user_id, documents)
    pinned_keys = get_pinned_node_keys(db, user_id, space.id)
    favorite_folder_ids = get_favorite_folder_ids(db, user_id)
    favorite_document_ids = get_favorite_document_ids(db, user_id)
    children: list[TreeNodeSummary] = [
        build_folder_tree_node(db, child, user_id, resolver, pinned_keys, favorite_folder_ids)
        for child in folders
        if resolver.can_view_folder(child)
    ]
    children.extend(
        build_document_tree_node(db, document, user_id, resolver, pinned_keys, favorite_document_ids)
        for document in documents
        if resolver.can_view_document(document)
    )
    for shortcut in shortcuts:
        shortcut_node = build_shortcut_tree_node(db, shortcut, user_id, resolver, pinned_keys)
        if shortcut_node is not None:
            children.append(shortcut_node)
    return FolderChildrenResponse(
        folder=build_folder_summary(db, folder, user_id),
        children=sort_tree_nodes(children),
    )


def _build_folder_tree(
    db: Session,
    folders_by_parent: dict[str | None, list[Folder]],
    docs_by_folder: dict[str | None, list[Document]],
    shortcuts_by_parent: dict[str | None, list[TreeShortcut]],
    parent_id: str | None,
    user_id: str | None,
    resolver: SpaceTreePermissionResolver | None = None,
    pinned_keys: set[tuple[str, str]] | None = None,
    favorite_folder_ids: set[str] | None = None,
    favorite_document_ids: set[str] | None = None,
) -> list[TreeNodeSummary]:
    nodes: list[TreeNodeSummary] = []
    for folder in folders_by_parent.get(parent_id, []):
        if resolver:
            if not resolver.can_view_folder(folder):
                continue
        elif not can_view_folder(db, folder, user_id):
            continue
        node = build_folder_tree_node(db, folder, user_id, resolver, pinned_keys, favorite_folder_ids)
        node.children = _build_folder_tree(
            db,
            folders_by_parent,
            docs_by_folder,
            shortcuts_by_parent,
            folder.id,
            user_id,
            resolver,
            pinned_keys,
            favorite_folder_ids,
            favorite_document_ids,
        )
        nodes.append(node)
    for document in docs_by_folder.get(parent_id, []):
        if resolver:
            if not resolver.can_view_document(document):
                continue
        elif not can_view_document(db, document, user_id):
            continue
        nodes.append(build_document_tree_node(db, document, user_id, resolver, pinned_keys, favorite_document_ids))
    for shortcut in shortcuts_by_parent.get(parent_id, []):
        shortcut_node = build_shortcut_tree_node(db, shortcut, user_id, resolver, pinned_keys)
        if shortcut_node is not None:
            nodes.append(shortcut_node)
    return sort_tree_nodes(nodes)


def get_space_tree(db: Session, space_id: str, user_id: str | None = None) -> list[TreeNodeSummary]:
    space = db.get(Space, space_id)
    if space is None:
        raise ValueError("Space not found")
    if not can_access_space(db, space, user_id):
        raise PermissionError("Not allowed to access this space")
    folders = db.scalars(
        select(Folder)
        .where(Folder.space_id == space_id)
        .where(Folder.is_deleted.is_(False))
        .order_by(Folder.sort_order.asc(), Folder.title.asc())
    ).all()
    documents = db.scalars(
        select(Document)
        .where(Document.space_id == space_id)
        .where(Document.is_deleted.is_(False))
        .order_by(Document.sort_order.asc(), Document.updated_at.desc())
    ).all()
    shortcuts = db.scalars(
        select(TreeShortcut)
        .where(TreeShortcut.space_id == space_id)
        .where(TreeShortcut.is_deleted.is_(False))
        .where(TreeShortcut.owner_user_id == user_id)
        .order_by(TreeShortcut.sort_order.asc(), TreeShortcut.updated_at.desc())
    ).all()
    folders_by_parent: dict[str | None, list[Folder]] = {}
    docs_by_folder: dict[str | None, list[Document]] = {}
    shortcuts_by_parent: dict[str | None, list[TreeShortcut]] = {}
    for folder in folders:
        folders_by_parent.setdefault(folder.parent_folder_id, []).append(folder)
    for document in documents:
        docs_by_folder.setdefault(document.folder_id, []).append(document)
    for shortcut in shortcuts:
        shortcuts_by_parent.setdefault(shortcut.parent_folder_id, []).append(shortcut)
    resolver = SpaceTreePermissionResolver(db, space, user_id, documents)
    pinned_keys = get_pinned_node_keys(db, user_id, space_id)
    favorite_folder_ids = get_favorite_folder_ids(db, user_id)
    favorite_document_ids = get_favorite_document_ids(db, user_id)
    return _build_folder_tree(
        db,
        folders_by_parent,
        docs_by_folder,
        shortcuts_by_parent,
        None,
        user_id,
        resolver,
        pinned_keys,
        favorite_folder_ids,
        favorite_document_ids,
    )


def get_tree_pin_target(
    db: Session,
    payload: TreePinRequest,
    user_id: str,
) -> tuple[str, str, str | None]:
    if payload.node_type == "folder":
        folder = db.get(Folder, payload.node_id)
        if folder is None or folder.is_deleted:
            raise ValueError("Folder not found")
        if not can_view_folder(db, folder, user_id):
            raise PermissionError("Not allowed to pin folder")
        return folder.space_id, folder.id, folder.parent_folder_id
    if payload.node_type == "document":
        document = db.get(Document, payload.node_id)
        if document is None or document.is_deleted:
            raise ValueError("Document not found")
        if not can_view_document(db, document, user_id):
            raise PermissionError("Not allowed to pin document")
        return document.space_id, document.id, document.folder_id
    if payload.node_type == "shortcut":
        shortcut = db.get(TreeShortcut, payload.node_id)
        if shortcut is None or shortcut.is_deleted:
            raise ValueError("Shortcut not found")
        if shortcut.owner_user_id != user_id:
            raise PermissionError("Not allowed to pin shortcut")
        return shortcut.space_id, shortcut.id, shortcut.parent_folder_id
    raise ValueError("Unsupported node type")


def get_tree_node_actions(db: Session, node_type: str, node_id: str, user_id: str | None) -> TreeNodeActionsResponse:
    if node_type == "document":
        document = db.get(Document, node_id)
        if document is None or document.is_deleted:
            raise ValueError("Document not found")
        can_view = can_view_document(db, document, user_id)
        if not can_view:
            raise PermissionError("Not allowed to access document")
        can_manage = can_manage_document(db, document, user_id)
        return TreeNodeActionsResponse(
            node_type="document",
            node_id=document.id,
            can_open=True,
            can_share=permission_can_share_document(db, document, user_id),
            can_copy_link=True,
            can_duplicate=permission_can_copy_document(db, document, user_id),
            can_move=can_manage,
            can_create_shortcut=False,
            can_pin=True,
            can_favorite=True,
            can_transfer_owner=permission_can_transfer_document_owner(db, document, user_id),
            can_rename=can_manage,
            can_set_security=can_manage,
            can_delete=permission_can_delete_document(db, document, user_id),
        )

    if node_type == "folder":
        folder = db.get(Folder, node_id)
        if folder is None or folder.is_deleted:
            raise ValueError("Folder not found")
        can_view = can_view_folder(db, folder, user_id)
        if not can_view:
            raise PermissionError("Not allowed to access folder")
        can_manage = can_manage_folder(db, folder, user_id)
        has_children = db.scalar(
            select(Folder.id)
            .where(Folder.parent_folder_id == folder.id)
            .where(Folder.is_deleted.is_(False))
            .limit(1)
        ) or db.scalar(
            select(Document.id)
            .where(Document.folder_id == folder.id)
            .where(Document.is_deleted.is_(False))
            .limit(1)
        )
        return TreeNodeActionsResponse(
            node_type="folder",
            node_id=folder.id,
            can_open=True,
            can_share=False,
            can_copy_link=True,
            can_duplicate=False,
            can_move=can_manage,
            can_create_shortcut=False,
            can_pin=True,
            can_favorite=True,
            can_transfer_owner=False,
            can_rename=can_manage,
            can_set_security=False,
            can_delete=can_manage and not bool(has_children),
            delete_disabled_reason="请先移动或删除文件夹内内容" if can_manage and has_children else None,
        )

    if node_type == "shortcut":
        shortcut = db.get(TreeShortcut, node_id)
        if shortcut is None or shortcut.is_deleted:
            raise ValueError("Shortcut not found")
        if shortcut.owner_user_id != user_id:
            raise PermissionError("Not allowed to access shortcut")
        return TreeNodeActionsResponse(
            node_type="shortcut",
            node_id=shortcut.id,
            can_open=True,
            can_copy_link=True,
            can_move=False,
            can_pin=True,
            can_favorite=False,
            can_delete=True,
        )

    raise ValueError("Unsupported node type")


def pin_tree_node(db: Session, payload: TreePinRequest, user_id: str) -> TreePinResponse:
    space_id, node_id, parent_folder_id = get_tree_pin_target(db, payload, user_id)
    existing = db.scalar(
        select(UserTreePin)
        .where(UserTreePin.user_id == user_id)
        .where(UserTreePin.node_type == payload.node_type)
        .where(UserTreePin.node_id == node_id)
        .limit(1)
    )
    if existing is None:
        max_sort_order = db.scalar(
            select(func.max(UserTreePin.sort_order))
            .where(UserTreePin.user_id == user_id)
            .where(UserTreePin.space_id == space_id)
            .where(UserTreePin.parent_folder_id == parent_folder_id)
        ) or 0
        existing = UserTreePin(
            user_id=user_id,
            space_id=space_id,
            parent_folder_id=parent_folder_id,
            node_type=payload.node_type,
            node_id=node_id,
            sort_order=int(max_sort_order) + 1,
        )
        db.add(existing)
    else:
        existing.space_id = space_id
        existing.parent_folder_id = parent_folder_id
        existing.updated_at = datetime.now(timezone.utc)
    db.commit()
    return TreePinResponse(node_type=payload.node_type, node_id=node_id, is_pinned=True)


def unpin_tree_node(db: Session, payload: TreePinRequest, user_id: str) -> TreePinResponse:
    _, node_id, _ = get_tree_pin_target(db, payload, user_id)
    existing = db.scalar(
        select(UserTreePin)
        .where(UserTreePin.user_id == user_id)
        .where(UserTreePin.node_type == payload.node_type)
        .where(UserTreePin.node_id == node_id)
        .limit(1)
    )
    if existing is not None:
        db.delete(existing)
        db.commit()
    return TreePinResponse(node_type=payload.node_type, node_id=node_id, is_pinned=False)


def create_tree_shortcut(db: Session, payload: TreeShortcutCreateRequest, user_id: str) -> TreeNodeSummary:
    if payload.target_type == "folder":
        target_folder = db.get(Folder, payload.target_id)
        if target_folder is None or target_folder.is_deleted:
            raise ValueError("Target folder not found")
        if not can_view_folder(db, target_folder, user_id):
            raise PermissionError("Not allowed to create shortcut to this folder")
        space_id = target_folder.space_id
    elif payload.target_type == "document":
        target_document = db.get(Document, payload.target_id)
        if target_document is None or target_document.is_deleted:
            raise ValueError("Target document not found")
        if not can_view_document(db, target_document, user_id):
            raise PermissionError("Not allowed to create shortcut to this document")
        space_id = target_document.space_id
    else:
        raise ValueError("Unsupported shortcut target type")

    parent_folder_id = payload.parent_folder_id
    if parent_folder_id is not None:
        parent_folder = db.get(Folder, parent_folder_id)
        if parent_folder is None or parent_folder.is_deleted:
            raise ValueError("Parent folder not found")
        if parent_folder.space_id != space_id:
            raise ValueError("Shortcut parent folder must be in the target space")
        if not can_manage_folder(db, parent_folder, user_id):
            raise PermissionError("Not allowed to create shortcut in this folder")

    shortcut = TreeShortcut(
        owner_user_id=user_id,
        space_id=space_id,
        parent_folder_id=parent_folder_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        title_override=(payload.title_override.strip()[:255] if payload.title_override else None),
        sort_order=get_next_shortcut_sort_order(db, space_id, parent_folder_id),
    )
    db.add(shortcut)
    db.commit()
    db.refresh(shortcut)
    node = build_shortcut_tree_node(db, shortcut, user_id)
    if node is None:
        raise ValueError("Shortcut target is no longer available")
    return node


def delete_tree_shortcut(db: Session, shortcut_id: str, user_id: str) -> TreeNodeSummary | None:
    shortcut = db.get(TreeShortcut, shortcut_id)
    if shortcut is None or shortcut.is_deleted:
        return None
    if shortcut.owner_user_id != user_id:
        raise PermissionError("Not allowed to delete shortcut")
    node = build_shortcut_tree_node(db, shortcut, user_id)
    shortcut.is_deleted = True
    shortcut.updated_at = datetime.now(timezone.utc)
    db.commit()
    return node


def list_favorite_folders(db: Session, user_id: str) -> list[FolderSummary]:
    folders = db.scalars(
        select(Folder)
        .join(FolderFavorite, FolderFavorite.folder_id == Folder.id)
        .where(FolderFavorite.user_id == user_id)
        .where(Folder.is_deleted.is_(False))
        .order_by(FolderFavorite.updated_at.desc(), Folder.title.asc())
    ).all()
    return [
        build_folder_summary(db, folder, user_id)
        for folder in folders
        if can_view_folder(db, folder, user_id)
    ]


def favorite_folder(db: Session, folder_id: str, user_id: str) -> FolderFavoriteStatusResponse | None:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.is_deleted:
        return None
    if not can_view_folder(db, folder, user_id):
        raise PermissionError("Not allowed to favorite folder")
    existing = db.scalar(
        select(FolderFavorite)
        .where(FolderFavorite.user_id == user_id)
        .where(FolderFavorite.folder_id == folder_id)
        .limit(1)
    )
    if existing is None:
        db.add(FolderFavorite(user_id=user_id, folder_id=folder_id))
    else:
        existing.updated_at = datetime.now(timezone.utc)
    db.commit()
    publish_folder_event(db, "folder.favorited", folder, user_id)
    db.commit()
    return FolderFavoriteStatusResponse(folder_id=folder_id, is_favorited=True)


def unfavorite_folder(db: Session, folder_id: str, user_id: str) -> FolderFavoriteStatusResponse | None:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.is_deleted:
        return None
    if not can_view_folder(db, folder, user_id):
        raise PermissionError("Not allowed to unfavorite folder")
    existing = db.scalar(
        select(FolderFavorite)
        .where(FolderFavorite.user_id == user_id)
        .where(FolderFavorite.folder_id == folder_id)
        .limit(1)
    )
    if existing is not None:
        db.delete(existing)
        db.commit()
        publish_folder_event(db, "folder.unfavorited", folder, user_id)
        db.commit()
    return FolderFavoriteStatusResponse(folder_id=folder_id, is_favorited=False)


def get_folder_ancestors(db: Session, folder_id: str, user_id: str | None = None) -> list[AncestorItem]:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.is_deleted or not can_view_folder(db, folder, user_id):
        return []
    chain: list[AncestorItem] = []
    current = folder
    while current is not None:
        chain.append(AncestorItem(id=current.id, node_type="folder", title=current.title))
        if current.parent_folder_id is None:
            break
        current = db.get(Folder, current.parent_folder_id)
    chain.reverse()
    return chain


def get_document_ancestors(db: Session, document: Document, user_id: str | None = None) -> list[AncestorItem]:
    if not can_view_document(db, document, user_id):
        return []
    if not document.folder_id:
        return []
    return get_folder_ancestors(db, document.folder_id, user_id)


def ensure_default_newdoc_folders(db: Session) -> None:
    spaces = db.execute(select(Space.id, Space.owner_id)).all()
    for space_id, owner_id in spaces:
        if not db.scalar(select(Space.id).where(Space.id == space_id).limit(1)):
            continue
        if not db.scalar(select(User.id).where(User.id == owner_id).limit(1)):
            continue
        root_folder = db.scalar(
            select(Folder)
            .where(Folder.space_id == space_id)
            .where(Folder.parent_folder_id.is_(None))
            .where(Folder.title == "newdoc")
            .where(Folder.is_deleted.is_(False))
            .limit(1)
        )
        root_created_at = None
        if root_folder is None:
            root_folder = Folder(
                space_id=space_id,
                parent_folder_id=None,
                creator_id=owner_id,
                owner_id=owner_id,
                title="newdoc",
                visibility="private",
                icon="folder",
                sort_order=1,
            )
            db.add(root_folder)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                continue
            root_created_at = root_folder.created_at
        else:
            root_created_at = root_folder.created_at

        root_documents = db.scalars(
            select(Document)
            .where(Document.space_id == space_id)
            .where(Document.folder_id.is_(None))
            .where(Document.is_deleted.is_(False))
        ).all()
        for document in root_documents:
            if root_created_at and document.created_at and document.created_at > root_created_at:
                continue
            document.folder_id = root_folder.id
            document.sort_order = get_next_document_sort_order(db, space_id, root_folder.id)
    db.commit()


def move_folder(
    db: Session,
    folder_id: str,
    *,
    parent_folder_id: str | None,
    current_user_id: str,
) -> FolderSummary | None:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.is_deleted:
        return None
    if not can_manage_folder(db, folder, current_user_id):
        raise PermissionError("Not allowed to move folder")
    if parent_folder_id == folder.id:
        raise ValueError("Folder cannot be moved into itself")
    if is_descendant_folder(db, folder_id=folder.id, candidate_parent_id=parent_folder_id):
        raise ValueError("Folder cannot be moved into its descendant")

    parent_folder = None
    if parent_folder_id is not None:
        parent_folder = db.get(Folder, parent_folder_id)
        if parent_folder is None or parent_folder.is_deleted:
            raise ValueError("Target folder not found")
        if parent_folder.space_id != folder.space_id:
            raise ValueError("Target folder is outside of the folder space")
        if not can_manage_folder(db, parent_folder, current_user_id):
            raise PermissionError("Not allowed to move folder into target folder")

    folder.parent_folder_id = parent_folder_id
    folder.sort_order = get_next_folder_sort_order(db, folder.space_id, parent_folder_id)
    if parent_folder is not None:
        folder.visibility = parent_folder.visibility
        apply_folder_visibility_to_descendants(db, folder, parent_folder.visibility)
    folder.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(folder)
    publish_folder_event(db, "folder.moved", folder, current_user_id)
    db.commit()
    return build_folder_summary(db, folder, current_user_id)


def bulk_move_nodes(db: Session, payload: FolderBulkMoveRequest, current_user_id: str) -> None:
    target_folder = None
    if payload.target_folder_id is not None:
        target_folder = db.get(Folder, payload.target_folder_id)
        if target_folder is None or target_folder.is_deleted:
            raise ValueError("Target folder not found")
        if target_folder.space_id != payload.space_id:
            raise ValueError("Target folder is outside of the target space")
        if not can_manage_folder(db, target_folder, current_user_id):
            raise PermissionError("Not allowed to move into target folder")

    for folder_id in payload.folder_ids:
        move_folder(db, folder_id, parent_folder_id=payload.target_folder_id, current_user_id=current_user_id)

    for document_id in payload.document_ids:
        document = db.get(Document, document_id)
        if document is None or document.is_deleted:
            continue
        if not can_manage_document(db, document, current_user_id):
            raise PermissionError("Not allowed to move document")
        document.folder_id = payload.target_folder_id
        document.sort_order = get_next_document_sort_order(db, document.space_id, payload.target_folder_id)
        if target_folder is not None:
            document.visibility = target_folder.visibility
        document.updated_at = datetime.now(timezone.utc)

    db.commit()
    for folder_id in payload.folder_ids:
        folder = db.get(Folder, folder_id)
        if folder is not None:
            publish_folder_event(db, "folder.moved", folder, current_user_id)
    for document_id in payload.document_ids:
        document = db.get(Document, document_id)
        if document is not None:
            publish_document_event(db, "document.moved", document, current_user_id)
    db.commit()


def reorder_children(db: Session, payload: FolderReorderRequest, current_user_id: str) -> None:
    parent_folder = None
    if payload.parent_folder_id is not None:
        parent_folder = db.get(Folder, payload.parent_folder_id)
        if parent_folder is None or parent_folder.is_deleted:
            raise ValueError("Parent folder not found")
        if not can_manage_folder(db, parent_folder, current_user_id):
            raise PermissionError("Not allowed to reorder this folder")
    else:
        space = db.get(Space, payload.space_id)
        if space is None:
            raise ValueError("Space not found")
        if not can_manage_space(db, space, current_user_id):
            raise PermissionError("Not allowed to reorder this space")

    folder_statement = select(Folder).where(Folder.space_id == payload.space_id).where(Folder.is_deleted.is_(False))
    document_statement = select(Document).where(Document.space_id == payload.space_id).where(Document.is_deleted.is_(False))
    if payload.parent_folder_id is None:
        folder_statement = folder_statement.where(Folder.parent_folder_id.is_(None))
        document_statement = document_statement.where(Document.folder_id.is_(None))
    else:
        folder_statement = folder_statement.where(Folder.parent_folder_id == payload.parent_folder_id)
        document_statement = document_statement.where(Document.folder_id == payload.parent_folder_id)

    current_folders = db.scalars(folder_statement).all()
    current_documents = db.scalars(document_statement).all()
    current_nodes: dict[tuple[str, str], Folder | Document] = {
        **{("folder", folder.id): folder for folder in current_folders},
        **{("document", document.id): document for document in current_documents},
    }
    requested_keys = [(item.node_type, item.id) for item in payload.items]
    if len(requested_keys) != len(set(requested_keys)):
        raise ValueError("Duplicate reorder items")
    if set(requested_keys) != set(current_nodes.keys()):
        raise ValueError("Reorder items must exactly match the current folder children")

    now = datetime.now(timezone.utc)
    for next_order, key in enumerate(requested_keys, start=1):
        node = current_nodes[key]
        node.sort_order = next_order
        node.updated_at = now
    db.commit()
    for node in current_nodes.values():
        if isinstance(node, Folder):
            publish_folder_event(db, "folder.reordered", node, current_user_id)
        else:
            publish_document_event(db, "document.reordered", node, current_user_id)
    db.commit()
