from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    owner_id: str
    document_type: str
    status: str
    visibility: str
    updated_at: datetime
    space_id: str
    folder_id: str | None = None
    sort_order: int = 0
    is_deleted: bool = False
    is_favorited: bool = False
    can_edit: bool = False
    can_manage: bool = False
    can_comment: bool = False
    can_share: bool = False
    can_copy: bool = False
    can_export: bool = False
    can_delete: bool = False
    can_transfer_owner: bool = False
    effective_role: str = "none"
    is_shared_view: bool = False


class DocumentContentPayload(BaseModel):
    schema_version: int = 1
    content_json: dict[str, Any] = Field(default_factory=dict)
    plain_text: str = ""


class DocumentDetail(DocumentSummary):
    icon: str | None = None
    summary: str | None = None
    content: DocumentContentPayload
    file_url: str | None = None
    file_name: str | None = None
    mime_type: str | None = None
    file_size: int | None = None


class DocumentCreateRequest(BaseModel):
    title: str = "Untitled"
    space_id: str
    parent_id: str | None = None
    folder_id: str | None = None
    document_type: str = "doc"
    visibility: str = "private"


class DocumentRenameRequest(BaseModel):
    title: str


class DocumentContentUpdateRequest(DocumentContentPayload):
    base_version_no: int | None = None


class LinkPreviewRequest(BaseModel):
    url: str


class LinkPreviewResponse(BaseModel):
    url: str
    normalized_url: str
    title: str
    description: str = ""
    site_name: str = ""
    icon: str = ""
    image: str = ""
    view: str = "link"
    status: str = "ready"


class UploadedAssetResponse(BaseModel):
    file_url: str
    file_name: str
    mime_type: str
    file_size: int


class CommentAnchorPayload(BaseModel):
    block_id: str
    start_offset: int
    end_offset: int
    quote_text: str
    prefix_text: str | None = None
    suffix_text: str | None = None


class CommentCreateRequest(BaseModel):
    anchor: CommentAnchorPayload
    body: str


class CommentReplyRequest(BaseModel):
    body: str
    parent_comment_id: str | None = None


class CommentStatusUpdateRequest(BaseModel):
    status: str


class CommentItemResponse(BaseModel):
    id: str
    thread_id: str
    document_id: str
    parent_comment_id: str | None = None
    author_id: str
    author_name: str
    body: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class CommentThreadResponse(BaseModel):
    id: str
    document_id: str
    anchor_block_id: str
    anchor_start_offset: int
    anchor_end_offset: int
    quote_text: str
    prefix_text: str | None = None
    suffix_text: str | None = None
    status: str
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime
    comments: list[CommentItemResponse]


class CommentDeleteResponse(BaseModel):
    comment_id: str
    thread_id: str
    thread_deleted: bool
    thread: CommentThreadResponse | None = None


class FavoriteStatusResponse(BaseModel):
    document_id: str
    is_favorited: bool


class SearchResult(BaseModel):
    id: str
    title: str
    status: str
    document_type: str
    space_id: str
    folder_id: str | None = None
    sort_order: int = 0
    updated_at: datetime
    excerpt: str
    is_favorited: bool = False
