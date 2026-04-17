from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class EventLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "event_logs"

    event_type: Mapped[str] = mapped_column(String(64), index=True)
    actor_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    space_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    document_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    folder_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    target_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    visible_user_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
