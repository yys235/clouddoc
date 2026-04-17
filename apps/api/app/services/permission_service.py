from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session
from types import SimpleNamespace

from app.models.comment import Comment
from app.models.document import Document, DocumentPermission, DocumentPermissionSettings
from app.models.folder import Folder
from app.models.organization import OrganizationMember
from app.models.space import Space
from app.models.user import User
from app.services.actor_context import ActorContext, ensure_actor


ActorLike = ActorContext | str | None
ROLE_RANK = {
    "none": 0,
    "view": 10,
    "comment": 20,
    "edit": 30,
    "manage": 40,
    "full_access": 40,
    "owner": 50,
}
SETTINGS_SCOPE_RANK = {
    "disabled": 999,
    "can_view": ROLE_RANK["view"],
    "can_comment": ROLE_RANK["comment"],
    "can_edit": ROLE_RANK["edit"],
    "full_access": ROLE_RANK["full_access"],
    "owner": ROLE_RANK["owner"],
}


def normalize_permission_level(level: str | None) -> str:
    if level == "manage":
        return "full_access"
    if level in ROLE_RANK:
        return level or "none"
    return "none"


def role_at_least(role: str, required: str) -> bool:
    return ROLE_RANK.get(normalize_permission_level(role), 0) >= ROLE_RANK.get(normalize_permission_level(required), 0)


def get_or_create_document_permission_settings(db: Session, document_id: str) -> DocumentPermissionSettings:
    settings = db.scalar(
        select(DocumentPermissionSettings).where(DocumentPermissionSettings.document_id == document_id).limit(1)
    )
    if settings is None:
        settings = DocumentPermissionSettings(document_id=document_id)
        db.add(settings)
        db.flush()
    return settings


def get_document_permission_settings(db: Session, document_id: str):
    settings = db.scalar(
        select(DocumentPermissionSettings).where(DocumentPermissionSettings.document_id == document_id).limit(1)
    )
    if settings is not None:
        return settings
    return SimpleNamespace(
        document_id=document_id,
        link_share_scope="closed",
        external_access_enabled=False,
        comment_scope="can_edit",
        share_collaborator_scope="full_access",
        copy_scope="can_view",
        export_scope="full_access",
        print_scope="full_access",
        download_scope="full_access",
        allow_search_index=False,
        watermark_enabled=False,
        updated_by=None,
    )


def get_document_member_role(db: Session, document: Document, actor: ActorLike) -> str:
    user_id = actor_user_id(actor)
    if not user_id:
        return "none"
    organization_ids = get_user_organization_ids(db, actor)
    filters = [(DocumentPermission.subject_type == "user") & (DocumentPermission.subject_id == user_id)]
    if organization_ids:
        filters.append(
            (DocumentPermission.subject_type == "organization")
            & (DocumentPermission.subject_id.in_(organization_ids))
        )
    permissions = db.scalars(
        select(DocumentPermission.permission_level)
        .where(DocumentPermission.document_id == document.id)
        .where(*[])
        .where(filters[0] if len(filters) == 1 else filters[0] | filters[1])
    ).all()
    best = "none"
    for permission in permissions:
        normalized = normalize_permission_level(permission)
        if ROLE_RANK[normalized] > ROLE_RANK[best]:
            best = normalized
    return best


def get_effective_document_role(db: Session, document: Document, actor: ActorLike) -> str:
    if document.is_deleted:
        return "none"
    if is_document_owner(document, actor):
        return "owner"
    if is_organization_admin_for_document(db, document, actor):
        return "view"
    member_role = get_document_member_role(db, document, actor)
    if member_role != "none":
        return member_role
    if document.visibility == "public":
        return "view"
    return "none"


def setting_allows(settings_value: str, role: str) -> bool:
    if settings_value == "disabled":
        return False
    required_rank = SETTINGS_SCOPE_RANK.get(settings_value, ROLE_RANK["owner"])
    return ROLE_RANK.get(normalize_permission_level(role), 0) >= required_rank


def actor_user_id(actor: ActorLike) -> str | None:
    return ensure_actor(actor).user_id


def is_document_owner(document: Document, actor: ActorLike) -> bool:
    user_id = actor_user_id(actor)
    return bool(user_id) and (document.owner_id == user_id or document.creator_id == user_id)


def is_system_admin(db: Session, actor: ActorLike) -> bool:
    user_id = actor_user_id(actor)
    if not user_id:
        return False
    user = db.get(User, user_id)
    return bool(user and user.is_active and user.is_super_admin)


def get_user_organization_ids(db: Session, actor: ActorLike) -> set[str]:
    user_id = actor_user_id(actor)
    if not user_id:
        return set()
    return set(
        db.scalars(
            select(OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user_id)
            .where(OrganizationMember.status == "active")
        ).all()
    )


def get_organization_role(db: Session, organization_id: str | None, actor: ActorLike) -> str | None:
    user_id = actor_user_id(actor)
    if not user_id or not organization_id:
        return None
    return db.scalar(
        select(OrganizationMember.role)
        .where(OrganizationMember.organization_id == organization_id)
        .where(OrganizationMember.user_id == user_id)
        .where(OrganizationMember.status == "active")
        .limit(1)
    )


def is_organization_admin_for_space(db: Session, space: Space, actor: ActorLike) -> bool:
    if is_system_admin(db, actor):
        return True
    return get_organization_role(db, space.organization_id, actor) in {"owner", "admin"}


def is_organization_admin_for_document(db: Session, document: Document, actor: ActorLike) -> bool:
    if is_system_admin(db, actor):
        return True
    space = db.get(Space, document.space_id)
    if space is None:
        return False
    return is_organization_admin_for_space(db, space, actor)


def can_access_space(db: Session, space: Space, actor: ActorLike) -> bool:
    user_id = actor_user_id(actor)
    if is_system_admin(db, actor):
        return True
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


def can_manage_space(db: Session, space: Space, actor: ActorLike) -> bool:
    user_id = actor_user_id(actor)
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


def can_view_document(db: Session, document: Document, actor: ActorLike) -> bool:
    if document.is_deleted:
        return False
    return role_at_least(get_effective_document_role(db, document, actor), "view")


def can_edit_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return not document.is_deleted and role_at_least(get_effective_document_role(db, document, actor), "edit")


def can_manage_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return not document.is_deleted and role_at_least(get_effective_document_role(db, document, actor), "full_access")


def can_comment_document(db: Session, document: Document, actor: ActorLike) -> bool:
    if document.is_deleted:
        return False
    role = get_effective_document_role(db, document, actor)
    settings = get_document_permission_settings(db, document.id)
    return setting_allows(settings.comment_scope, role)


def can_copy_document(db: Session, document: Document, actor: ActorLike) -> bool:
    role = get_effective_document_role(db, document, actor)
    settings = get_document_permission_settings(db, document.id)
    return setting_allows(settings.copy_scope, role)


def can_export_document(db: Session, document: Document, actor: ActorLike) -> bool:
    role = get_effective_document_role(db, document, actor)
    settings = get_document_permission_settings(db, document.id)
    return setting_allows(settings.export_scope, role)


def can_share_document(db: Session, document: Document, actor: ActorLike) -> bool:
    role = get_effective_document_role(db, document, actor)
    settings = get_document_permission_settings(db, document.id)
    return setting_allows(settings.share_collaborator_scope, role)


def can_delete_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return can_manage_document(db, document, actor)


def can_transfer_document_owner(db: Session, document: Document, actor: ActorLike) -> bool:
    return not document.is_deleted and is_document_owner(document, actor)


def can_mcp_read_document(db: Session, document: Document, actor: ActorLike) -> bool:
    if document.is_deleted:
        return is_document_owner(document, actor) or is_organization_admin_for_document(db, document, actor)
    return (
        document.visibility == "public"
        or is_document_owner(document, actor)
        or is_organization_admin_for_document(db, document, actor)
        or role_at_least(get_document_member_role(db, document, actor), "view")
    )


def can_mcp_write_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return can_edit_document(db, document, actor)


def can_mcp_manage_deleted_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return is_document_owner(document, actor)


def can_mcp_update_comment(db: Session, comment: Comment, actor: ActorLike) -> bool:
    user_id = actor_user_id(actor)
    if not user_id or comment.is_deleted or comment.author_id != user_id:
        return False
    document = db.get(Document, comment.document_id)
    return bool(document and can_mcp_write_document(db, document, actor))


def can_mcp_delete_comment(db: Session, comment: Comment, actor: ActorLike) -> bool:
    return can_mcp_update_comment(db, comment, actor)


def can_view_folder(db: Session, folder: Folder, actor: ActorLike) -> bool:
    if folder.is_deleted:
        return False
    if is_system_admin(db, actor):
        return True
    if folder.visibility == "public":
        return True
    space = db.get(Space, folder.space_id)
    return can_access_space(db, space, actor) if space else False


def can_manage_folder(db: Session, folder: Folder, actor: ActorLike) -> bool:
    user_id = actor_user_id(actor)
    if user_id is None:
        return False
    if folder.owner_id == user_id:
        return True
    space = db.get(Space, folder.space_id)
    return can_manage_space(db, space, actor) if space else False
