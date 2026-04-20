from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FolderSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    space_id: str
    parent_folder_id: str | None = None
    title: str
    visibility: str
    icon: str | None = None
    sort_order: int = 0
    is_deleted: bool = False
    updated_at: datetime
    can_manage: bool = False
    is_favorited: bool = False


class FolderCreateRequest(BaseModel):
    title: str = "未命名文件夹"
    space_id: str
    parent_folder_id: str | None = None
    visibility: str = "private"


class FolderUpdateRequest(BaseModel):
    title: str | None = None
    visibility: str | None = None


class FolderMoveRequest(BaseModel):
    parent_folder_id: str | None = None


class FolderBulkMoveRequest(BaseModel):
    space_id: str
    target_folder_id: str | None = None
    folder_ids: list[str] = []
    document_ids: list[str] = []


class TreeNodeReorderItem(BaseModel):
    id: str
    node_type: str


class FolderReorderRequest(BaseModel):
    space_id: str
    parent_folder_id: str | None = None
    items: list[TreeNodeReorderItem]


class TreeNodeSummary(BaseModel):
    id: str
    node_type: str
    title: str
    space_id: str
    parent_folder_id: str | None = None
    sort_order: int = 0
    visibility: str
    updated_at: datetime
    can_manage: bool = False
    document_type: str | None = None
    is_deleted: bool = False
    is_pinned: bool = False
    is_favorited: bool = False
    children: list["TreeNodeSummary"] = []


class TreePinRequest(BaseModel):
    node_type: str
    node_id: str


class TreePinResponse(BaseModel):
    node_type: str
    node_id: str
    is_pinned: bool


class FolderFavoriteStatusResponse(BaseModel):
    folder_id: str
    is_favorited: bool


class TreeNodeActionsResponse(BaseModel):
    node_type: str
    node_id: str
    can_open: bool = False
    can_share: bool = False
    can_copy_link: bool = False
    can_duplicate: bool = False
    can_move: bool = False
    can_create_shortcut: bool = False
    can_pin: bool = False
    can_favorite: bool = False
    can_transfer_owner: bool = False
    can_rename: bool = False
    can_set_security: bool = False
    can_delete: bool = False
    delete_disabled_reason: str | None = None


class FolderChildrenResponse(BaseModel):
    folder: FolderSummary | None = None
    children: list[TreeNodeSummary]


class AncestorItem(BaseModel):
    id: str
    node_type: str
    title: str


TreeNodeSummary.model_rebuild()
