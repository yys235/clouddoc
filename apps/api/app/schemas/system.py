from datetime import datetime

from pydantic import BaseModel, Field


class BootstrapCheck(BaseModel):
    key: str
    status: str
    message: str


class BootstrapStatusResponse(BaseModel):
    initialized: bool
    needs_setup: bool
    has_super_admin: bool
    database_ok: bool
    schema_ok: bool
    uploads_ok: bool
    setup_allowed: bool
    app_env: str
    api_version: str = "0.1.0"
    checks: list[BootstrapCheck]


class BootstrapInitializeRequest(BaseModel):
    setup_token: str | None = Field(default=None, max_length=512)
    admin_name: str = Field(min_length=1, max_length=120)
    admin_email: str = Field(min_length=3, max_length=255)
    admin_password: str = Field(min_length=8, max_length=128)
    organization_name: str = Field(min_length=1, max_length=120)
    space_name: str = Field(min_length=1, max_length=120)
    space_visibility: str = "organization"
    allow_public_documents: bool = True
    allow_share_links: bool = True
    share_password_required_by_default: bool = False
    allow_guest_public_read: bool = True
    allow_user_pat: bool = True
    allow_open_api: bool = True
    import_demo_data: bool = False


class BootstrapInitializeResponse(BaseModel):
    initialized: bool
    admin_user_id: str
    organization_id: str
    space_id: str
    next_url: str = "/documents"
    initialized_at: datetime


class SystemAuditLogResponse(BaseModel):
    id: str
    actor_type: str
    actor_id: str | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    payload: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class SystemSettingsSummaryResponse(BaseModel):
    id: str
    product_name: str
    initialized: bool
    initialized_at: datetime | None = None
    initialized_by: str | None = None
    initialized_by_email: str | None = None
    allow_demo_data: bool
    allow_public_documents: bool
    allow_share_links: bool
    share_password_required_by_default: bool
    allow_guest_public_read: bool
    allow_user_pat: bool
    allow_open_api: bool
    setup_enabled: bool
    app_env: str
    recent_audit_logs: list[SystemAuditLogResponse]
