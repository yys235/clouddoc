from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Document(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "documents"

    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    folder_id: Mapped[str | None] = mapped_column(ForeignKey("folders.id"), nullable=True, index=True)
    creator_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="Untitled")
    document_type: Mapped[str] = mapped_column(String(32), default="doc")
    status: Mapped[str] = mapped_column(String(32), default="draft")
    visibility: Mapped[str] = mapped_column(String(16), default="private", index=True)
    icon: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    cover_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    current_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("document_versions.id"),
        nullable=True,
    )


class DocumentContent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_contents"
    __table_args__ = (UniqueConstraint("document_id", "version_no", name="uq_document_content_version"),)

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    content_json: Mapped[dict] = mapped_column(JSONB)
    plain_text: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)


class DocumentVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_no", name="uq_document_version"),)

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    content_id: Mapped[str] = mapped_column(ForeignKey("document_contents.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)
    message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)


class DocumentPermission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_permissions"

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    subject_type: Mapped[str] = mapped_column(String(32))
    subject_id: Mapped[str] = mapped_column(String(64), index=True)
    permission_level: Mapped[str] = mapped_column(String(32), default="view")


class DocumentFavorite(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_favorites"
    __table_args__ = (UniqueConstraint("user_id", "document_id", name="uq_document_favorite"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
