from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Integration(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integrations"

    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    client_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    oauth_enabled: Mapped[bool] = mapped_column(default=False)
    redirect_uris: Mapped[list] = mapped_column(JSONB, default=list)
    client_secret_prefix: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    client_secret_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)


class IntegrationToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_tokens"

    integration_id: Mapped[str | None] = mapped_column(ForeignKey("integrations.id"), nullable=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_type: Mapped[str] = mapped_column(String(32), default="personal", index=True)
    token_prefix: Mapped[str] = mapped_column(String(32), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    scopes: Mapped[list] = mapped_column(JSONB, default=list)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IntegrationResourceScope(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_resource_scopes"

    integration_id: Mapped[str] = mapped_column(ForeignKey("integrations.id"), index=True)
    resource_type: Mapped[str] = mapped_column(String(32), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    include_children: Mapped[bool] = mapped_column(default=False)
    permission_level: Mapped[str] = mapped_column(String(32), default="view")
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)


class IntegrationAuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_audit_logs"

    integration_id: Mapped[str | None] = mapped_column(ForeignKey("integrations.id"), nullable=True, index=True)
    token_id: Mapped[str | None] = mapped_column(ForeignKey("integration_tokens.id"), nullable=True, index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    actor_type: Mapped[str] = mapped_column(String(32), default="user")
    source: Mapped[str] = mapped_column(String(32), default="rest_open_api", index=True)
    operation: Mapped[str] = mapped_column(String(128), index=True)
    target_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    request_summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    response_status: Mapped[str] = mapped_column(String(32), default="success", index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)


class IntegrationWebhook(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_webhooks"

    integration_id: Mapped[str] = mapped_column(ForeignKey("integrations.id"), index=True)
    url: Mapped[str] = mapped_column(String(1024))
    secret_hash: Mapped[str] = mapped_column(String(128))
    secret_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_types: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)


class IntegrationWebhookDelivery(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_webhook_deliveries"

    webhook_id: Mapped[str] = mapped_column(ForeignKey("integration_webhooks.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    response_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    attempt_count: Mapped[int] = mapped_column(default=0)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthAuthorizationCode(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oauth_authorization_codes"

    integration_id: Mapped[str] = mapped_column(ForeignKey("integrations.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    code_prefix: Mapped[str] = mapped_column(String(32), index=True)
    code_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    redirect_uri: Mapped[str] = mapped_column(String(1024))
    scopes: Mapped[list] = mapped_column(JSONB, default=list)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class OAuthRefreshToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oauth_refresh_tokens"

    integration_id: Mapped[str] = mapped_column(ForeignKey("integrations.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_prefix: Mapped[str] = mapped_column(String(32), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    scopes: Mapped[list] = mapped_column(JSONB, default=list)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
