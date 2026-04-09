from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserNotification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_notifications"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), index=True, nullable=True)
    thread_id: Mapped[str | None] = mapped_column(ForeignKey("comment_threads.id"), index=True, nullable=True)
    comment_id: Mapped[str | None] = mapped_column(ForeignKey("comments.id"), index=True, nullable=True)
    notification_type: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
