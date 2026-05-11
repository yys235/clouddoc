from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class SystemSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "system_settings"

    initialized: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    initialized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    initialized_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    product_name: Mapped[str] = mapped_column(String(120), default="CloudDoc")
    allow_public_documents: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_share_links: Mapped[bool] = mapped_column(Boolean, default=True)
    share_password_required_by_default: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_guest_public_read: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_user_pat: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_open_api: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_demo_data: Mapped[bool] = mapped_column(Boolean, default=False)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)


class SystemAuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "system_audit_logs"

    actor_type: Mapped[str] = mapped_column(String(32), default="system", index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(128), index=True)
    target_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
