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
    children: list["TreeNodeSummary"] = []


class FolderChildrenResponse(BaseModel):
    folder: FolderSummary | None = None
    children: list[TreeNodeSummary]


class AncestorItem(BaseModel):
    id: str
    node_type: str
    title: str


TreeNodeSummary.model_rebuild()
