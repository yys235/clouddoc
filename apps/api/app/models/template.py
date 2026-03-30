from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Template(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "templates"

    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    source_document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(64), default="general")
    preview_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    content_json: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(32), default="published")
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)

