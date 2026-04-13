from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Folder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "folders"

    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    parent_folder_id: Mapped[str | None] = mapped_column(ForeignKey("folders.id"), nullable=True, index=True)
    creator_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="未命名文件夹")
    visibility: Mapped[str] = mapped_column(String(16), default="private", index=True)
    icon: Mapped[str | None] = mapped_column(String(32), nullable=True, default="folder")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
