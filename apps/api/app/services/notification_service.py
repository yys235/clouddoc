from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.comment import Comment, CommentThread
from app.models.document import Document
from app.models.notification import UserNotification
from app.models.organization import OrganizationMember
from app.models.space import Space
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.services.event_stream_service import publish_notification_event


def _author_name_map(db: Session, user_ids: set[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    rows = db.execute(select(User.id, User.name).where(User.id.in_(user_ids))).all()
    return {row[0]: row[1] for row in rows}


def _document_title_map(db: Session, document_ids: set[str]) -> dict[str, str]:
    if not document_ids:
        return {}
    rows = db.execute(select(Document.id, Document.title).where(Document.id.in_(document_ids))).all()
    return {row[0]: row[1] for row in rows}


def _to_response(db: Session, notifications: Iterable[UserNotification]) -> list[NotificationResponse]:
    items = list(notifications)
    actor_names = _author_name_map(db, {item.actor_id for item in items if item.actor_id})
    document_titles = _document_title_map(db, {item.document_id for item in items if item.document_id})
    return [
        NotificationResponse(
            id=item.id,
            user_id=item.user_id,
            actor_id=item.actor_id,
            actor_name=actor_names.get(item.actor_id) if item.actor_id else None,
            document_id=item.document_id,
            document_title=document_titles.get(item.document_id) if item.document_id else None,
            thread_id=item.thread_id,
            comment_id=item.comment_id,
            notification_type=item.notification_type,
            title=item.title,
            body=item.body,
            is_read=item.is_read,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


def list_notifications(db: Session, user_id: str) -> list[NotificationResponse]:
    notifications = db.scalars(
        select(UserNotification)
        .where(UserNotification.user_id == user_id)
        .order_by(UserNotification.created_at.desc())
    ).all()
    return _to_response(db, notifications)


def unread_notification_count(db: Session, user_id: str) -> int:
    return int(
        db.scalar(
            select(func.count(UserNotification.id))
            .where(UserNotification.user_id == user_id)
            .where(UserNotification.is_read.is_(False))
        )
        or 0
    )


def mark_notification_read(db: Session, user_id: str, notification_id: str) -> NotificationResponse | None:
    notification = db.scalar(
        select(UserNotification)
        .where(UserNotification.id == notification_id)
        .where(UserNotification.user_id == user_id)
    )
    if notification is None:
        return None
    was_unread = not notification.is_read
    notification.is_read = True
    db.flush()
    response = _to_response(db, [notification])[0]
    if was_unread:
        publish_notification_event(
            db,
            "notification.read",
            user_id=user_id,
            actor_id=user_id,
            notification_id=notification.id,
            payload={"notification": response.model_dump(mode="json")},
        )
    db.commit()
    db.refresh(notification)
    return _to_response(db, [notification])[0]


def mark_all_notifications_read(db: Session, user_id: str) -> int:
    notifications = db.scalars(
        select(UserNotification)
        .where(UserNotification.user_id == user_id)
        .where(UserNotification.is_read.is_(False))
    ).all()
    unread_ids = [item.id for item in notifications]
    for item in notifications:
        item.is_read = True
    if unread_ids:
        publish_notification_event(
            db,
            "notification.read_all",
            user_id=user_id,
            actor_id=user_id,
            notification_id=None,
            payload={"notification_ids": unread_ids},
        )
    db.commit()
    return len(notifications)


def _organization_members_for_document(db: Session, document: Document) -> list[User]:
    space = db.get(Space, document.space_id)
    if space is None or space.organization_id is None:
        owner = db.get(User, document.owner_id)
        return [owner] if owner is not None else []
    return db.scalars(
        select(User)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == space.organization_id)
        .where(OrganizationMember.status == "active")
        .order_by(User.created_at.asc())
    ).all()


def _extract_mentioned_user_ids(body: str, candidates: list[User]) -> set[str]:
    if not body.strip():
        return set()
    ordered_candidates = sorted(
        [candidate for candidate in candidates if candidate.name.strip()],
        key=lambda item: len(item.name),
        reverse=True,
    )
    mentioned_user_ids: set[str] = set()
    for candidate in ordered_candidates:
        token = f"@{candidate.name}"
        search_index = 0
        while True:
            at_index = body.find(token, search_index)
            if at_index == -1:
                break
            end_index = at_index + len(token)
            if end_index == len(body) or body[end_index].isspace() or body[end_index] in {",", "，", ".", "。", "!", "！", "?", "？", ":", "："}:
                mentioned_user_ids.add(candidate.id)
                break
            search_index = at_index + 1
    return mentioned_user_ids


def create_user_notification(
    db: Session,
    *,
    user_id: str,
    actor_id: str,
    notification_type: str,
    title: str,
    body: str,
    document_id: str | None = None,
    thread_id: str | None = None,
    comment_id: str | None = None,
) -> None:
    if user_id == actor_id:
        return
    notification = UserNotification(
        user_id=user_id,
        actor_id=actor_id,
        document_id=document_id,
        thread_id=thread_id,
        comment_id=comment_id,
        notification_type=notification_type,
        title=title[:255],
        body=body[:4000],
        is_read=False,
    )
    db.add(notification)
    db.flush()
    response = _to_response(db, [notification])[0]
    publish_notification_event(
        db,
        "notification.created",
        user_id=user_id,
        actor_id=actor_id,
        notification_id=notification.id,
        payload={"notification": response.model_dump(mode="json")},
    )


def notify_comment_thread_created(
    db: Session,
    *,
    document: Document,
    thread: CommentThread,
    comment: Comment,
    actor: User,
) -> None:
    candidate_users = _organization_members_for_document(db, document)
    mentioned_user_ids = _extract_mentioned_user_ids(comment.body, candidate_users)
    recipient_types: dict[str, str] = {}
    if document.owner_id != actor.id:
        recipient_types[document.owner_id] = "comment_thread"
    for mentioned_user_id in mentioned_user_ids:
        if mentioned_user_id != actor.id:
            recipient_types[mentioned_user_id] = "comment_mention"

    for user_id, notification_type in recipient_types.items():
        if notification_type == "comment_mention":
            title = f"{actor.name} 在评论中提到了你"
        else:
            title = f"{actor.name} 评论了《{document.title}》"
        create_user_notification(
            db,
            user_id=user_id,
            actor_id=actor.id,
            notification_type=notification_type,
            title=title,
            body=comment.body,
            document_id=document.id,
            thread_id=thread.id,
            comment_id=comment.id,
        )


def notify_comment_reply_created(
    db: Session,
    *,
    document: Document,
    thread: CommentThread,
    comment: Comment,
    actor: User,
    parent_comment: Comment | None,
) -> None:
    candidate_users = _organization_members_for_document(db, document)
    mentioned_user_ids = _extract_mentioned_user_ids(comment.body, candidate_users)
    recipient_types: dict[str, str] = {}
    if document.owner_id != actor.id:
        recipient_types[document.owner_id] = "comment_reply"
    if thread.created_by != actor.id:
        recipient_types[thread.created_by] = "comment_reply"
    if parent_comment is not None and parent_comment.author_id != actor.id:
        recipient_types[parent_comment.author_id] = "comment_reply"
    for mentioned_user_id in mentioned_user_ids:
        if mentioned_user_id != actor.id:
            recipient_types[mentioned_user_id] = "comment_mention"

    for user_id, notification_type in recipient_types.items():
        title = f"{actor.name} 回复了评论"
        if notification_type == "comment_mention":
            title = f"{actor.name} 在评论中提到了你"
        create_user_notification(
            db,
            user_id=user_id,
            actor_id=actor.id,
            notification_type=notification_type,
            title=title,
            body=comment.body,
            document_id=document.id,
            thread_id=thread.id,
            comment_id=comment.id,
        )
