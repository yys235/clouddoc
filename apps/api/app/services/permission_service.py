from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.comment import Comment
from app.models.document import Document
from app.models.folder import Folder
from app.models.organization import OrganizationMember
from app.models.space import Space
from app.services.actor_context import ActorContext, ensure_actor


ActorLike = ActorContext | str | None


def actor_user_id(actor: ActorLike) -> str | None:
    return ensure_actor(actor).user_id


def is_document_owner(document: Document, actor: ActorLike) -> bool:
    user_id = actor_user_id(actor)
    return bool(user_id) and (document.owner_id == user_id or document.creator_id == user_id)


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


def can_access_space(db: Session, space: Space, actor: ActorLike) -> bool:
    user_id = actor_user_id(actor)
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
    return is_document_owner(document, actor)


def can_edit_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return is_document_owner(document, actor)


def can_manage_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return is_document_owner(document, actor)


def can_comment_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return can_edit_document(db, document, actor)


def can_mcp_read_document(db: Session, document: Document, actor: ActorLike) -> bool:
    if document.is_deleted:
        return is_document_owner(document, actor)
    return document.visibility == "public" or is_document_owner(document, actor)


def can_mcp_write_document(db: Session, document: Document, actor: ActorLike) -> bool:
    return not document.is_deleted and is_document_owner(document, actor)


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
