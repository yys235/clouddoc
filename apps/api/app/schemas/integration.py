from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


DEFAULT_TOKEN_SCOPES = ["documents:read", "folders:read", "comments:read", "search:read"]


class TokenCreateRequest(BaseModel):
    name: str = "AI Token"
    scopes: list[str] = Field(default_factory=lambda: DEFAULT_TOKEN_SCOPES.copy())
    expires_at: datetime | None = None
    integration_id: str | None = None


class TokenUpdateRequest(BaseModel):
    name: str | None = None
    scopes: list[str] | None = None
    expires_at: datetime | None = None
    revoked: bool | None = None


class TokenSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    integration_id: str | None = None
    user_id: str
    token_type: str
    token_prefix: str
    name: str
    scopes: list[str]
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    last_used_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TokenCreateResponse(BaseModel):
    token: str
    token_summary: TokenSummary


class IntegrationCreateRequest(BaseModel):
    name: str
    description: str | None = None
    icon_url: str | None = None
    organization_id: str | None = None


class IntegrationUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    icon_url: str | None = None
    status: str | None = None


class IntegrationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str | None = None
    created_by: str
    name: str
    description: str | None = None
    icon_url: str | None = None
    status: str
    client_id: str
    created_at: datetime
    updated_at: datetime


class IntegrationScopeCreateRequest(BaseModel):
    resource_type: str
    resource_id: str | None = None
    include_children: bool = False
    permission_level: str = "view"


class IntegrationScopeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    integration_id: str
    resource_type: str
    resource_id: str | None = None
    include_children: bool
    permission_level: str
    created_by: str
    created_at: datetime
    updated_at: datetime


class IntegrationAuditLogSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    integration_id: str | None = None
    token_id: str | None = None
    actor_id: str | None = None
    actor_type: str
    source: str
    operation: str
    target_type: str | None = None
    target_id: str | None = None
    request_summary: dict[str, Any]
    response_status: str
    error_message: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime
    updated_at: datetime


class IntegrationWebhookCreateRequest(BaseModel):
    url: str
    event_types: list[str] = Field(default_factory=list)


class IntegrationWebhookUpdateRequest(BaseModel):
    event_types: list[str] | None = None
    status: str | None = None


class IntegrationWebhookSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    integration_id: str
    url: str
    event_types: list[str]
    status: str
    created_at: datetime
    updated_at: datetime


class IntegrationWebhookCreateResponse(BaseModel):
    secret: str
    webhook: IntegrationWebhookSummary


class IntegrationWebhookDeliverySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    webhook_id: str
    event_type: str
    payload: dict[str, Any]
    response_status: str | None = None
    attempt_count: int
    next_retry_at: datetime | None = None
    delivered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class MarkdownDocumentCreateRequest(BaseModel):
    title: str = "Untitled"
    markdown: str
    space_id: str
    folder_id: str | None = None
    visibility: str = "private"


class MarkdownDocumentUpdateRequest(BaseModel):
    markdown: str
    title: str | None = None
