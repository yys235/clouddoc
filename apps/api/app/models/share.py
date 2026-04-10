from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ShareLink(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "share_links"

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    access_scope: Mapped[str] = mapped_column(String(32), default="private")
    permission_level: Mapped[str] = mapped_column(String(32), default="view")
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    access_count: Mapped[int] = mapped_column(Integer, default=0)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    allow_copy: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_export: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
