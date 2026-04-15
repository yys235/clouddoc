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
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, init_db
from app.models.comment import Comment, CommentThread
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
)
from app.schemas.folder import FolderCreateRequest
from app.services.actor_context import ActorContext
from app.services.comment_service import create_comment_thread, list_comment_threads, reply_comment_thread
from app.services.comment_service import delete_comment as delete_comment_service
from app.services.bootstrap_service import MCP_GUEST_EMAIL, ensure_mcp_guest_user
from app.services.document_service import (
    build_document_detail_payload,
    create_document,
    favorite_document,
    get_document_detail_for_share,
    get_document_detail_for_mcp,
    list_documents_for_mcp,
    restore_document,
    search_documents_for_mcp,
    soft_delete_document,
    update_document_content,
)
from app.services.folder_service import create_folder
from app.services.permission_service import (
    actor_user_id,
    can_mcp_delete_comment,
    can_mcp_manage_deleted_document,
    can_mcp_read_document,
    can_mcp_update_comment,
    can_mcp_write_document,
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


def _text_from_inline_nodes(nodes: list[Any]) -> str:
    parts: list[str] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        text = node.get("text")
        if isinstance(text, str):
            parts.append(text)
        child_content = node.get("content")
        if isinstance(child_content, list):
            parts.append(_text_from_inline_nodes(child_content))
    return "".join(parts)


def _markdown_escape_table_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ").strip()


def _content_node_to_markdown(node: Any, depth: int = 0) -> list[str]:
    if not isinstance(node, dict):
        return []

    node_type = str(node.get("type") or "paragraph")
    content = node.get("content")
    children = content if isinstance(content, list) else []
    attrs = node.get("attrs") if isinstance(node.get("attrs"), dict) else {}
    text = _text_from_inline_nodes(children).strip()

    if node_type == "heading":
        level = attrs.get("level", 1)
        try:
            normalized_level = max(1, min(int(level), 6))
        except (TypeError, ValueError):
            normalized_level = 1
        return [f"{'#' * normalized_level} {text}".rstrip()]

    if node_type == "paragraph":
        raw_text = attrs.get("raw_text")
        if isinstance(raw_text, str) and raw_text:
            return [raw_text]
        return [text] if text else []

    if node_type in {"bullet_list", "ordered_list", "task_list"}:
        lines: list[str] = []
        for index, child in enumerate(children, start=1):
            child_text = _text_from_inline_nodes(child.get("content", []) if isinstance(child, dict) else []).strip()
            nested_lines: list[str] = []
            if isinstance(child, dict):
                for nested in child.get("content", []):
                    if isinstance(nested, dict) and nested.get("type") in {"bullet_list", "ordered_list", "task_list"}:
                        nested_lines.extend(_content_node_to_markdown(nested, depth + 1))
            indent = "  " * depth
            if node_type == "ordered_list":
                marker = f"{index}."
            elif node_type == "task_list":
                checked = bool(child.get("attrs", {}).get("checked")) if isinstance(child, dict) else False
                marker = "[x]" if checked else "[ ]"
            else:
                marker = "-"
            if child_text:
                lines.append(f"{indent}{marker} {child_text}")
            lines.extend(nested_lines)
        return lines

    if node_type == "blockquote":
        quote_lines = []
        for child in children:
            quote_lines.extend(_content_node_to_markdown(child, depth))
        if not quote_lines and text:
            quote_lines = [text]
        return [f"> {line}" if line else ">" for line in quote_lines]

    if node_type == "code_block":
        language = str(attrs.get("language") or "").strip()
        return [f"```{language}", attrs.get("raw_text") or text, "```"]

    if node_type == "divider":
        return ["---"]

    if node_type == "link":
        url = str(attrs.get("url") or text or "").strip()
        title = str(attrs.get("title") or text or url).strip()
        return [f"[{title}]({url})" if url else title]

    if node_type == "image":
        url = str(attrs.get("url") or attrs.get("src") or "").strip()
        alt = str(attrs.get("alt") or attrs.get("name") or "image").strip()
        return [f"![{alt}]({url})" if url else f"![{alt}]"]

    if node_type == "table":
        rows = children
        rendered_rows: list[list[str]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            cells = row.get("content") if isinstance(row.get("content"), list) else []
            rendered_rows.append([_markdown_escape_table_cell(_text_from_inline_nodes(cell.get("content", []))) for cell in cells if isinstance(cell, dict)])
        if not rendered_rows:
            return []
        width = max(len(row) for row in rendered_rows)
        normalized_rows = [row + [""] * (width - len(row)) for row in rendered_rows]
        header = normalized_rows[0]
        lines = [
            "| " + " | ".join(header) + " |",
            "| " + " | ".join(["---"] * width) + " |",
        ]
        for row in normalized_rows[1:]:
            lines.append("| " + " | ".join(row) + " |")
        return lines

    nested: list[str] = []
    for child in children:
        nested.extend(_content_node_to_markdown(child, depth))
    return nested or ([text] if text else [])


def content_json_to_markdown(content_json: dict[str, Any] | None, fallback_plain_text: str = "") -> str:
    if not isinstance(content_json, dict):
        return fallback_plain_text.strip()

    blocks = content_json.get("content")
    if not isinstance(blocks, list):
        return fallback_plain_text.strip()

    lines: list[str] = []
    for block in blocks:
        block_lines = _content_node_to_markdown(block)
        if not block_lines:
            continue
        if lines:
            lines.append("")
        lines.extend(block_lines)
    return "\n".join(lines).strip() or fallback_plain_text.strip()


def _format_document_payload(document: Any, output_format: str) -> dict[str, Any]:
    dumped = _dump(document)
    normalized_format = output_format if output_format in {"markdown", "plain_text", "content_json", "full"} else "markdown"
    content = dumped.get("content") if isinstance(dumped.get("content"), dict) else {}
    content_json = content.get("content_json") if isinstance(content, dict) else {}
    plain_text = str(content.get("plain_text") or "") if isinstance(content, dict) else ""
    markdown = content_json_to_markdown(content_json, plain_text)

    metadata = {key: value for key, value in dumped.items() if key != "content"}
    metadata["format"] = normalized_format

    if normalized_format == "full":
        metadata["content"] = content
        metadata["markdown"] = markdown
        return metadata
    if normalized_format == "content_json":
        metadata["content_json"] = content_json
        return metadata
    if normalized_format == "plain_text":
        metadata["plain_text"] = plain_text
        return metadata

    metadata["markdown"] = markdown
    return metadata


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


def _get_actor_context(db: Session, user_email: str | None = None) -> ActorContext:
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
        actor_type = "guest" if user.email == MCP_GUEST_EMAIL else "user"
        return ActorContext.from_user(user, actor_type=actor_type)

    guest = db.scalar(select(User).where(User.email == MCP_GUEST_EMAIL).where(User.is_active.is_(True)).limit(1))
    if guest is None:
        guest = ensure_mcp_guest_user(db)
    return ActorContext.from_user(guest, actor_type="guest")


def _get_actor_user_id(db: Session, user_email: str | None = None) -> str | None:
    return actor_user_id(_get_actor_context(db, user_email))


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
        items = list_documents_for_mcp(
            db,
            state=normalized_state,
            user_id=user_id,
            folder_id=folder_id,
            limit=safe_limit,
        )
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
        items = search_documents_for_mcp(
            db,
            query,
            user_id=user_id,
            folder_id=folder_id,
            limit=safe_limit,
        )
        return {"documents": _dump(items), "query": query, "folder_id": folder_id, "count": len(items)}


def get_document_tool(
    document_id: str,
    user_email: str | None = None,
    format: str = "markdown",
) -> dict[str, Any]:
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
        document = get_document_detail_for_mcp(db, document_id, user_id=user_id)
        if document is None:
            raise MCPBridgeError("unauthorized", "MCP tools can only read actor-owned documents or public documents")
        return {"document": _format_document_payload(document, format)}


def get_comments_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
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


def create_folder_tool(
    *,
    space_id: str,
    title: str,
    parent_folder_id: str | None = None,
    visibility: str = "private",
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "space_id": space_id,
        "title": title,
        "parent_folder_id": parent_folder_id,
        "visibility": visibility,
    }

    def action(db: Session, actor_id: str):
        folder = create_folder(db, FolderCreateRequest(**payload), actor_id)
        return {"folder": folder}

    return _run_write_tool(
        tool_name="clouddoc.create_folder",
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
        if not can_mcp_update_comment(db, comment, actor_id):
            raise MCPBridgeError("unauthorized", "MCP tools can only update comments created by the actor")
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
        if not can_mcp_delete_comment(db, comment, actor_id):
            raise MCPBridgeError("unauthorized", "MCP tools can only delete comments created by the actor")
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
