from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import (
    Document,
    DocumentPermission,
    DocumentPermissionAuditLog,
    DocumentPermissionSettings,
)
from app.models.user import User
from app.schemas.permission import (
    DocumentCapabilities,
    DocumentPermissionAuditLogResponse,
    DocumentPermissionCreateRequest,
    DocumentPermissionResponse,
    DocumentPermissionSettingsResponse,
    DocumentPermissionSettingsUpdateRequest,
)
from app.services.permission_service import (
    can_copy_document,
    can_delete_document,
    can_edit_document,
    can_export_document,
    can_manage_document,
    can_comment_document,
    can_share_document,
    can_transfer_document_owner,
    can_view_document,
    get_effective_document_role,
    get_or_create_document_permission_settings,
    normalize_permission_level,
)
from app.services.event_stream_service import publish_document_event


VALID_PERMISSION_LEVELS = {"view", "comment", "edit", "full_access", "manage"}
VALID_SUBJECT_TYPES = {"user", "organization", "department", "group", "space_role"}
VALID_LINK_SHARE_SCOPES = {"closed", "tenant_readable", "tenant_editable", "anyone_readable"}
VALID_COMMENT_SCOPES = {"disabled", "can_view", "can_edit"}
VALID_OPERATION_SCOPES = {"disabled", "can_view", "can_edit", "full_access", "owner"}
VALID_SHARE_COLLABORATOR_SCOPES = {"owner", "full_access", "edit"}


def _permission_to_response(permission: DocumentPermission) -> DocumentPermissionResponse:
    return DocumentPermissionResponse(
        id=permission.id,
        document_id=permission.document_id,
        subject_type=permission.subject_type,
        subject_id=permission.subject_id,
        permission_level=normalize_permission_level(permission.permission_level),
        invited_by=permission.invited_by,
        notify=permission.notify,
        created_at=permission.created_at,
        updated_at=permission.updated_at,
    )


def _settings_to_response(settings: DocumentPermissionSettings) -> DocumentPermissionSettingsResponse:
    return DocumentPermissionSettingsResponse(
        document_id=settings.document_id,
        link_share_scope=settings.link_share_scope,
        external_access_enabled=settings.external_access_enabled,
        comment_scope=settings.comment_scope,
        share_collaborator_scope=settings.share_collaborator_scope,
        copy_scope=settings.copy_scope,
        export_scope=settings.export_scope,
        print_scope=settings.print_scope,
        download_scope=settings.download_scope,
        allow_search_index=settings.allow_search_index,
        watermark_enabled=settings.watermark_enabled,
        updated_by=settings.updated_by,
        updated_at=settings.updated_at,
    )


def create_permission_audit_log(
    db: Session,
    *,
    document_id: str,
    actor_id: str | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    before_json: dict[str, Any] | None = None,
    after_json: dict[str, Any] | None = None,
    reason: str | None = None,
) -> None:
    db.add(
        DocumentPermissionAuditLog(
            document_id=document_id,
            actor_id=actor_id,
            actor_type="user" if actor_id else "anonymous",
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_json=before_json,
            after_json=after_json,
            reason=reason,
        )
    )


def get_document_or_raise_permission(db: Session, document_id: str, user_id: str, *, manage: bool = False) -> Document:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        raise ValueError("Document not found")
    if manage:
        if not can_manage_document(db, document, user_id):
            raise PermissionError("Not allowed to manage document permissions")
    elif not can_view_document(db, document, user_id):
        raise PermissionError("Not allowed to view document permissions")
    return document


def get_document_capabilities(db: Session, document_id: str, user_id: str | None) -> DocumentCapabilities | None:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        return None
    return DocumentCapabilities(
        can_view=can_view_document(db, document, user_id),
        can_edit=can_edit_document(db, document, user_id) and document.document_type != "pdf",
        can_comment=can_comment_document(db, document, user_id),
        can_manage_permissions=can_manage_document(db, document, user_id),
        can_share=can_share_document(db, document, user_id),
        can_copy=can_copy_document(db, document, user_id),
        can_export=can_export_document(db, document, user_id),
        can_delete=can_delete_document(db, document, user_id),
        can_transfer_owner=can_transfer_document_owner(db, document, user_id),
        effective_role=get_effective_document_role(db, document, user_id),
    )


def get_permission_settings(
    db: Session,
    document_id: str,
    user_id: str,
) -> DocumentPermissionSettingsResponse:
    get_document_or_raise_permission(db, document_id, user_id)
    settings = get_or_create_document_permission_settings(db, document_id)
    db.commit()
    db.refresh(settings)
    return _settings_to_response(settings)


def update_permission_settings(
    db: Session,
    document_id: str,
    payload: DocumentPermissionSettingsUpdateRequest,
    user_id: str,
) -> DocumentPermissionSettingsResponse:
    get_document_or_raise_permission(db, document_id, user_id, manage=True)
    settings = get_or_create_document_permission_settings(db, document_id)
    before = _settings_to_response(settings).model_dump(mode="json")

    updates = payload.model_dump(exclude_unset=True)
    if "link_share_scope" in updates and updates["link_share_scope"] not in VALID_LINK_SHARE_SCOPES:
        raise ValueError("Invalid link share scope")
    if "comment_scope" in updates and updates["comment_scope"] not in VALID_COMMENT_SCOPES:
        raise ValueError("Invalid comment scope")
    if "share_collaborator_scope" in updates and updates["share_collaborator_scope"] not in VALID_SHARE_COLLABORATOR_SCOPES:
        raise ValueError("Invalid collaborator management scope")
    for key in {"copy_scope", "export_scope", "print_scope", "download_scope"}:
        if key in updates and updates[key] not in VALID_OPERATION_SCOPES:
            raise ValueError(f"Invalid {key}")
    for key, value in updates.items():
        setattr(settings, key, value)
    settings.updated_by = user_id
    settings.updated_at = datetime.now(timezone.utc)
    after = _settings_to_response(settings).model_dump(mode="json")
    create_permission_audit_log(
        db,
        document_id=document_id,
        actor_id=user_id,
        action="permission_settings.updated",
        target_type="permission_settings",
        target_id=document_id,
        before_json=before,
        after_json=after,
    )
    db.commit()
    document = db.get(Document, document_id)
    if document is not None:
        publish_document_event(db, "document.permission_changed", document, user_id)
        db.commit()
    db.refresh(settings)
    return _settings_to_response(settings)


def list_document_permissions(db: Session, document_id: str, user_id: str) -> list[DocumentPermissionResponse]:
    get_document_or_raise_permission(db, document_id, user_id, manage=True)
    rows = db.scalars(
        select(DocumentPermission)
        .where(DocumentPermission.document_id == document_id)
        .order_by(DocumentPermission.created_at.asc())
    ).all()
    return [_permission_to_response(row) for row in rows]


def upsert_document_permission(
    db: Session,
    document_id: str,
    payload: DocumentPermissionCreateRequest,
    user_id: str,
) -> DocumentPermissionResponse:
    document = get_document_or_raise_permission(db, document_id, user_id, manage=True)
    if payload.subject_type not in VALID_SUBJECT_TYPES:
        raise ValueError("Invalid subject type")
    if payload.subject_type == "user" and payload.subject_id == document.owner_id:
        raise ValueError("Document owner already has owner permission")
    permission_level = normalize_permission_level(payload.permission_level)
    if permission_level not in VALID_PERMISSION_LEVELS:
        raise ValueError("Invalid permission level")
    if payload.subject_type == "user" and db.get(User, payload.subject_id) is None:
        raise ValueError("Target user not found")

    permission = db.scalar(
        select(DocumentPermission)
        .where(DocumentPermission.document_id == document_id)
        .where(DocumentPermission.subject_type == payload.subject_type)
        .where(DocumentPermission.subject_id == payload.subject_id)
        .limit(1)
    )
    before = _permission_to_response(permission).model_dump(mode="json") if permission else None
    if permission is None:
        permission = DocumentPermission(
            document_id=document_id,
            subject_type=payload.subject_type,
            subject_id=payload.subject_id,
            permission_level=permission_level,
            invited_by=user_id,
            notify=payload.notify,
        )
        db.add(permission)
        action = "permission.created"
    else:
        permission.permission_level = permission_level
        permission.notify = payload.notify
        permission.updated_at = datetime.now(timezone.utc)
        action = "permission.updated"
    db.flush()
    after = _permission_to_response(permission).model_dump(mode="json")
    create_permission_audit_log(
        db,
        document_id=document_id,
        actor_id=user_id,
        action=action,
        target_type="permission",
        target_id=permission.id,
        before_json=before,
        after_json=after,
    )
    db.commit()
    publish_document_event(db, "document.permission_changed", document, user_id)
    db.commit()
    db.refresh(permission)
    return _permission_to_response(permission)


def update_document_permission(
    db: Session,
    document_id: str,
    permission_id: str,
    permission_level: str,
    user_id: str,
) -> DocumentPermissionResponse | None:
    get_document_or_raise_permission(db, document_id, user_id, manage=True)
    normalized = normalize_permission_level(permission_level)
    if normalized not in VALID_PERMISSION_LEVELS:
        raise ValueError("Invalid permission level")
    permission = db.get(DocumentPermission, permission_id)
    if permission is None or permission.document_id != document_id:
        return None
    before = _permission_to_response(permission).model_dump(mode="json")
    permission.permission_level = normalized
    permission.updated_at = datetime.now(timezone.utc)
    after = _permission_to_response(permission).model_dump(mode="json")
    create_permission_audit_log(
        db,
        document_id=document_id,
        actor_id=user_id,
        action="permission.updated",
        target_type="permission",
        target_id=permission.id,
        before_json=before,
        after_json=after,
    )
    db.commit()
    document = db.get(Document, document_id)
    if document is not None:
        publish_document_event(db, "document.permission_changed", document, user_id)
        db.commit()
    db.refresh(permission)
    return _permission_to_response(permission)


def delete_document_permission(db: Session, document_id: str, permission_id: str, user_id: str) -> bool:
    get_document_or_raise_permission(db, document_id, user_id, manage=True)
    permission = db.get(DocumentPermission, permission_id)
    if permission is None or permission.document_id != document_id:
        return False
    before = _permission_to_response(permission).model_dump(mode="json")
    db.delete(permission)
    create_permission_audit_log(
        db,
        document_id=document_id,
        actor_id=user_id,
        action="permission.deleted",
        target_type="permission",
        target_id=permission_id,
        before_json=before,
        after_json=None,
    )
    db.commit()
    document = db.get(Document, document_id)
    if document is not None:
        publish_document_event(db, "document.permission_changed", document, user_id)
        db.commit()
    return True


def transfer_document_owner(db: Session, document_id: str, new_owner_id: str, user_id: str) -> None:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        raise ValueError("Document not found")
    if not can_transfer_document_owner(db, document, user_id):
        raise PermissionError("Not allowed to transfer owner")
    if db.get(User, new_owner_id) is None:
        raise ValueError("New owner not found")
    before = {"owner_id": document.owner_id}
    document.owner_id = new_owner_id
    document.updated_at = datetime.now(timezone.utc)
    create_permission_audit_log(
        db,
        document_id=document_id,
        actor_id=user_id,
        action="owner.transferred",
        target_type="document",
        target_id=document_id,
        before_json=before,
        after_json={"owner_id": new_owner_id},
    )
    db.commit()
    publish_document_event(db, "document.permission_changed", document, user_id)
    db.commit()


def list_permission_audit_logs(db: Session, document_id: str, user_id: str) -> list[DocumentPermissionAuditLogResponse]:
    get_document_or_raise_permission(db, document_id, user_id, manage=True)
    rows = db.scalars(
        select(DocumentPermissionAuditLog)
        .where(DocumentPermissionAuditLog.document_id == document_id)
        .order_by(DocumentPermissionAuditLog.created_at.desc())
        .limit(100)
    ).all()
    return [
        DocumentPermissionAuditLogResponse(
            id=row.id,
            document_id=row.document_id,
            actor_id=row.actor_id,
            actor_type=row.actor_type,
            action=row.action,
            target_type=row.target_type,
            target_id=row.target_id,
            before_json=row.before_json,
            after_json=row.after_json,
            reason=row.reason,
            created_at=row.created_at,
        )
        for row in rows
    ]
