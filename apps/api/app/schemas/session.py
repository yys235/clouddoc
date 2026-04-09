from datetime import datetime

from pydantic import BaseModel


class SessionSummaryResponse(BaseModel):
    id: str
    user_agent: str | None = None
    ip_address: str | None = None
    expires_at: datetime
    created_at: datetime
    is_current: bool
