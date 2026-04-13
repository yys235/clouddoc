from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_ROOT = Path(__file__).resolve().parents[2] / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, init_db
from app.models.comment import Comment, CommentThread
from app.models.document import Document, DocumentContent
from app.models.share import ShareLink
from app.models.user import User
from app.services.auth_service import verify_password
from app.models.mcp import MCPAuditLog
from app.schemas.document import (
    CommentAnchorPayload,
    CommentCreateRequest,
    CommentReplyRequest,
    DocumentContentUpdateRequest,
    DocumentCreateRequest,
    DocumentSummary,
    SearchResult,
)
from app.services.comment_service import create_comment_thread, list_comment_threads, reply_comment_thread
from app.services.comment_service import delete_comment as delete_comment_service
from app.services.bootstrap_service import MCP_GUEST_EMAIL, ensure_mcp_guest_user
from app.services.document_service import (
    build_document_detail_payload,
    build_search_excerpt,
    create_document,
    favorite_document,
    get_favorite_document_ids,
    get_document_detail_for_share,
    restore_document,
    soft_delete_document,
    update_document_content,
)
from app.services.space_service import list_spaces


class MCPBridgeError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def to_payload(self) -> dict[str, str]:
        return {"error": self.code, "message": self.message}


def initialize_database() -> None:
    init_db()


def _dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_dump(item) for item in value]
    if isinstance(value, dict):
        return {key: _dump(item) for key, item in value.items()}
    return value


def _audit_write(
    *,
    actor_id: str | None,
    tool_name: str,
    target_type: str | None,
    target_id: str | None,
    request_payload: dict[str, Any],
    response_status: str,
    error_message: str | None = None,
) -> None:
    with SessionLocal() as db:
        db.add(
            MCPAuditLog(
                actor_type="user",
                actor_id=actor_id,
                tool_name=tool_name,
                target_type=target_type,
                target_id=target_id,
                request_payload=_dump(request_payload),
                response_status=response_status,
                error_message=error_message,
            )
        )
        db.commit()


def _map_write_error(exc: Exception) -> MCPBridgeError:
    if isinstance(exc, MCPBridgeError):
        return exc
    if isinstance(exc, PermissionError):
        return MCPBridgeError("unauthorized", str(exc))
    if isinstance(exc, HTTPException):
        if exc.status_code == 403:
            return MCPBridgeError("unauthorized", str(exc.detail))
        if exc.status_code == 404:
            return MCPBridgeError("not_found", str(exc.detail))
        return MCPBridgeError("invalid_input", str(exc.detail))
    if isinstance(exc, ValueError):
        return MCPBridgeError("invalid_input", str(exc))
    return MCPBridgeError("internal_error", str(exc) or exc.__class__.__name__)


def _run_write_tool(
    *,
    tool_name: str,
    target_type: str | None,
    target_id: str | None,
    request_payload: dict[str, Any],
    user_email: str | None,
    action,
) -> dict[str, Any]:
    actor_id: str | None = None
    try:
        with SessionLocal() as db:
            actor_id = _get_actor_user_id(db, user_email)
            if actor_id is None:
                raise MCPBridgeError("unauthenticated", "No MCP actor user is available")
            result = action(db, actor_id)
        _audit_write(
            actor_id=actor_id,
            tool_name=tool_name,
            target_type=target_type,
            target_id=target_id,
            request_payload=request_payload,
            response_status="success",
        )
        return _dump(result)
    except Exception as exc:
        mapped = _map_write_error(exc)
        _audit_write(
            actor_id=actor_id,
            tool_name=tool_name,
            target_type=target_type,
            target_id=target_id,
            request_payload=request_payload,
            response_status="error",
            error_message=mapped.message,
        )
        raise mapped


def _get_actor_user_id(db: Session, user_email: str | None = None) -> str | None:
    actor_email = (user_email or os.getenv("CLOUDDOC_MCP_ACTOR_EMAIL") or "").strip()
    if actor_email:
        user = db.scalar(
            select(User)
            .where(User.email == actor_email)
            .where(User.is_active.is_(True))
            .limit(1)
        )
        if user is None:
            raise MCPBridgeError("unauthenticated", "Configured MCP actor user was not found")
        return user.id

    guest = db.scalar(select(User).where(User.email == MCP_GUEST_EMAIL).where(User.is_active.is_(True)).limit(1))
    if guest is None:
        guest = ensure_mcp_guest_user(db)
    return guest.id


def _ensure_mcp_owned_document(db: Session, document_id: str, actor_id: str) -> Document:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        raise MCPBridgeError("not_found", "Document not found")
    if document.owner_id != actor_id and document.creator_id != actor_id:
        raise MCPBridgeError("unauthorized", "MCP tools can only access documents created or owned by the actor")
    return document


def _ensure_mcp_owned_document_including_deleted(db: Session, document_id: str, actor_id: str) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise MCPBridgeError("not_found", "Document not found")
    if document.owner_id != actor_id and document.creator_id != actor_id:
        raise MCPBridgeError("unauthorized", "MCP tools can only access documents created or owned by the actor")
    return document


def _is_mcp_readable_document(document: Document, actor_id: str | None) -> bool:
    if document.is_deleted:
        return bool(actor_id) and (document.owner_id == actor_id or document.creator_id == actor_id)
    return document.visibility == "public" or (
        bool(actor_id) and (document.owner_id == actor_id or document.creator_id == actor_id)
    )


def _ensure_mcp_readable_document(db: Session, document_id: str, actor_id: str | None) -> Document:
    document = db.get(Document, document_id)
    if document is None or not _is_mcp_readable_document(document, actor_id):
        raise MCPBridgeError("unauthorized", "MCP tools can only read actor-owned documents or public documents")
    return document


def _document_summary_payload(db: Session, document: Document, actor_id: str | None, favorite_ids: set[str]) -> DocumentSummary:
    is_owned = bool(actor_id) and (document.owner_id == actor_id or document.creator_id == actor_id)
    can_edit = is_owned and document.document_type != "pdf"
    return DocumentSummary(
        id=document.id,
        title=document.title,
        owner_id=document.owner_id,
        document_type=document.document_type,
        status=document.status,
        visibility=document.visibility,
        updated_at=document.updated_at,
        space_id=document.space_id,
        folder_id=document.folder_id,
        sort_order=document.sort_order,
        is_deleted=document.is_deleted,
        is_favorited=document.id in favorite_ids,
        can_edit=can_edit,
        can_manage=is_owned,
        can_comment=is_owned,
        is_shared_view=False,
    )


def _comment_payload(db: Session, comment: Comment) -> dict[str, Any]:
    author = db.get(User, comment.author_id)
    return {
        "id": comment.id,
        "thread_id": comment.thread_id,
        "document_id": comment.document_id,
        "parent_comment_id": comment.parent_comment_id,
        "author_id": comment.author_id,
        "author_name": author.name if author is not None else "Unknown",
        "body": comment.body,
        "is_deleted": comment.is_deleted,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
    }


def _share_summary(share: ShareLink | None) -> dict[str, Any] | None:
    if share is None:
        return None
    is_expired = bool(share.expires_at and share.expires_at <= datetime.now(timezone.utc))
    return {
        "id": share.id,
        "token": share.token,
        "share_url": f"/share/{share.token}",
        "is_enabled": share.is_active,
        "is_active": share.is_active and not is_expired,
        "requires_password": bool(share.password_hash),
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
        "allow_copy": share.allow_copy,
        "allow_export": share.allow_export,
        "created_at": share.created_at.isoformat() if share.created_at else None,
        "updated_at": share.updated_at.isoformat() if share.updated_at else None,
        "access_count": share.access_count,
        "last_accessed_at": share.last_accessed_at.isoformat() if share.last_accessed_at else None,
    }


def list_documents_tool(
    state: str = "active",
    limit: int = 50,
    folder_id: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    normalized_state = state if state in {"active", "trash", "all"} else "active"
    safe_limit = max(1, min(limit, 200))
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
        favorite_ids = get_favorite_document_ids(db, user_id)
        statement = select(Document)
        if normalized_state == "active":
            statement = statement.where(Document.is_deleted.is_(False))
        elif normalized_state == "trash":
            statement = statement.where(Document.is_deleted.is_(True))
        if folder_id:
            statement = statement.where(Document.folder_id == folder_id)
        statement = statement.order_by(Document.sort_order.asc(), Document.updated_at.desc())
        items = [
            _document_summary_payload(db, document, user_id, favorite_ids)
            for document in db.scalars(statement).all()
            if _is_mcp_readable_document(document, user_id)
        ][:safe_limit]
        return {"documents": _dump(items), "state": normalized_state, "folder_id": folder_id, "count": len(items)}


def search_documents_tool(
    query: str,
    limit: int = 20,
    folder_id: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    if not query.strip():
        return {"documents": [], "query": query, "folder_id": folder_id, "count": 0}
    safe_limit = max(1, min(limit, 100))
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
        favorite_ids = get_favorite_document_ids(db, user_id)
        normalized_query = query.strip()
        latest_versions = (
            select(
                DocumentContent.document_id.label("document_id"),
                func.max(DocumentContent.version_no).label("version_no"),
            )
            .group_by(DocumentContent.document_id)
            .subquery()
        )
        statement = (
            select(Document, DocumentContent)
            .join(latest_versions, latest_versions.c.document_id == Document.id)
            .join(
                DocumentContent,
                (DocumentContent.document_id == latest_versions.c.document_id)
                & (DocumentContent.version_no == latest_versions.c.version_no),
            )
            .where(Document.is_deleted.is_(False))
            .where(
                or_(
                    Document.title.ilike(f"%{normalized_query}%"),
                    Document.summary.ilike(f"%{normalized_query}%"),
                    DocumentContent.plain_text.ilike(f"%{normalized_query}%"),
                )
            )
            .order_by(Document.sort_order.asc(), Document.updated_at.desc())
        )
        if folder_id:
            statement = statement.where(Document.folder_id == folder_id)
        items = [
            SearchResult(
                id=document.id,
                title=document.title,
                status=document.status,
                document_type=document.document_type,
                space_id=document.space_id,
                folder_id=document.folder_id,
                sort_order=document.sort_order,
                updated_at=document.updated_at,
                excerpt=build_search_excerpt(content.plain_text or document.summary or document.title, normalized_query),
                is_favorited=document.id in favorite_ids,
            )
            for document, content in db.execute(statement).all()
            if _is_mcp_readable_document(document, user_id)
        ][:safe_limit]
        return {"documents": _dump(items), "query": query, "folder_id": folder_id, "count": len(items)}


def get_document_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
        document_model = _ensure_mcp_readable_document(db, document_id, user_id)
        document = build_document_detail_payload(db, document_model, user_id=user_id)
        if document is None:
            raise MCPBridgeError("not_found", "Document not found or not visible")
        return {"document": _dump(document)}


def get_comments_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
        _ensure_mcp_owned_document(db, document_id, user_id)
        threads = list_comment_threads(db, document_id, user_id=user_id)
        return {"threads": _dump(threads), "count": len(threads)}


def list_spaces_tool(user_email: str | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
        spaces = list_spaces(db, user_id=user_id)
        return {"spaces": _dump(spaces), "count": len(spaces)}


def get_shared_document_tool(token: str, password: str | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        share = db.scalar(select(ShareLink).where(ShareLink.token == token).limit(1))
        if share is None:
            return {"status": "not_found", "share": None, "document": None}
        if not share.is_active:
            return {"status": "disabled", "share": _share_summary(share), "document": None}
        if share.expires_at and share.expires_at <= datetime.now(timezone.utc):
            return {"status": "expired", "share": _share_summary(share), "document": None}
        if share.password_hash:
            if not password:
                return {"status": "password_required", "share": _share_summary(share), "document": None}
            if not verify_password(password, share.password_hash):
                return {"status": "unauthorized", "share": _share_summary(share), "document": None}

        document = get_document_detail_for_share(db, share.document_id)
        if document is None:
            return {"status": "not_found", "share": _share_summary(share), "document": None}
        return {"status": "ok", "share": _share_summary(share), "document": _dump(document)}


def create_document_tool(
    *,
    space_id: str,
    title: str,
    document_type: str = "doc",
    visibility: str = "private",
    folder_id: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "space_id": space_id,
        "title": title,
        "document_type": document_type,
        "visibility": visibility,
        "folder_id": folder_id,
    }

    def action(db: Session, actor_id: str):
        document = create_document(db, DocumentCreateRequest(**payload), actor_id)
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.create_document",
        target_type="space",
        target_id=space_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def update_document_content_tool(
    *,
    document_id: str,
    content_json: dict[str, Any],
    plain_text: str = "",
    schema_version: int = 1,
    base_version_no: int | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "document_id": document_id,
        "content_json": content_json,
        "plain_text": plain_text,
        "schema_version": schema_version,
        "base_version_no": base_version_no,
    }

    def action(db: Session, actor_id: str):
        _ensure_mcp_owned_document(db, document_id, actor_id)
        document = update_document_content(
            db,
            document_id,
            DocumentContentUpdateRequest(
                content_json=content_json,
                plain_text=plain_text,
                schema_version=schema_version,
                base_version_no=base_version_no,
            ),
            actor_id,
        )
        if document is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.update_document_content",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def delete_document_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"document_id": document_id}

    def action(db: Session, actor_id: str):
        _ensure_mcp_owned_document(db, document_id, actor_id)
        document = soft_delete_document(db, document_id, actor_id)
        if document is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.delete_document",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def restore_document_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"document_id": document_id}

    def action(db: Session, actor_id: str):
        _ensure_mcp_owned_document_including_deleted(db, document_id, actor_id)
        document = restore_document(db, document_id, actor_id)
        if document is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.restore_document",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def create_comment_tool(
    *,
    document_id: str,
    block_id: str,
    start_offset: int,
    end_offset: int,
    quote_text: str,
    body: str,
    prefix_text: str | None = None,
    suffix_text: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "document_id": document_id,
        "block_id": block_id,
        "start_offset": start_offset,
        "end_offset": end_offset,
        "quote_text": quote_text,
        "prefix_text": prefix_text,
        "suffix_text": suffix_text,
        "body": body,
    }

    def action(db: Session, actor_id: str):
        _ensure_mcp_owned_document(db, document_id, actor_id)
        thread = create_comment_thread(
            db,
            document_id,
            CommentCreateRequest(
                anchor=CommentAnchorPayload(
                    block_id=block_id,
                    start_offset=start_offset,
                    end_offset=end_offset,
                    quote_text=quote_text,
                    prefix_text=prefix_text,
                    suffix_text=suffix_text,
                ),
                body=body,
            ),
            actor_id,
        )
        return {"thread": thread}

    return _run_write_tool(
        tool_name="clouddoc.create_comment",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def reply_comment_tool(
    *,
    thread_id: str,
    body: str,
    parent_comment_id: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "thread_id": thread_id,
        "parent_comment_id": parent_comment_id,
        "body": body,
    }

    def action(db: Session, actor_id: str):
        thread_model = db.get(CommentThread, thread_id)
        if thread_model is None:
            raise MCPBridgeError("not_found", "Comment thread not found")
        _ensure_mcp_owned_document(db, thread_model.document_id, actor_id)
        thread = reply_comment_thread(
            db,
            thread_id,
            CommentReplyRequest(body=body, parent_comment_id=parent_comment_id),
            actor_id,
        )
        if thread is None:
            raise MCPBridgeError("not_found", "Comment thread not found")
        return {"thread": thread}

    return _run_write_tool(
        tool_name="clouddoc.reply_comment",
        target_type="comment_thread",
        target_id=thread_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def update_comment_tool(comment_id: str, body: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"comment_id": comment_id, "body": body}

    def action(db: Session, actor_id: str):
        comment = db.get(Comment, comment_id)
        if comment is None or comment.is_deleted:
            raise MCPBridgeError("not_found", "Comment not found")
        if comment.author_id != actor_id:
            raise MCPBridgeError("unauthorized", "MCP tools can only update comments created by the actor")
        _ensure_mcp_owned_document(db, comment.document_id, actor_id)
        normalized_body = body.strip()
        if not normalized_body:
            raise MCPBridgeError("invalid_input", "Comment body is required")
        comment.body = normalized_body
        db.commit()
        db.refresh(comment)
        return {"comment": _comment_payload(db, comment)}

    return _run_write_tool(
        tool_name="clouddoc.update_comment",
        target_type="comment",
        target_id=comment_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def delete_comment_tool(comment_id: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"comment_id": comment_id}

    def action(db: Session, actor_id: str):
        comment = db.get(Comment, comment_id)
        if comment is None:
            raise MCPBridgeError("not_found", "Comment not found")
        if comment.author_id != actor_id:
            raise MCPBridgeError("unauthorized", "MCP tools can only delete comments created by the actor")
        _ensure_mcp_owned_document(db, comment.document_id, actor_id)
        result = delete_comment_service(db, comment_id=comment_id, current_user_id=actor_id)
        if result is None:
            raise MCPBridgeError("not_found", "Comment not found")
        return {"deleted": result}

    return _run_write_tool(
        tool_name="clouddoc.delete_comment",
        target_type="comment",
        target_id=comment_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def favorite_document_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"document_id": document_id}

    def action(db: Session, actor_id: str):
        _ensure_mcp_owned_document(db, document_id, actor_id)
        result = favorite_document(db, document_id, actor_id)
        if result is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"favorite": result}

    return _run_write_tool(
        tool_name="clouddoc.favorite_document",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )
