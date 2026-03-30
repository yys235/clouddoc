from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Space(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "spaces"

    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    space_type: Mapped[str] = mapped_column(String(32), default="personal")
    visibility: Mapped[str] = mapped_column(String(32), default="private")

