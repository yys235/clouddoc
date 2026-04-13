from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class MCPAuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mcp_audit_logs"

    actor_type: Mapped[str] = mapped_column(String(32), default="user")
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    tool_name: Mapped[str] = mapped_column(String(128), index=True)
    target_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    request_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    response_status: Mapped[str] = mapped_column(String(32), default="success")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
