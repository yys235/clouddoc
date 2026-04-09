from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.notification import NotificationResponse, NotificationUnreadCountResponse
from app.services.auth_service import require_current_user_dependency
from app.services.notification_service import (
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    unread_notification_count,
)

router = APIRouter(prefix="/notifications")


@router.get("", response_model=list[NotificationResponse])
def list_notifications_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[NotificationResponse]:
    return list_notifications(db, current_user.id)


@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
def unread_count_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> NotificationUnreadCountResponse:
    return NotificationUnreadCountResponse(unread_count=unread_notification_count(db, current_user.id))


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_read_route(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> NotificationResponse:
    notification = mark_notification_read(db, current_user.id, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> None:
    mark_all_notifications_read(db, current_user.id)
