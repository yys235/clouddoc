from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SpaceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    space_type: str
    visibility: str
    updated_at: datetime
