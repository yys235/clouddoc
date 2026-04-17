from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


DOCUMENT_TREE_OPEN_MODES = {"same-page", "new-window"}


class UserPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    document_tree_open_mode: str
    updated_at: datetime


class UserPreferenceUpdateRequest(BaseModel):
    document_tree_open_mode: str | None = None

    @field_validator("document_tree_open_mode")
    @classmethod
    def validate_document_tree_open_mode(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in DOCUMENT_TREE_OPEN_MODES:
            raise ValueError("Invalid document tree open mode")
        return value
