from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    document_type: str
    status: str
    updated_at: datetime
    space_id: str
    is_deleted: bool = False
    is_favorited: bool = False


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
    document_type: str = "doc"


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


class FavoriteStatusResponse(BaseModel):
    document_id: str
    is_favorited: bool


class SearchResult(BaseModel):
    id: str
    title: str
    status: str
    document_type: str
    space_id: str
    updated_at: datetime
    excerpt: str
    is_favorited: bool = False
