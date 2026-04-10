from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.main import app
from app.models.comment import Comment, CommentThread
from app.models.document import Document, DocumentContent, DocumentPermission, DocumentVersion
from app.models.notification import UserNotification
from app.models.organization import Organization, OrganizationInvitation, OrganizationMember
from app.models.share import ShareLink
from app.models.session import UserSession
from app.models.space import Space
from app.models.user import User


client = TestClient(app)
client.get("/api/auth/me")


def cleanup_document(document_id: str) -> None:
    db = SessionLocal()
    try:
        upload_file_path: Path | None = None
        thread_ids = db.scalars(select(CommentThread.id).where(CommentThread.document_id == document_id)).all()
        comment_ids = db.scalars(select(Comment.id).where(Comment.document_id == document_id)).all()
        document = db.get(Document, document_id)
        if document is not None:
            latest_content = db.scalar(
                select(DocumentContent)
                .where(DocumentContent.document_id == document_id)
                .order_by(DocumentContent.version_no.desc())
                .limit(1)
            )
            if latest_content is not None and isinstance(latest_content.content_json, dict):
                file_info = latest_content.content_json.get("file")
                if isinstance(file_info, dict):
                    raw_url = str(file_info.get("url") or "")
                    if raw_url.startswith("/uploads/"):
                        upload_file_path = Path("uploads") / raw_url.split("/uploads/", 1)[1]
            document.current_version_id = None
            db.flush()

        if comment_ids:
            db.execute(delete(UserNotification).where(UserNotification.comment_id.in_(comment_ids)))
        if thread_ids:
            db.execute(delete(UserNotification).where(UserNotification.thread_id.in_(thread_ids)))
        db.execute(delete(UserNotification).where(UserNotification.document_id == document_id))
        db.execute(delete(Comment).where(Comment.document_id == document_id))
        db.execute(delete(CommentThread).where(CommentThread.document_id == document_id))
        db.execute(delete(DocumentPermission).where(DocumentPermission.document_id == document_id))
        db.execute(delete(ShareLink).where(ShareLink.document_id == document_id))
        db.execute(delete(DocumentVersion).where(DocumentVersion.document_id == document_id))
        db.execute(delete(DocumentContent).where(DocumentContent.document_id == document_id))
        db.execute(delete(Document).where(Document.id == document_id))
        db.commit()
        if upload_file_path is not None and upload_file_path.exists():
            upload_file_path.unlink()
    finally:
        db.close()


def cleanup_comment_thread(thread_id: str) -> None:
    db = SessionLocal()
    try:
        db.execute(delete(UserNotification).where(UserNotification.thread_id == thread_id))
        db.execute(delete(Comment).where(Comment.thread_id == thread_id))
        db.execute(delete(CommentThread).where(CommentThread.id == thread_id))
        db.commit()
    finally:
        db.close()


def cleanup_user(email: str) -> None:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            return
        db.execute(delete(UserNotification).where(UserNotification.user_id == user.id))
        db.execute(delete(UserNotification).where(UserNotification.actor_id == user.id))
        db.execute(delete(UserSession).where(UserSession.user_id == user.id))
        db.execute(delete(OrganizationInvitation).where(OrganizationInvitation.invited_by == user.id))
        db.execute(delete(Space).where(Space.owner_id == user.id))
        db.execute(delete(OrganizationMember).where(OrganizationMember.user_id == user.id))
        db.execute(delete(Organization).where(Organization.owner_id == user.id))
        db.execute(delete(User).where(User.id == user.id))
        db.commit()
    finally:
        db.close()


def grant_document_edit_permission(document_id: str, user_email: str) -> None:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == user_email))
        assert user is not None
        db.add(
            DocumentPermission(
                document_id=document_id,
                subject_type="user",
                subject_id=user.id,
                permission_level="edit",
            )
        )
        db.commit()
    finally:
        db.close()


def register_user_client(name: str, email: str, password: str) -> TestClient:
    response = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
            "organization_name": f"{name} Org",
        },
    )
    assert response.status_code == 201
    authed_client = TestClient(app)
    authed_client.cookies = response.cookies
    return authed_client


def test_soft_delete_and_restore_document() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    title = f"pytest-trash-{uuid4()}"
    create_response = client.post(
        "/api/documents",
        json={
            "title": title,
            "space_id": space_id,
            "document_type": "doc",
        },
    )
    assert create_response.status_code == 200
    payload = create_response.json()
    document_id = payload["id"]

    try:
        active_response = client.get("/api/documents?state=active")
        assert active_response.status_code == 200
        assert any(item["id"] == document_id for item in active_response.json())

        delete_response = client.delete(f"/api/documents/{document_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["is_deleted"] is True

        active_after_delete = client.get("/api/documents?state=active")
        assert all(item["id"] != document_id for item in active_after_delete.json())

        trash_response = client.get("/api/documents?state=trash")
        assert trash_response.status_code == 200
        assert any(item["id"] == document_id for item in trash_response.json())

        restore_response = client.post(f"/api/documents/{document_id}/restore")
        assert restore_response.status_code == 200
        assert restore_response.json()["is_deleted"] is False

        active_after_restore = client.get("/api/documents?state=active")
        assert any(item["id"] == document_id for item in active_after_restore.json())
    finally:
        cleanup_document(document_id)


def test_upload_pdf_document() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    title = f"pytest-pdf-{uuid4()}"
    upload_response = client.post(
        "/api/documents/upload-pdf",
        data={
            "title": title,
            "space_id": space_id,
        },
        files={
            "file": ("sample.pdf", b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF", "application/pdf")
        },
    )
    assert upload_response.status_code == 200
    payload = upload_response.json()
    document_id = payload["id"]

    try:
        assert payload["document_type"] == "pdf"
        assert payload["file_name"] == "sample.pdf"
        assert payload["mime_type"] == "application/pdf"
        assert payload["file_url"].startswith("/uploads/")

        detail_response = client.get(f"/api/documents/{document_id}")
        assert detail_response.status_code == 200
        assert detail_response.json()["document_type"] == "pdf"
    finally:
        cleanup_document(document_id)


def test_upload_image_asset() -> None:
    upload_response = client.post(
        "/api/documents/upload-image",
        files={
            "file": ("sample.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", "image/png"),
        },
    )
    assert upload_response.status_code == 200
    payload = upload_response.json()

    upload_file_path = Path("uploads") / payload["file_url"].split("/uploads/", 1)[1]
    try:
        assert payload["file_name"] == "sample.png"
        assert payload["mime_type"] == "image/png"
        assert payload["file_size"] > 0
        assert payload["file_url"].startswith("/uploads/")
        assert upload_file_path.exists()
    finally:
        if upload_file_path.exists():
            upload_file_path.unlink()


def test_comment_thread_flow() -> None:
    thread_response = client.post(
        "/api/documents/11111111-1111-1111-1111-111111111111/comments",
        json={
            "anchor": {
                "block_id": "pytest-block-1",
                "start_offset": 0,
                "end_offset": 4,
                "quote_text": "test",
                "prefix_text": "",
                "suffix_text": " tail",
            },
            "body": "first comment",
        },
    )
    assert thread_response.status_code == 200
    thread_payload = thread_response.json()
    thread_id = thread_payload["id"]

    try:
        assert thread_payload["quote_text"] == "test"
        assert thread_payload["status"] == "open"
        assert len(thread_payload["comments"]) == 1
        assert thread_payload["comments"][0]["body"] == "first comment"

        list_response = client.get("/api/documents/11111111-1111-1111-1111-111111111111/comments")
        assert list_response.status_code == 200
        assert any(item["id"] == thread_id for item in list_response.json())

        reply_response = client.post(f"/api/comments/{thread_id}/reply", json={"body": "reply body"})
        assert reply_response.status_code == 200
        assert len(reply_response.json()["comments"]) == 2
        reply_comment = reply_response.json()["comments"][1]
        assert reply_comment["parent_comment_id"] is None

        resolve_response = client.patch(f"/api/comments/{thread_id}/status", json={"status": "resolved"})
        assert resolve_response.status_code == 200
        assert resolve_response.json()["status"] == "resolved"

        comment_id = resolve_response.json()["comments"][0]["id"]
        delete_response = client.delete(f"/api/comments/{comment_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["comment_id"] == comment_id
    finally:
        cleanup_comment_thread(thread_id)


def test_nested_comment_keeps_child_when_parent_deleted() -> None:
    thread_response = client.post(
        "/api/documents/11111111-1111-1111-1111-111111111111/comments",
        json={
            "anchor": {
                "block_id": "pytest-block-nested",
                "start_offset": 0,
                "end_offset": 6,
                "quote_text": "nested",
                "prefix_text": "",
                "suffix_text": "",
            },
            "body": "parent comment",
        },
    )
    assert thread_response.status_code == 200
    thread_payload = thread_response.json()
    thread_id = thread_payload["id"]
    parent_comment_id = thread_payload["comments"][0]["id"]

    try:
        reply_response = client.post(
            f"/api/comments/{thread_id}/reply",
            json={"body": "child reply", "parent_comment_id": parent_comment_id},
        )
        assert reply_response.status_code == 200
        comments = reply_response.json()["comments"]
        assert len(comments) == 2
        assert comments[1]["parent_comment_id"] == parent_comment_id

        delete_response = client.delete(f"/api/comments/{parent_comment_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["thread_deleted"] is False
        remaining_thread = delete_response.json()["thread"]
        assert remaining_thread is not None
        remaining_comments = remaining_thread["comments"]
        assert len(remaining_comments) == 2
        assert remaining_comments[0]["id"] == parent_comment_id
        assert remaining_comments[0]["is_deleted"] is True
        assert remaining_comments[1]["is_deleted"] is False
        assert remaining_comments[1]["parent_comment_id"] == parent_comment_id
    finally:
        cleanup_comment_thread(thread_id)


def test_comment_thread_removed_when_quoted_text_deleted() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    create_response = client.post(
        "/api/documents",
        json={
            "title": f"pytest-comment-prune-{uuid4()}",
            "space_id": space_id,
            "document_type": "doc",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        save_response = client.put(
            f"/api/documents/{document_id}/content",
            json={
                "schema_version": 1,
                "plain_text": "Alpha target omega",
                "content_json": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "heading",
                            "attrs": {"level": 1, "anchor": "intro"},
                            "content": [{"type": "text", "text": "Doc title"}],
                        },
                        {
                            "type": "paragraph",
                            "attrs": {"block_id": "block-a", "raw_text": "Alpha target omega"},
                            "content": [{"type": "text", "text": "Alpha target omega"}],
                        },
                    ],
                },
            },
        )
        assert save_response.status_code == 200

        thread_response = client.post(
            f"/api/documents/{document_id}/comments",
            json={
                "anchor": {
                    "block_id": "block-a",
                    "start_offset": 6,
                    "end_offset": 12,
                    "quote_text": "target",
                    "prefix_text": "Alpha ",
                    "suffix_text": " omega",
                },
                "body": "comment body",
            },
        )
        assert thread_response.status_code == 200
        thread_id = thread_response.json()["id"]

        delete_text_response = client.put(
            f"/api/documents/{document_id}/content",
            json={
                "schema_version": 1,
                "plain_text": "Alpha omega",
                "content_json": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "heading",
                            "attrs": {"level": 1, "anchor": "intro"},
                            "content": [{"type": "text", "text": "Doc title"}],
                        },
                        {
                            "type": "paragraph",
                            "attrs": {"block_id": "block-a", "raw_text": "Alpha omega"},
                            "content": [{"type": "text", "text": "Alpha omega"}],
                        },
                    ],
                },
            },
        )
        assert delete_text_response.status_code == 200

        list_response = client.get(f"/api/documents/{document_id}/comments")
        assert list_response.status_code == 200
        assert all(item["id"] != thread_id for item in list_response.json())
    finally:
        cleanup_document(document_id)


def test_public_document_is_accessible_without_auth() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    title = f"pytest-public-{uuid4()}"
    create_response = client.post(
        "/api/documents",
        json={
            "title": title,
            "space_id": space_id,
            "document_type": "doc",
            "visibility": "private",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]
    anonymous_client = TestClient(app)

    try:
        private_detail = anonymous_client.get(f"/api/documents/{document_id}")
        assert private_detail.status_code == 404

        update_response = client.patch(
            f"/api/documents/{document_id}/access",
            json={"visibility": "public"},
        )
        assert update_response.status_code == 200
        assert update_response.json()["visibility"] == "public"

        public_detail = anonymous_client.get(f"/api/documents/{document_id}")
        assert public_detail.status_code == 200
        assert public_detail.json()["visibility"] == "public"
        assert public_detail.json()["can_edit"] is False
        assert public_detail.json()["is_shared_view"] is False
    finally:
        cleanup_document(document_id)


def test_private_document_share_password_flow() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    title = f"pytest-share-{uuid4()}"
    create_response = client.post(
        "/api/documents",
        json={
            "title": title,
            "space_id": space_id,
            "document_type": "doc",
            "visibility": "private",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        share_response = client.put(
            f"/api/documents/{document_id}/share",
            json={
                "enabled": True,
                "password": "share-pass",
                "allow_copy": False,
                "allow_export": False,
            },
        )
        assert share_response.status_code == 200
        token = share_response.json()["token"]
        assert token

        anonymous_client = TestClient(app)
        pending_response = anonymous_client.get(f"/api/share/{token}")
        assert pending_response.status_code == 200
        assert pending_response.json()["status"] == "password_required"

        invalid_password_response = anonymous_client.post(
            f"/api/share/{token}/verify-password",
            json={"password": "wrong"},
        )
        assert invalid_password_response.status_code == 403

        verified_response = anonymous_client.post(
            f"/api/share/{token}/verify-password",
            json={"password": "share-pass"},
        )
        assert verified_response.status_code == 200
        assert verified_response.json()["status"] == "ok"
        assert verified_response.json()["document"]["is_shared_view"] is True
        assert verified_response.json()["document"]["can_edit"] is False
        assert verified_response.json()["document"]["can_manage"] is False
        assert verified_response.json()["document"]["can_comment"] is False

        followup_response = anonymous_client.get(f"/api/share/{token}")
        assert followup_response.status_code == 200
        assert followup_response.json()["status"] == "ok"
    finally:
        cleanup_document(document_id)


def test_share_rotate_disable_and_expire_flow() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    title = f"pytest-share-rotate-{uuid4()}"
    create_response = client.post(
        "/api/documents",
        json={
            "title": title,
            "space_id": space_id,
            "document_type": "doc",
            "visibility": "private",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        first_share = client.put(
            f"/api/documents/{document_id}/share",
            json={"enabled": True},
        )
        assert first_share.status_code == 200
        first_token = first_share.json()["token"]
        assert first_token

        rotated_share = client.post(f"/api/documents/{document_id}/share/rotate")
        assert rotated_share.status_code == 200
        second_token = rotated_share.json()["token"]
        assert second_token and second_token != first_token

        anonymous_client = TestClient(app)
        old_token_response = anonymous_client.get(f"/api/share/{first_token}")
        assert old_token_response.status_code == 200
        assert old_token_response.json()["status"] == "not_found"

        disabled_share = client.delete(f"/api/documents/{document_id}/share")
        assert disabled_share.status_code == 200
        disabled_response = anonymous_client.get(f"/api/share/{second_token}")
        assert disabled_response.status_code == 200
        assert disabled_response.json()["status"] == "disabled"

        expired_share = client.put(
            f"/api/documents/{document_id}/share",
            json={
                "enabled": True,
                "expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
            },
        )
        assert expired_share.status_code == 200
        expired_token = expired_share.json()["token"]
        expired_response = anonymous_client.get(f"/api/share/{expired_token}")
        assert expired_response.status_code == 200
        assert expired_response.json()["status"] == "expired"
    finally:
        cleanup_document(document_id)


def test_comment_delete_permissions_for_author_and_document_owner() -> None:
    owner_email = f"pytest-owner-{uuid4()}@example.com"
    commenter_email = f"pytest-commenter-{uuid4()}@example.com"
    outsider_email = f"pytest-outsider-{uuid4()}@example.com"
    password = "pytest-pass-123"

    owner_client = register_user_client("Owner User", owner_email, password)
    commenter_client = register_user_client("Comment User", commenter_email, password)
    outsider_client = register_user_client("Outsider User", outsider_email, password)

    db = SessionLocal()
    try:
        owner_user = db.scalar(select(User).where(User.email == owner_email))
        assert owner_user is not None
        owner_space = db.scalar(select(Space).where(Space.owner_id == owner_user.id).limit(1))
        assert owner_space is not None
        owner_space_id = owner_space.id
    finally:
        db.close()

    create_response = owner_client.post(
        "/api/documents",
        json={
            "title": f"pytest-owner-doc-{uuid4()}",
            "space_id": owner_space_id,
            "document_type": "doc",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        grant_document_edit_permission(document_id, commenter_email)
        thread_response = commenter_client.post(
            f"/api/documents/{document_id}/comments",
            json={
                "anchor": {
                    "block_id": "block-a",
                    "start_offset": 0,
                    "end_offset": 4,
                    "quote_text": "test",
                    "prefix_text": "",
                    "suffix_text": "",
                },
                "body": "owner can delete this",
            },
        )
        assert thread_response.status_code == 200
        first_comment_id = thread_response.json()["comments"][0]["id"]

        forbidden_response = outsider_client.delete(f"/api/comments/{first_comment_id}")
        assert forbidden_response.status_code == 403

        owner_delete_response = owner_client.delete(f"/api/comments/{first_comment_id}")
        assert owner_delete_response.status_code == 200
        assert owner_delete_response.json()["thread_deleted"] is True

        second_thread_response = commenter_client.post(
            f"/api/documents/{document_id}/comments",
            json={
                "anchor": {
                    "block_id": "block-b",
                    "start_offset": 0,
                    "end_offset": 4,
                    "quote_text": "self",
                    "prefix_text": "",
                    "suffix_text": "",
                },
                "body": "self delete",
            },
        )
        assert second_thread_response.status_code == 200
        second_comment_id = second_thread_response.json()["comments"][0]["id"]

        self_delete_response = commenter_client.delete(f"/api/comments/{second_comment_id}")
        assert self_delete_response.status_code == 200
        assert self_delete_response.json()["thread_deleted"] is True
    finally:
        cleanup_document(document_id)
        cleanup_user(owner_email)
        cleanup_user(commenter_email)
        cleanup_user(outsider_email)


def test_comment_notifications_flow() -> None:
    owner_email = f"pytest-notify-owner-{uuid4()}@example.com"
    commenter_email = f"pytest-notify-commenter-{uuid4()}@example.com"
    password = "pytest-pass-123"

    owner_client = register_user_client("Notify Owner", owner_email, password)
    commenter_client = register_user_client("Notify Commenter", commenter_email, password)

    db = SessionLocal()
    try:
        owner_user = db.scalar(select(User).where(User.email == owner_email))
        assert owner_user is not None
        owner_space = db.scalar(select(Space).where(Space.owner_id == owner_user.id).limit(1))
        assert owner_space is not None
        owner_space_id = owner_space.id
    finally:
        db.close()

    create_response = owner_client.post(
        "/api/documents",
        json={
            "title": f"pytest-notify-doc-{uuid4()}",
            "space_id": owner_space_id,
            "document_type": "doc",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        grant_document_edit_permission(document_id, commenter_email)
        thread_response = commenter_client.post(
            f"/api/documents/{document_id}/comments",
            json={
                "anchor": {
                    "block_id": "notify-block-a",
                    "start_offset": 0,
                    "end_offset": 4,
                    "quote_text": "test",
                    "prefix_text": "",
                    "suffix_text": "",
                },
                "body": "@Notify Owner 请处理这个评论",
            },
        )
        assert thread_response.status_code == 200
        thread_id = thread_response.json()["id"]

        list_response = owner_client.get("/api/notifications")
        assert list_response.status_code == 200
        notifications = list_response.json()
        assert len(notifications) >= 1
        assert notifications[0]["thread_id"] == thread_id
        assert notifications[0]["document_id"] == document_id

        unread_response = owner_client.get("/api/notifications/unread-count")
        assert unread_response.status_code == 200
        assert unread_response.json()["unread_count"] >= 1

        notification_id = notifications[0]["id"]
        mark_read_response = owner_client.post(f"/api/notifications/{notification_id}/read")
        assert mark_read_response.status_code == 200
        assert mark_read_response.json()["is_read"] is True

        mark_all_response = owner_client.post("/api/notifications/read-all")
        assert mark_all_response.status_code == 204
    finally:
        cleanup_document(document_id)
        cleanup_user(owner_email)
        cleanup_user(commenter_email)
