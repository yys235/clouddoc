from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.main import app
from app.models.comment import Comment, CommentThread
from app.models.document import Document
from app.models.document import DocumentContent, DocumentPermission, DocumentVersion
from app.models.notification import UserNotification
from app.models.folder import Folder
from app.models.share import ShareLink
from app.models.space import Space


client = TestClient(app)
client.get("/api/auth/me?bootstrap=true")


def cleanup_folder(folder_id: str) -> None:
    db = SessionLocal()
    try:
        child_folders = db.scalars(select(Folder.id).where(Folder.parent_folder_id == folder_id)).all()
        for child_folder_id in child_folders:
            cleanup_folder(child_folder_id)
        document_ids = db.scalars(select(Document.id).where(Document.folder_id == folder_id)).all()
        for document_id in document_ids:
            cleanup_document(document_id)
        db.execute(delete(Folder).where(Folder.id == folder_id))
        db.commit()
    finally:
        db.close()


def cleanup_document(document_id: str) -> None:
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
        db.execute(delete(DocumentPermission).where(DocumentPermission.document_id == document_id))
        db.execute(delete(ShareLink).where(ShareLink.document_id == document_id))
        db.execute(delete(DocumentVersion).where(DocumentVersion.document_id == document_id))
        db.execute(delete(DocumentContent).where(DocumentContent.document_id == document_id))
        db.execute(delete(Document).where(Document.id == document_id))
        db.commit()
    finally:
        db.close()


def test_root_children_contains_newdoc_folder() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    response = client.get(f"/api/spaces/{space_id}/root-children")
    assert response.status_code == 200
    payload = response.json()
    assert any(item["node_type"] == "folder" and item["title"] == "newdoc" for item in payload["children"])


def test_create_folder_and_document_inside_folder() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    folder_response = client.post(
        "/api/folders",
        json={
            "title": f"pytest-folder-{uuid4()}",
            "space_id": space_id,
            "parent_folder_id": None,
        },
    )
    assert folder_response.status_code == 200
    folder_id = folder_response.json()["id"]

    create_response = client.post(
        "/api/documents",
        json={
          "title": f"pytest-doc-{uuid4()}",
          "space_id": space_id,
          "folder_id": folder_id,
          "document_type": "doc",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        children_response = client.get(f"/api/folders/{folder_id}/children")
        assert children_response.status_code == 200
        children = children_response.json()["children"]
        assert any(item["id"] == document_id and item["node_type"] == "document" for item in children)
    finally:
        cleanup_document(document_id)
        cleanup_folder(folder_id)


def test_move_document_to_folder_and_list_ancestors() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    folder_response = client.post(
        "/api/folders",
        json={
            "title": f"pytest-folder-{uuid4()}",
            "space_id": space_id,
        },
    )
    assert folder_response.status_code == 200
    folder_id = folder_response.json()["id"]

    create_response = client.post(
        "/api/documents",
        json={
            "title": f"pytest-doc-{uuid4()}",
            "space_id": space_id,
            "document_type": "doc",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        move_response = client.post(f"/api/documents/{document_id}/move", json={"folder_id": folder_id})
        assert move_response.status_code == 200
        assert move_response.json()["folder_id"] == folder_id

        ancestors_response = client.get(f"/api/documents/{document_id}/ancestors")
        assert ancestors_response.status_code == 200
        ancestors = ancestors_response.json()
        assert ancestors[-1]["id"] == folder_id
    finally:
        cleanup_document(document_id)
        cleanup_folder(folder_id)


def test_delete_non_empty_folder_fails_and_empty_folder_succeeds() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    folder_response = client.post(
        "/api/folders",
        json={
            "title": f"pytest-folder-{uuid4()}",
            "space_id": space_id,
        },
    )
    assert folder_response.status_code == 200
    folder_id = folder_response.json()["id"]

    create_response = client.post(
        "/api/documents",
        json={
            "title": f"pytest-doc-{uuid4()}",
            "space_id": space_id,
            "folder_id": folder_id,
            "document_type": "doc",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        delete_response = client.delete(f"/api/folders/{folder_id}")
        assert delete_response.status_code == 400

        client.delete(f"/api/documents/{document_id}")
        delete_again = client.delete(f"/api/folders/{folder_id}")
        assert delete_again.status_code == 200
        assert delete_again.json()["is_deleted"] is True
    finally:
        cleanup_document(document_id)
        cleanup_folder(folder_id)


def test_move_folder_and_batch_move_nodes() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    parent_folder = client.post("/api/folders", json={"title": f"pytest-folder-{uuid4()}", "space_id": space_id}).json()
    child_folder = client.post("/api/folders", json={"title": f"pytest-folder-{uuid4()}", "space_id": space_id}).json()
    document = client.post(
        "/api/documents",
        json={"title": f"pytest-doc-{uuid4()}", "space_id": space_id, "document_type": "doc"},
    ).json()

    try:
        move_folder_response = client.post(
            f"/api/folders/{child_folder['id']}/move",
            json={"parent_folder_id": parent_folder["id"]},
        )
        assert move_folder_response.status_code == 200
        assert move_folder_response.json()["parent_folder_id"] == parent_folder["id"]

        bulk_move_response = client.post(
            "/api/folders/bulk-move",
            json={
                "space_id": space_id,
                "target_folder_id": child_folder["id"],
                "folder_ids": [],
                "document_ids": [document["id"]],
            },
        )
        assert bulk_move_response.status_code == 200

        children_response = client.get(f"/api/folders/{child_folder['id']}/children")
        assert children_response.status_code == 200
        assert any(item["id"] == document["id"] for item in children_response.json()["children"])
    finally:
        cleanup_document(document["id"])
        cleanup_folder(child_folder["id"])
        cleanup_folder(parent_folder["id"])


def test_reorder_and_visibility_inheritance() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    parent_folder = client.post("/api/folders", json={"title": f"pytest-folder-{uuid4()}", "space_id": space_id}).json()
    folder_a = client.post("/api/folders", json={"title": f"pytest-folder-{uuid4()}", "space_id": space_id}).json()
    folder_b = client.post("/api/folders", json={"title": f"pytest-folder-{uuid4()}", "space_id": space_id}).json()
    document = client.post(
        "/api/documents",
        json={"title": f"pytest-doc-{uuid4()}", "space_id": space_id, "document_type": "doc"},
    ).json()

    try:
        reorder_response = client.post(
            "/api/folders/reorder",
            json={
                "space_id": space_id,
                "parent_folder_id": None,
                "items": [
                    {"id": folder_b["id"], "node_type": "folder"},
                    {"id": folder_a["id"], "node_type": "folder"},
                    {"id": parent_folder["id"], "node_type": "folder"},
                    {"id": document["id"], "node_type": "document"},
                ],
            },
        )
        assert reorder_response.status_code == 200

        root_children = client.get(f"/api/spaces/{space_id}/root-children")
        assert root_children.status_code == 200
        ids = [item["id"] for item in root_children.json()["children"]]
        assert ids.index(folder_b["id"]) < ids.index(folder_a["id"]) < ids.index(parent_folder["id"])

        moved = client.post(f"/api/documents/{document['id']}/move", json={"folder_id": parent_folder["id"]})
        assert moved.status_code == 200
        assert moved.json()["visibility"] == "private"

        update_visibility = client.patch(
            f"/api/folders/{parent_folder['id']}",
            json={"visibility": "public"},
        )
        assert update_visibility.status_code == 200

        children_response = client.get(f"/api/folders/{parent_folder['id']}/children")
        assert children_response.status_code == 200
        moved_document = next(item for item in children_response.json()["children"] if item["id"] == document["id"])
        assert moved_document["visibility"] == "public"
    finally:
        cleanup_document(document["id"])
        cleanup_folder(folder_a["id"])
        cleanup_folder(folder_b["id"])
        cleanup_folder(parent_folder["id"])
