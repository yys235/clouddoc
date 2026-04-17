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

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    content_json: Mapped[dict] = mapped_column(JSONB)
    plain_text: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)


class DocumentVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_no", name="uq_document_version"),)

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    content_id: Mapped[str] = mapped_column(ForeignKey("document_contents.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)
    message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)


class DocumentPermission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_permissions"
    __table_args__ = (UniqueConstraint("document_id", "subject_type", "subject_id", name="uq_document_permission_subject"),)

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    subject_type: Mapped[str] = mapped_column(String(32))
    subject_id: Mapped[str] = mapped_column(String(128), index=True)
    permission_level: Mapped[str] = mapped_column(String(32), default="view")
    invited_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notify: Mapped[bool] = mapped_column(Boolean, default=False)


class DocumentPermissionSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_permission_settings"
    __table_args__ = (UniqueConstraint("document_id", name="uq_document_permission_settings_document"),)

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    link_share_scope: Mapped[str] = mapped_column(String(32), default="closed")
    external_access_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    comment_scope: Mapped[str] = mapped_column(String(32), default="can_edit")
    share_collaborator_scope: Mapped[str] = mapped_column(String(32), default="full_access")
    copy_scope: Mapped[str] = mapped_column(String(32), default="can_view")
    export_scope: Mapped[str] = mapped_column(String(32), default="full_access")
    print_scope: Mapped[str] = mapped_column(String(32), default="full_access")
    download_scope: Mapped[str] = mapped_column(String(32), default="full_access")
    allow_search_index: Mapped[bool] = mapped_column(Boolean, default=False)
    watermark_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class DocumentPermissionAuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_permission_audit_logs"

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    actor_type: Mapped[str] = mapped_column(String(32), default="user")
    action: Mapped[str] = mapped_column(String(64), index=True)
    target_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    before_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)


class DocumentFavorite(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_favorites"
    __table_args__ = (UniqueConstraint("user_id", "document_id", name="uq_document_favorite"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
