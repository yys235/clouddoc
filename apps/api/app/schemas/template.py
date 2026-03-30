from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.document import DocumentDetail


class TemplateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    preview_image: str | None = None
    status: str
    created_at: datetime


class TemplateDetail(TemplateSummary):
    content_json: dict[str, Any] = Field(default_factory=dict)


class TemplateInstantiateRequest(BaseModel):
    title: str | None = None
    space_id: str | None = None


class TemplateInstantiateResponse(BaseModel):
    template_id: str
    document: DocumentDetail
