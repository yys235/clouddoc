from datetime import datetime

from pydantic import BaseModel

from app.schemas.document import DocumentDetail


class DocumentAccessUpdateRequest(BaseModel):
    visibility: str


class ShareLinkUpsertRequest(BaseModel):
    enabled: bool = True
    expires_at: datetime | None = None
    password: str | None = None
    allow_copy: bool = False
    allow_export: bool = False


class ShareLinkSummaryResponse(BaseModel):
    id: str | None = None
    token: str | None = None
    share_url: str | None = None
    is_enabled: bool = False
    is_active: bool = False
    requires_password: bool = False
    expires_at: datetime | None = None
    allow_copy: bool = False
    allow_export: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
    access_count: int = 0
    last_accessed_at: datetime | None = None


class SharePasswordVerifyRequest(BaseModel):
    password: str


class ShareAccessResponse(BaseModel):
    status: str
    document: DocumentDetail | None = None
    share: ShareLinkSummaryResponse | None = None
