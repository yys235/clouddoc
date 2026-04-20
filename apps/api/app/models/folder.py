from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
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


class UserTreePin(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_tree_pins"
    __table_args__ = (
        UniqueConstraint("user_id", "node_type", "node_id", name="uq_user_tree_pin_node"),
    )

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id"), index=True)
    parent_folder_id: Mapped[str | None] = mapped_column(ForeignKey("folders.id"), nullable=True, index=True)
    node_type: Mapped[str] = mapped_column(String(32), index=True)
    node_id: Mapped[str] = mapped_column(String(128), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class FolderFavorite(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "folder_favorites"
    __table_args__ = (UniqueConstraint("user_id", "folder_id", name="uq_folder_favorite"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    folder_id: Mapped[str] = mapped_column(ForeignKey("folders.id"), index=True)
