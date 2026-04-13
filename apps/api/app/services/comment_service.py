from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.comment import Comment, CommentThread
from app.models.document import Document
from app.models.notification import UserNotification
from app.models.space import Space
from app.models.user import User
from app.schemas.document import (
    CommentCreateRequest,
    CommentDeleteResponse,
    CommentItemResponse,
    CommentReplyRequest,
    CommentStatusUpdateRequest,
    CommentThreadResponse,
)
from app.services.notification_service import (
    notify_comment_reply_created,
    notify_comment_thread_created,
)


def _author_name_map(db: Session, user_ids: set[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    rows = db.execute(select(User.id, User.name).where(User.id.in_(user_ids))).all()
    return {row[0]: row[1] for row in rows}


def _thread_response(db: Session, thread: CommentThread) -> CommentThreadResponse:
    comments = db.scalars(
        select(Comment)
        .where(Comment.thread_id == thread.id)
        .order_by(Comment.created_at.asc())
    ).all()
    author_ids = {thread.created_by, *(comment.author_id for comment in comments)}
    author_names = _author_name_map(db, author_ids)
    return CommentThreadResponse(
        id=thread.id,
        document_id=thread.document_id,
        anchor_block_id=thread.anchor_block_id,
        anchor_start_offset=thread.anchor_start_offset,
        anchor_end_offset=thread.anchor_end_offset,
        quote_text=thread.quote_text,
        prefix_text=thread.prefix_text,
        suffix_text=thread.suffix_text,
        status=thread.status,
        created_by=thread.created_by,
        created_by_name=author_names.get(thread.created_by, "Unknown"),
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        comments=[
            CommentItemResponse(
                id=comment.id,
                thread_id=comment.thread_id,
                document_id=comment.document_id,
                parent_comment_id=comment.parent_comment_id,
                author_id=comment.author_id,
                author_name=author_names.get(comment.author_id, "Unknown"),
                body=comment.body,
                is_deleted=comment.is_deleted,
                created_at=comment.created_at,
                updated_at=comment.updated_at,
            )
            for comment in comments
        ],
    )


def list_comment_threads(db: Session, document_id: str, user_id: str | None = None) -> list[CommentThreadResponse]:
    from app.services.document_service import can_view_document

    document = db.get(Document, document_id)
    if document is None or not can_view_document(db, document, user_id):
        return []
    threads = db.scalars(
        select(CommentThread)
        .where(CommentThread.document_id == document_id)
        .order_by(CommentThread.created_at.asc())
    ).all()
    return [_thread_response(db, thread) for thread in threads]


def create_comment_thread(
    db: Session,
    document_id: str,
    payload: CommentCreateRequest,
    author_id: str,
) -> CommentThreadResponse:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        raise ValueError("Document not found")
    from app.services.document_service import can_comment_document
    if not can_comment_document(db, document, author_id):
        raise PermissionError("Not allowed to comment on document")

    anchor = payload.anchor
    thread = CommentThread(
        document_id=document_id,
        anchor_block_id=anchor.block_id,
        anchor_start_offset=anchor.start_offset,
        anchor_end_offset=anchor.end_offset,
        quote_text=anchor.quote_text,
        prefix_text=anchor.prefix_text,
        suffix_text=anchor.suffix_text,
        status="open",
        created_by=author_id,
    )
    db.add(thread)
    db.flush()

    comment = Comment(
        thread_id=thread.id,
        document_id=document_id,
        author_id=author_id,
        body=payload.body.strip(),
        is_deleted=False,
    )
    db.add(comment)
    db.flush()
    actor = db.get(User, author_id)
    if actor is not None:
        notify_comment_thread_created(db, document=document, thread=thread, comment=comment, actor=actor)
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread)


def reply_comment_thread(
    db: Session,
    thread_id: str,
    payload: CommentReplyRequest,
    author_id: str,
) -> CommentThreadResponse | None:
    thread = db.get(CommentThread, thread_id)
    if thread is None:
      return None

    document = db.get(Document, thread.document_id)
    if document is None:
        return None
    from app.services.document_service import can_comment_document
    if not can_comment_document(db, document, author_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to reply to comment")

    parent_comment_id = payload.parent_comment_id
    parent_comment = None
    if parent_comment_id is not None:
        parent_comment = db.get(Comment, parent_comment_id)
        if parent_comment is None or parent_comment.thread_id != thread.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")

    comment = Comment(
        thread_id=thread.id,
        document_id=thread.document_id,
        parent_comment_id=parent_comment_id,
        author_id=author_id,
        body=payload.body.strip(),
        is_deleted=False,
    )
    db.add(comment)
    db.flush()
    thread.updated_at = comment.created_at
    actor = db.get(User, author_id)
    if actor is not None:
        notify_comment_reply_created(
            db,
            document=document,
            thread=thread,
            comment=comment,
            actor=actor,
            parent_comment=parent_comment,
        )
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread)


def update_comment_thread_status(
    db: Session,
    thread_id: str,
    payload: CommentStatusUpdateRequest,
    current_user_id: str,
) -> CommentThreadResponse | None:
    from app.services.document_service import can_comment_document

    thread = db.get(CommentThread, thread_id)
    if thread is None:
        return None
    document = db.get(Document, thread.document_id)
    if document is None:
        return None
    if not can_comment_document(db, document, current_user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update comment status")
    next_status = payload.status.strip().lower()
    if next_status not in {"open", "resolved"}:
        raise ValueError("Invalid comment thread status")
    thread.status = next_status
    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread)


def _can_manage_comment(db: Session, document: Document, current_user_id: str, comment: Comment) -> bool:
    return comment.author_id == current_user_id


def _delete_thread_notifications(db: Session, thread_id: str) -> None:
    db.execute(delete(UserNotification).where(UserNotification.thread_id == thread_id))


def _delete_comment_notifications(db: Session, comment_id: str) -> None:
    db.execute(delete(UserNotification).where(UserNotification.comment_id == comment_id))


def delete_comment(
    db: Session,
    *,
    comment_id: str,
    current_user_id: str,
) -> CommentDeleteResponse | None:
    comment = db.get(Comment, comment_id)
    if comment is None:
        return None

    thread = db.get(CommentThread, comment.thread_id)
    document = db.get(Document, comment.document_id)
    if thread is None or document is None:
        return None

    if not _can_manage_comment(db, document, current_user_id, comment):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete comment")

    comment.is_deleted = True
    comment.updated_at = datetime.now(timezone.utc)
    db.flush()

    remaining_comments = db.scalars(
        select(Comment)
        .where(Comment.thread_id == thread.id)
        .where(Comment.is_deleted.is_(False))
        .order_by(Comment.created_at.asc())
    ).all()

    thread_deleted = False
    next_thread = thread
    if not remaining_comments:
        _delete_thread_notifications(db, thread.id)
        db.execute(delete(Comment).where(Comment.thread_id == thread.id))
        db.delete(thread)
        thread_deleted = True
        next_thread = None
    else:
        thread.updated_at = datetime.now(timezone.utc)

    db.commit()

    return CommentDeleteResponse(
        comment_id=comment_id,
        thread_id=thread.id,
        thread_deleted=thread_deleted,
        thread=_thread_response(db, next_thread) if next_thread is not None else None,
    )


def _content_block_text_map(content_json: dict | None) -> dict[str, str]:
    if not isinstance(content_json, dict):
        return {}

    block_map: dict[str, str] = {}
    for node in content_json.get("content", []) or []:
        if not isinstance(node, dict):
            continue
        attrs = node.get("attrs") if isinstance(node.get("attrs"), dict) else {}
        block_id = str(attrs.get("block_id") or "").strip()
        if not block_id:
            continue

        raw_text = attrs.get("raw_text")
        if isinstance(raw_text, str):
            block_map[block_id] = raw_text
            continue

        node_type = str(node.get("type") or "")
        content = node.get("content") if isinstance(node.get("content"), list) else []

        if node_type in {"paragraph", "heading", "blockquote", "code_block"}:
            text = "".join(
                str(item.get("text") or "")
                for item in content
                if isinstance(item, dict)
            )
            block_map[block_id] = text
            continue

        if node_type in {"bullet_list", "ordered_list"}:
            lines: list[str] = []
            for item in content:
                if not isinstance(item, dict):
                    continue
                line = "".join(
                    str(text_item.get("text") or "")
                    for text_item in (item.get("content") or [])
                    if isinstance(text_item, dict)
                ).strip()
                if line:
                    lines.append(line)
            block_map[block_id] = "\n".join(lines)
            continue

        if node_type == "check_list":
            lines: list[str] = []
            for item in content:
                if not isinstance(item, dict):
                    continue
                checked = bool((item.get("attrs") or {}).get("checked"))
                line = "".join(
                    str(text_item.get("text") or "")
                    for text_item in (item.get("content") or [])
                    if isinstance(text_item, dict)
                ).strip()
                lines.append(f"[{'x' if checked else ' '}] {line}".rstrip())
            block_map[block_id] = "\n".join(lines)
            continue

        if node_type == "link_card":
            title = str(attrs.get("title") or "").strip()
            href = str(attrs.get("href") or "").strip()
            block_map[block_id] = title or href
            continue

        if node_type == "image_block":
            block_map[block_id] = str(attrs.get("alt") or "").strip()
            continue

        if node_type == "horizontal_rule":
            block_map[block_id] = ""

    return block_map


def _find_relocated_range(
    block_text: str,
    *,
    quote_text: str,
    prefix_text: str | None,
    suffix_text: str | None,
) -> tuple[int, int] | None:
    if not quote_text:
        return None

    quoted_matches: list[tuple[int, int]] = []
    cursor = 0
    while True:
        index = block_text.find(quote_text, cursor)
        if index == -1:
            break
        quoted_matches.append((index, index + len(quote_text)))
        cursor = index + max(1, len(quote_text))

    if not quoted_matches:
        return None

    normalized_prefix = prefix_text or ""
    normalized_suffix = suffix_text or ""
    contextual_matches = [
        (start, end)
        for start, end in quoted_matches
        if block_text[max(0, start - len(normalized_prefix)):start] == normalized_prefix
        and block_text[end:end + len(normalized_suffix)] == normalized_suffix
    ]
    if len(contextual_matches) == 1:
        return contextual_matches[0]
    if len(quoted_matches) == 1:
        return quoted_matches[0]
    return None


def sync_comment_threads_with_content(db: Session, document_id: str, content_json: dict | None) -> None:
    block_map = _content_block_text_map(content_json)
    threads = db.scalars(
        select(CommentThread).where(CommentThread.document_id == document_id)
    ).all()

    for thread in threads:
        block_text = block_map.get(thread.anchor_block_id)
        if block_text is None:
            _delete_thread_notifications(db, thread.id)
            db.execute(delete(Comment).where(Comment.thread_id == thread.id))
            db.delete(thread)
            continue

        start = max(0, min(thread.anchor_start_offset, len(block_text)))
        end = max(start, min(thread.anchor_end_offset, len(block_text)))
        if block_text[start:end] == thread.quote_text and end > start:
            continue

        relocated = _find_relocated_range(
            block_text,
            quote_text=thread.quote_text,
            prefix_text=thread.prefix_text,
            suffix_text=thread.suffix_text,
        )
        if relocated is None:
            _delete_thread_notifications(db, thread.id)
            db.execute(delete(Comment).where(Comment.thread_id == thread.id))
            db.delete(thread)
            continue

        next_start, next_end = relocated
        thread.anchor_start_offset = next_start
        thread.anchor_end_offset = next_end
        thread.prefix_text = block_text[max(0, next_start - 16):next_start]
        thread.suffix_text = block_text[next_end:min(len(block_text), next_end + 16)]
