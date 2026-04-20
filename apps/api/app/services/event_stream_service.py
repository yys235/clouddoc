from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from threading import Lock
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentPermission
from app.models.event import EventLog
from app.models.folder import Folder
from app.models.user import User


SubscriberQueue = asyncio.Queue[dict[str, Any]]


class _AsyncSubscriber:
    def __init__(self, loop: asyncio.AbstractEventLoop, queue: SubscriberQueue) -> None:
        self.loop = loop
        self.queue = queue


class EventBus:
    def __init__(self) -> None:
        self._lock = Lock()
        self._subscribers: dict[str, list[_AsyncSubscriber]] = {}

    def subscribe(self, user_id: str) -> SubscriberQueue:
        subscriber: SubscriberQueue = asyncio.Queue(maxsize=200)
        loop = asyncio.get_running_loop()
        with self._lock:
            self._subscribers.setdefault(user_id, []).append(_AsyncSubscriber(loop, subscriber))
        return subscriber

    def unsubscribe(self, user_id: str, subscriber: SubscriberQueue) -> None:
        with self._lock:
            subscribers = self._subscribers.get(user_id, [])
            matched = next((item for item in subscribers if item.queue is subscriber), None)
            if matched is not None:
                subscribers.remove(matched)
            if not subscribers and user_id in self._subscribers:
                del self._subscribers[user_id]

    @staticmethod
    def _publish_to_queue(subscriber: SubscriberQueue, event: dict[str, Any]) -> None:
        if subscriber.full():
            try:
                subscriber.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            subscriber.put_nowait(event)
        except asyncio.QueueFull:
            pass

    def publish(self, user_ids: set[str], event: dict[str, Any]) -> None:
        with self._lock:
            targets = [subscriber for user_id in user_ids for subscriber in self._subscribers.get(user_id, [])]
        for subscriber in targets:
            subscriber.loop.call_soon_threadsafe(self._publish_to_queue, subscriber.queue, event)


event_bus = EventBus()


def sse_encode(event: dict[str, Any]) -> str:
    event_id = str(event["event_id"])
    event_type = str(event["event_type"])
    data = json.dumps(event, ensure_ascii=False, default=str)
    return f"id: {event_id}\nevent: {event_type}\ndata: {data}\n\n"


def heartbeat_event() -> dict[str, Any]:
    return {
        "event_id": f"heartbeat-{int(time.time())}",
        "event_type": "heartbeat",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "target_type": "system",
        "target_id": None,
        "revision": None,
    }


def visible_user_ids_for_document(db: Session, document: Document) -> set[str]:
    user_ids: set[str] = {document.owner_id, document.creator_id}
    permission_user_ids = db.scalars(
        select(DocumentPermission.subject_id)
        .where(DocumentPermission.document_id == document.id)
        .where(DocumentPermission.subject_type == "user")
    ).all()
    user_ids.update(permission_user_ids)
    if document.visibility == "public":
        user_ids.update(db.scalars(select(User.id).where(User.is_active.is_(True))).all())
    return {user_id for user_id in user_ids if user_id}


def visible_user_ids_for_folder(db: Session, folder: Folder) -> set[str]:
    user_ids: set[str] = {folder.owner_id, folder.creator_id}
    if folder.visibility == "public":
        user_ids.update(db.scalars(select(User.id).where(User.is_active.is_(True))).all())
    return {user_id for user_id in user_ids if user_id}


def store_and_publish_event(
    db: Session,
    *,
    event_type: str,
    actor_id: str | None,
    space_id: str | None,
    document_id: str | None = None,
    folder_id: str | None = None,
    target_type: str,
    target_id: str | None,
    payload: dict[str, Any],
    visible_user_ids: set[str],
) -> dict[str, Any]:
    event_id = str(uuid.uuid4())
    event = {
        "event_id": event_id,
        "event_type": event_type,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "actor_id": actor_id,
        "space_id": space_id,
        "document_id": document_id,
        "folder_id": folder_id,
        "target_type": target_type,
        "target_id": target_id,
        "revision": payload.get("revision"),
        **payload,
    }
    db.add(
        EventLog(
            id=event_id,
            event_type=event_type,
            actor_id=actor_id,
            space_id=space_id,
            document_id=document_id,
            folder_id=folder_id,
            target_type=target_type,
            target_id=target_id,
            payload=event,
            visible_user_ids=sorted(visible_user_ids),
        )
    )
    db.flush()
    event_bus.publish(visible_user_ids, event)
    try:
        from app.services.integration_service import dispatch_webhooks_for_event

        dispatch_webhooks_for_event(db, event)
    except Exception:
        # Webhook delivery failures must not break the primary document/comment mutation path.
        pass
    return event


def publish_document_event(db: Session, event_type: str, document: Document, actor_id: str | None, **extra: Any) -> None:
    payload = {
        "document": {
            "id": document.id,
            "title": document.title,
            "document_type": document.document_type,
            "status": document.status,
            "visibility": document.visibility,
            "space_id": document.space_id,
            "folder_id": document.folder_id,
            "sort_order": document.sort_order,
            "updated_at": document.updated_at.isoformat() if document.updated_at else None,
            "is_deleted": document.is_deleted,
        },
        **extra,
    }
    store_and_publish_event(
        db,
        event_type=event_type,
        actor_id=actor_id,
        space_id=document.space_id,
        document_id=document.id,
        folder_id=document.folder_id,
        target_type="document",
        target_id=document.id,
        payload=payload,
        visible_user_ids=visible_user_ids_for_document(db, document),
    )


def publish_folder_event(db: Session, event_type: str, folder: Folder, actor_id: str | None, **extra: Any) -> None:
    payload = {
        "folder": {
            "id": folder.id,
            "title": folder.title,
            "visibility": folder.visibility,
            "space_id": folder.space_id,
            "parent_folder_id": folder.parent_folder_id,
            "sort_order": folder.sort_order,
            "updated_at": folder.updated_at.isoformat() if folder.updated_at else None,
            "is_deleted": folder.is_deleted,
        },
        **extra,
    }
    store_and_publish_event(
        db,
        event_type=event_type,
        actor_id=actor_id,
        space_id=folder.space_id,
        folder_id=folder.id,
        target_type="folder",
        target_id=folder.id,
        payload=payload,
        visible_user_ids=visible_user_ids_for_folder(db, folder),
    )


def publish_comment_event(
    db: Session,
    event_type: str,
    document: Document,
    actor_id: str | None,
    *,
    thread_id: str | None = None,
    comment_id: str | None = None,
    **extra: Any,
) -> None:
    payload = {
        "thread_id": thread_id,
        "comment_id": comment_id,
        **extra,
    }
    store_and_publish_event(
        db,
        event_type=event_type,
        actor_id=actor_id,
        space_id=document.space_id,
        document_id=document.id,
        folder_id=document.folder_id,
        target_type="comment",
        target_id=comment_id or thread_id,
        payload=payload,
        visible_user_ids=visible_user_ids_for_document(db, document),
    )


def publish_notification_event(
    db: Session,
    event_type: str,
    *,
    user_id: str,
    actor_id: str | None,
    notification_id: str | None,
    payload: dict[str, Any],
) -> None:
    store_and_publish_event(
        db,
        event_type=event_type,
        actor_id=actor_id,
        space_id=None,
        target_type="notification",
        target_id=notification_id,
        payload=payload,
        visible_user_ids={user_id},
    )
