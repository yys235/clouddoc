from datetime import timezone, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentPermission
from app.models.folder import Folder
from app.models.organization import OrganizationMember
from app.models.space import Space
from app.schemas.folder import (
    AncestorItem,
    FolderBulkMoveRequest,
    FolderChildrenResponse,
    FolderCreateRequest,
    FolderReorderRequest,
    FolderSummary,
    TreeNodeSummary,
)


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


def can_access_space(db: Session, space: Space, user_id: str | None) -> bool:
    if space.visibility == "public":
        return True
    if user_id is None:
        return False
    if space.owner_id == user_id:
        return True
    if space.organization_id is None:
        return False
    membership = db.scalar(
        select(OrganizationMember.id)
        .where(OrganizationMember.organization_id == space.organization_id)
        .where(OrganizationMember.user_id == user_id)
        .where(OrganizationMember.status == "active")
        .limit(1)
    )
    return membership is not None


def can_manage_space(db: Session, space: Space, user_id: str | None) -> bool:
    if user_id is None:
        return False
    if space.owner_id == user_id:
        return True
    if space.organization_id is None:
        return False
    membership = db.scalar(
        select(OrganizationMember.role)
        .where(OrganizationMember.organization_id == space.organization_id)
        .where(OrganizationMember.user_id == user_id)
        .where(OrganizationMember.status == "active")
        .limit(1)
    )
    return membership in {"owner", "admin", "member"}


def get_document_permission_levels(db: Session, document_id: str, user_id: str | None) -> set[str]:
    if not user_id:
        return set()
    organization_ids = get_user_organization_ids(db, user_id)
    statement = select(DocumentPermission.permission_level).where(DocumentPermission.document_id == document_id)
    filters = [(DocumentPermission.subject_type == "user") & (DocumentPermission.subject_id == user_id)]
    if organization_ids:
        filters.append(
            (DocumentPermission.subject_type == "organization")
            & (DocumentPermission.subject_id.in_(organization_ids))
        )
    return set(db.scalars(statement.where(or_(*filters))).all())


def can_view_document(db: Session, document: Document, user_id: str | None) -> bool:
    if document.is_deleted:
        return False
    if user_id is None:
        return False
    return document.owner_id == user_id or document.creator_id == user_id


def can_manage_document(db: Session, document: Document, user_id: str | None) -> bool:
    if user_id is None:
        return False
    return document.owner_id == user_id or document.creator_id == user_id


def can_view_folder(db: Session, folder: Folder, user_id: str | None) -> bool:
    if folder.is_deleted:
        return False
    if folder.visibility == "public":
        return True
    space = db.get(Space, folder.space_id)
    return can_access_space(db, space, user_id) if space else False


def can_manage_folder(db: Session, folder: Folder, user_id: str | None) -> bool:
    if user_id is None:
        return False
    if folder.owner_id == user_id:
        return True
    space = db.get(Space, folder.space_id)
    return can_manage_space(db, space, user_id) if space else False


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
    )


def build_folder_tree_node(db: Session, folder: Folder, user_id: str | None) -> TreeNodeSummary:
    return TreeNodeSummary(
        id=folder.id,
        node_type="folder",
        title=folder.title,
        space_id=folder.space_id,
        parent_folder_id=folder.parent_folder_id,
        sort_order=folder.sort_order,
        visibility=folder.visibility,
        updated_at=folder.updated_at,
        can_manage=can_manage_folder(db, folder, user_id),
        document_type=None,
        is_deleted=folder.is_deleted,
        children=[],
    )


def build_document_tree_node(db: Session, document: Document, user_id: str | None) -> TreeNodeSummary:
    return TreeNodeSummary(
        id=document.id,
        node_type="document",
        title=document.title,
        space_id=document.space_id,
        parent_folder_id=document.folder_id,
        sort_order=document.sort_order,
        visibility=document.visibility,
        updated_at=document.updated_at,
        can_manage=can_manage_document(db, document, user_id),
        document_type=document.document_type,
        is_deleted=document.is_deleted,
        children=[],
    )


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
    return build_folder_summary(db, folder, current_user_id)


def list_space_root_children(db: Session, space_id: str, user_id: str | None = None) -> FolderChildrenResponse:
    ensure_default_newdoc_folders(db)
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

    children: list[TreeNodeSummary] = [
        build_folder_tree_node(db, folder, user_id)
        for folder in folders
        if can_view_folder(db, folder, user_id)
    ]
    children.extend(
        build_document_tree_node(db, document, user_id)
        for document in documents
        if can_view_document(db, document, user_id)
    )
    return FolderChildrenResponse(folder=None, children=children)


def list_folder_children(db: Session, folder_id: str, user_id: str | None = None) -> FolderChildrenResponse | None:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.is_deleted:
        return None
    if not can_view_folder(db, folder, user_id):
        raise PermissionError("Not allowed to access this folder")

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
    children: list[TreeNodeSummary] = [
        build_folder_tree_node(db, child, user_id)
        for child in folders
        if can_view_folder(db, child, user_id)
    ]
    children.extend(
        build_document_tree_node(db, document, user_id)
        for document in documents
        if can_view_document(db, document, user_id)
    )
    return FolderChildrenResponse(
        folder=build_folder_summary(db, folder, user_id),
        children=children,
    )


def _build_folder_tree(db: Session, folders_by_parent: dict[str | None, list[Folder]], docs_by_folder: dict[str | None, list[Document]], parent_id: str | None, user_id: str | None) -> list[TreeNodeSummary]:
    nodes: list[TreeNodeSummary] = []
    for folder in folders_by_parent.get(parent_id, []):
        if not can_view_folder(db, folder, user_id):
            continue
        node = build_folder_tree_node(db, folder, user_id)
        node.children = _build_folder_tree(db, folders_by_parent, docs_by_folder, folder.id, user_id)
        nodes.append(node)
    for document in docs_by_folder.get(parent_id, []):
        if not can_view_document(db, document, user_id):
            continue
        nodes.append(build_document_tree_node(db, document, user_id))
    return nodes


def get_space_tree(db: Session, space_id: str, user_id: str | None = None) -> list[TreeNodeSummary]:
    ensure_default_newdoc_folders(db)
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
    folders_by_parent: dict[str | None, list[Folder]] = {}
    docs_by_folder: dict[str | None, list[Document]] = {}
    for folder in folders:
        folders_by_parent.setdefault(folder.parent_folder_id, []).append(folder)
    for document in documents:
        docs_by_folder.setdefault(document.folder_id, []).append(document)
    return _build_folder_tree(db, folders_by_parent, docs_by_folder, None, user_id)


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
    spaces = db.scalars(select(Space)).all()
    for space in spaces:
        root_folder = db.scalar(
            select(Folder)
            .where(Folder.space_id == space.id)
            .where(Folder.parent_folder_id.is_(None))
            .where(Folder.title == "newdoc")
            .where(Folder.is_deleted.is_(False))
            .limit(1)
        )
        root_created_at = None
        if root_folder is None:
            root_folder = Folder(
                space_id=space.id,
                parent_folder_id=None,
                creator_id=space.owner_id,
                owner_id=space.owner_id,
                title="newdoc",
                visibility="private",
                icon="folder",
                sort_order=1,
            )
            db.add(root_folder)
            db.flush()
            root_created_at = root_folder.created_at
        else:
            root_created_at = root_folder.created_at

        root_documents = db.scalars(
            select(Document)
            .where(Document.space_id == space.id)
            .where(Document.folder_id.is_(None))
            .where(Document.is_deleted.is_(False))
        ).all()
        for document in root_documents:
            if root_created_at and document.created_at and document.created_at > root_created_at:
                continue
            document.folder_id = root_folder.id
            document.sort_order = get_next_document_sort_order(db, space.id, root_folder.id)
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

    next_order = 1
    for item in payload.items:
        if item.node_type == "folder":
            folder = db.get(Folder, item.id)
            if folder is None or folder.is_deleted:
                continue
            if folder.space_id != payload.space_id or folder.parent_folder_id != payload.parent_folder_id:
                continue
            folder.sort_order = next_order
            folder.updated_at = datetime.now(timezone.utc)
            next_order += 1
        elif item.node_type == "document":
            document = db.get(Document, item.id)
            if document is None or document.is_deleted:
                continue
            if document.space_id != payload.space_id or document.folder_id != payload.parent_folder_id:
                continue
            document.sort_order = next_order
            document.updated_at = datetime.now(timezone.utc)
            next_order += 1
    db.commit()
