from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class CommentThread(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "comment_threads"

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    anchor_block_id: Mapped[str] = mapped_column(String(128), index=True)
    anchor_start_offset: Mapped[int] = mapped_column(Integer)
    anchor_end_offset: Mapped[int] = mapped_column(Integer)
    quote_text: Mapped[str] = mapped_column(Text)
    prefix_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    suffix_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)


class Comment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "comments"

    thread_id: Mapped[str] = mapped_column(ForeignKey("comment_threads.id"), index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    parent_comment_id: Mapped[str | None] = mapped_column(ForeignKey("comments.id"), index=True, nullable=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(default=False)
