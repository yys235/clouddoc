from __future__ import annotations

import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
API_ROOT = ROOT / "apps" / "api"
MCP_ROOT = ROOT / "apps" / "mcp"
for path in (str(API_ROOT), str(MCP_ROOT)):
    if path not in sys.path:
        sys.path.insert(0, path)

import pytest
from sqlalchemy import delete, select

from app.core.db import SessionLocal, init_db
from app.models.document import Document
from app.models.document import DocumentContent, DocumentFavorite, DocumentPermission, DocumentVersion
from app.models.folder import Folder
from app.models.comment import Comment, CommentThread
from app.models.mcp import MCPAuditLog
from app.models.notification import UserNotification
from app.models.organization import OrganizationMember
from app.models.share import ShareLink
from app.models.space import Space
from app.models.user import User
from app.services.bootstrap_service import MCP_GUEST_EMAIL, seed_demo_data
from app.services.auth_service import hash_password
from clouddoc_mcp.bridge import (
    MCPBridgeError,
    create_comment_tool,
    create_document_tool,
    create_folder_tool,
    delete_comment_tool,
    delete_document_tool,
    favorite_document_tool,
    get_comments_tool,
    get_document_tool,
    get_shared_document_tool,
    list_documents_tool,
    list_spaces_tool,
    reply_comment_tool,
    restore_document_tool,
    search_documents_tool,
    update_comment_tool,
    update_document_content_tool,
)

DEMO_EMAIL = "demo@clouddoc.local"
OUTSIDER_EMAIL = "pytest-mcp-outsider@clouddoc.local"


def setup_module() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()


def _first_visible_document_id() -> str:
    payload = list_documents_tool(limit=1, user_email=DEMO_EMAIL)
    assert payload["count"] >= 1
    return payload["documents"][0]["id"]


def _first_space_id() -> str:
    spaces = list_spaces_tool(user_email=DEMO_EMAIL)
    assert spaces["count"] >= 1
    return spaces["spaces"][0]["id"]


def _cleanup_document(document_id: str) -> None:
    db = SessionLocal()
    try:
        thread_ids = db.scalars(select(CommentThread.id).where(CommentThread.document_id == document_id)).all()
        comment_ids = db.scalars(select(Comment.id).where(Comment.document_id == document_id)).all()
        document = db.get(Document, document_id)
        if document is not None:
            document.current_version_id = None
            db.flush()
        if comment_ids:
            db.execute(delete(UserNotification).where(UserNotification.comment_id.in_(comment_ids)))
        if thread_ids:
            db.execute(delete(UserNotification).where(UserNotification.thread_id.in_(thread_ids)))
        db.execute(delete(UserNotification).where(UserNotification.document_id == document_id))
        db.execute(delete(Comment).where(Comment.document_id == document_id))
        db.execute(delete(CommentThread).where(CommentThread.document_id == document_id))
        db.execute(delete(DocumentFavorite).where(DocumentFavorite.document_id == document_id))
        db.execute(delete(DocumentPermission).where(DocumentPermission.document_id == document_id))
        db.execute(delete(ShareLink).where(ShareLink.document_id == document_id))
        db.execute(delete(DocumentVersion).where(DocumentVersion.document_id == document_id))
        db.execute(delete(DocumentContent).where(DocumentContent.document_id == document_id))
        db.execute(delete(Document).where(Document.id == document_id))
        db.commit()
    finally:
        db.close()


def _ensure_outsider_user() -> None:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == OUTSIDER_EMAIL).limit(1))
        if user is None:
            db.add(
                User(
                    name="Pytest MCP Outsider",
                    email=OUTSIDER_EMAIL,
                    password_hash=hash_password("pytest-mcp-outsider"),
                    is_active=True,
                )
            )
            db.commit()
    finally:
        db.close()


def test_read_only_mcp_document_tools() -> None:
    document_id = _first_visible_document_id()

    detail = get_document_tool(document_id, user_email=DEMO_EMAIL)
    assert detail["document"]["id"] == document_id
    assert "content" in detail["document"]

    comments = get_comments_tool(document_id, user_email=DEMO_EMAIL)
    assert "threads" in comments

    search = search_documents_tool(detail["document"]["title"][:4] or "CloudDoc", user_email=DEMO_EMAIL)
    assert "documents" in search


def test_read_only_mcp_space_tool() -> None:
    spaces = list_spaces_tool(user_email=DEMO_EMAIL)
    assert "spaces" in spaces
    assert isinstance(spaces["spaces"], list)


def test_mcp_create_folder_tool() -> None:
    space_id = _first_space_id()
    payload = create_folder_tool(
        space_id=space_id,
        title="pytest-mcp-folder-create",
        visibility="private",
        user_email=DEMO_EMAIL,
    )
    folder_id = payload["folder"]["id"]
    try:
        assert payload["folder"]["title"] == "pytest-mcp-folder-create"
        assert payload["folder"]["space_id"] == space_id
        assert payload["folder"]["can_manage"] is True
    finally:
        db = SessionLocal()
        try:
            db.execute(delete(Folder).where(Folder.id == folder_id))
            db.commit()
        finally:
            db.close()


def test_default_mcp_actor_is_guest_without_extra_permissions(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLOUDDOC_MCP_ACTOR_EMAIL", raising=False)
    space_id = _first_space_id()
    create_payload = create_document_tool(
        space_id=space_id,
        title="pytest-mcp-private-guest-denied",
        visibility="private",
        user_email=DEMO_EMAIL,
    )
    document_id = create_payload["document"]["id"]

    try:
        with pytest.raises(MCPBridgeError) as exc_info:
            get_document_tool(document_id)
        assert exc_info.value.code == "unauthorized"

        db = SessionLocal()
        try:
            guest = db.scalar(select(User).where(User.email == MCP_GUEST_EMAIL).limit(1))
            assert guest is not None
            assert guest.is_active is True
            membership = db.scalar(select(OrganizationMember.id).where(OrganizationMember.user_id == guest.id).limit(1))
            assert membership is None
            direct_permission = db.scalar(
                select(DocumentPermission.id)
                .where(DocumentPermission.subject_type == "user")
                .where(DocumentPermission.subject_id == guest.id)
                .limit(1)
            )
            assert direct_permission is None
        finally:
            db.close()
    finally:
        _cleanup_document(document_id)


def test_mcp_document_read_scope_includes_public_and_folder_filter_while_writes_stay_owned() -> None:
    _ensure_outsider_user()
    space_id = _first_space_id()
    folder_id: str | None = None
    public_document_id: str | None = None
    private_document_id: str | None = None
    other_public_document_id: str | None = None

    try:
        db = SessionLocal()
        try:
            owner = db.scalar(select(User).where(User.email == DEMO_EMAIL).limit(1))
            assert owner is not None
            folder = Folder(
                space_id=space_id,
                parent_folder_id=None,
                creator_id=owner.id,
                owner_id=owner.id,
                title="pytest-mcp-folder-filter",
                visibility="public",
                icon="folder",
            )
            db.add(folder)
            db.commit()
            db.refresh(folder)
            folder_id = folder.id
        finally:
            db.close()

        public_payload = create_document_tool(
            space_id=space_id,
            title="pytest-mcp-public-readable",
            visibility="public",
            folder_id=folder_id,
            user_email=DEMO_EMAIL,
        )
        public_document_id = public_payload["document"]["id"]
        private_payload = create_document_tool(
            space_id=space_id,
            title="pytest-mcp-private-denied",
            visibility="private",
            user_email=DEMO_EMAIL,
        )
        private_document_id = private_payload["document"]["id"]
        other_public_payload = create_document_tool(
            space_id=space_id,
            title="pytest-mcp-public-outside-folder",
            visibility="public",
            user_email=DEMO_EMAIL,
        )
        other_public_document_id = other_public_payload["document"]["id"]

        detail = get_document_tool(public_document_id, user_email=OUTSIDER_EMAIL)
        assert detail["document"]["id"] == public_document_id
        assert detail["document"]["can_edit"] is False
        assert detail["document"]["can_manage"] is False

        with pytest.raises(MCPBridgeError) as exc_info:
            get_document_tool(private_document_id, user_email=OUTSIDER_EMAIL)
        assert exc_info.value.code == "unauthorized"

        search_payload = search_documents_tool("pytest-mcp-public-readable", user_email=OUTSIDER_EMAIL)
        assert any(item["id"] == public_document_id for item in search_payload["documents"])
        assert all(item["id"] != private_document_id for item in search_payload["documents"])

        list_payload = list_documents_tool(state="all", user_email=OUTSIDER_EMAIL)
        assert any(item["id"] == public_document_id for item in list_payload["documents"])
        assert all(item["id"] != private_document_id for item in list_payload["documents"])

        folder_payload = list_documents_tool(state="active", folder_id=folder_id, user_email=OUTSIDER_EMAIL)
        assert any(item["id"] == public_document_id for item in folder_payload["documents"])
        assert all(item["id"] != other_public_document_id for item in folder_payload["documents"])

        with pytest.raises(MCPBridgeError) as exc_info:
            update_document_content_tool(
                document_id=public_document_id,
                content_json={"type": "doc", "version": 1, "content": []},
                plain_text="outsider update rejected",
                user_email=OUTSIDER_EMAIL,
            )
        assert exc_info.value.code == "unauthorized"

        with pytest.raises(MCPBridgeError) as exc_info:
            delete_document_tool(public_document_id, user_email=OUTSIDER_EMAIL)
        assert exc_info.value.code == "unauthorized"
    finally:
        for document_id in (public_document_id, private_document_id, other_public_document_id):
            if document_id is not None:
                _cleanup_document(document_id)
        if folder_id is not None:
            db = SessionLocal()
            try:
                db.execute(delete(Folder).where(Folder.id == folder_id))
                db.commit()
            finally:
                db.close()


def test_read_only_mcp_shared_document_tool() -> None:
    document_id = _first_visible_document_id()
    token = f"pytest-mcp-{secrets.token_urlsafe(12)}"
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        assert document is not None
        share = ShareLink(
            document_id=document_id,
            token=token,
            access_scope="public",
            permission_level="view",
            is_active=True,
            created_by=document.owner_id,
        )
        db.add(share)
        db.commit()

        payload = get_shared_document_tool(token)
        assert payload["status"] == "ok"
        assert payload["document"]["id"] == document_id
        assert payload["document"]["can_edit"] is False
    finally:
        db.execute(delete(ShareLink).where(ShareLink.token == token))
        db.commit()
        db.close()


def test_write_mcp_tools_create_update_comment_reply_and_favorite() -> None:
    created_document_id: str | None = None
    space_id = _first_space_id()
    create_payload = create_document_tool(space_id=space_id, title="pytest-mcp-write", user_email=DEMO_EMAIL)
    created_document_id = create_payload["document"]["id"]

    try:
        content_json = {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "attrs": {"block_id": "mcp-block-1", "raw_text": "hello from mcp"},
                    "content": [{"type": "text", "text": "hello from mcp"}],
                }
            ],
        }
        update_payload = update_document_content_tool(
            document_id=created_document_id,
            content_json=content_json,
            plain_text="hello from mcp",
            user_email=DEMO_EMAIL,
        )
        assert update_payload["document"]["content"]["plain_text"] == "hello from mcp"

        comment_payload = create_comment_tool(
            document_id=created_document_id,
            block_id="mcp-block-1",
            start_offset=0,
            end_offset=5,
            quote_text="hello",
            body="MCP comment",
            user_email=DEMO_EMAIL,
        )
        thread_id = comment_payload["thread"]["id"]
        parent_comment_id = comment_payload["thread"]["comments"][0]["id"]

        reply_payload = reply_comment_tool(
            thread_id=thread_id,
            parent_comment_id=parent_comment_id,
            body="MCP reply",
            user_email=DEMO_EMAIL,
        )
        assert len(reply_payload["thread"]["comments"]) == 2

        updated_comment = update_comment_tool(parent_comment_id, "MCP comment edited", user_email=DEMO_EMAIL)
        assert updated_comment["comment"]["body"] == "MCP comment edited"

        delete_comment_payload = delete_comment_tool(parent_comment_id, user_email=DEMO_EMAIL)
        assert delete_comment_payload["deleted"]["comment_id"] == parent_comment_id
        assert delete_comment_payload["deleted"]["thread_deleted"] is False

        favorite_payload = favorite_document_tool(created_document_id, user_email=DEMO_EMAIL)
        assert favorite_payload["favorite"]["is_favorited"] is True

        delete_document_payload = delete_document_tool(created_document_id, user_email=DEMO_EMAIL)
        assert delete_document_payload["document"]["is_deleted"] is True
        restore_document_payload = restore_document_tool(created_document_id, user_email=DEMO_EMAIL)
        assert restore_document_payload["document"]["is_deleted"] is False

        db = SessionLocal()
        try:
            audit_count = db.query(MCPAuditLog).filter(MCPAuditLog.target_id == created_document_id).count()
            assert audit_count >= 3
            assert db.scalar(select(Space).where(Space.id == space_id)) is not None
        finally:
            db.close()
    finally:
        if created_document_id is not None:
            _cleanup_document(created_document_id)
