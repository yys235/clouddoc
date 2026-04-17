from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DocumentCapabilities(BaseModel):
    can_view: bool
    can_edit: bool
    can_comment: bool
    can_manage_permissions: bool
    can_share: bool
    can_copy: bool
    can_export: bool
    can_delete: bool
    can_transfer_owner: bool
    effective_role: str
    access_mode: str = "document"


class DocumentPermissionSettingsResponse(BaseModel):
    document_id: str
    link_share_scope: str
    external_access_enabled: bool
    comment_scope: str
    share_collaborator_scope: str
    copy_scope: str
    export_scope: str
    print_scope: str
    download_scope: str
    allow_search_index: bool
    watermark_enabled: bool
    updated_by: str | None = None
    updated_at: datetime


class DocumentPermissionSettingsUpdateRequest(BaseModel):
    link_share_scope: str | None = None
    external_access_enabled: bool | None = None
    comment_scope: str | None = None
    share_collaborator_scope: str | None = None
    copy_scope: str | None = None
    export_scope: str | None = None
    print_scope: str | None = None
    download_scope: str | None = None
    allow_search_index: bool | None = None
    watermark_enabled: bool | None = None


class DocumentPermissionResponse(BaseModel):
    id: str
    document_id: str
    subject_type: str
    subject_id: str
    permission_level: str
    invited_by: str | None = None
    notify: bool
    created_at: datetime
    updated_at: datetime


class DocumentPermissionCreateRequest(BaseModel):
    subject_type: str = "user"
    subject_id: str
    permission_level: str = "view"
    notify: bool = False


class DocumentPermissionBatchCreateRequest(BaseModel):
    permissions: list[DocumentPermissionCreateRequest]


class DocumentPermissionUpdateRequest(BaseModel):
    permission_level: str


class OwnerTransferRequest(BaseModel):
    new_owner_id: str


class DocumentPermissionAuditLogResponse(BaseModel):
    id: str
    document_id: str
    actor_id: str | None
    actor_type: str
    action: str
    target_type: str | None
    target_id: str | None
    before_json: dict[str, Any] | None
    after_json: dict[str, Any] | None
    reason: str | None
    created_at: datetime
