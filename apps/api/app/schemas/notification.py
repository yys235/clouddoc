from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    actor_id: str | None = None
    actor_name: str | None = None
    document_id: str | None = None
    document_title: str | None = None
    thread_id: str | None = None
    comment_id: str | None = None
    notification_type: str
    title: str
    body: str
    is_read: bool
    created_at: datetime
    updated_at: datetime


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int
