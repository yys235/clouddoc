from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, event, select

from app.core.db import SessionLocal
from app.main import app
from app.models.comment import Comment, CommentThread
from app.models.document import Document
from app.models.document import DocumentContent, DocumentPermission, DocumentVersion
from app.models.event import EventLog
from app.models.notification import UserNotification
from app.models.folder import Folder
from app.models.share import ShareLink
from app.models.space import Space
from app.models.user import User
from app.services.folder_service import get_space_tree, list_space_root_children
from app.services.space_service import list_spaces


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
        db.execute(delete(EventLog).where(EventLog.folder_id == folder_id))
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
        db.execute(delete(EventLog).where(EventLog.document_id == document_id))
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


def test_list_spaces_filters_by_current_actor_permissions() -> None:
    owner = User(
        name=f"space-owner-{uuid4()}",
        email=f"space-owner-{uuid4()}@example.test",
        password_hash="test",
    )
    viewer = User(
        name=f"space-viewer-{uuid4()}",
        email=f"space-viewer-{uuid4()}@example.test",
        password_hash="test",
    )
    db = SessionLocal()
    try:
        db.add_all([owner, viewer])
        db.flush()
        public_space = Space(
            name=f"pytest-public-space-{uuid4()}",
            owner_id=owner.id,
            space_type="team",
            visibility="public",
        )
        private_space = Space(
            name=f"pytest-private-space-{uuid4()}",
            owner_id=owner.id,
            space_type="team",
            visibility="private",
        )
        viewer_space = Space(
            name=f"pytest-viewer-space-{uuid4()}",
            owner_id=viewer.id,
            space_type="personal",
            visibility="private",
        )
        db.add_all([public_space, private_space, viewer_space])
        db.commit()

        anonymous_space_ids = {space.id for space in list_spaces(db)}
        viewer_space_ids = {space.id for space in list_spaces(db, viewer.id)}

        assert public_space.id in anonymous_space_ids
        assert private_space.id not in anonymous_space_ids
        assert public_space.id in viewer_space_ids
        assert viewer_space.id in viewer_space_ids
        assert private_space.id not in viewer_space_ids
    finally:
        for space_id in [locals().get("public_space"), locals().get("private_space"), locals().get("viewer_space")]:
            if space_id is not None:
                db.delete(space_id)
        for user in [owner, viewer]:
            db.delete(user)
        db.commit()
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


def test_space_tree_endpoints_do_not_issue_per_node_n_plus_one_queries() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        user_id = space.owner_id

        root_query_count = {"value": 0}
        tree_query_count = {"value": 0}

        def root_before_cursor_execute(*_args, **_kwargs):
            root_query_count["value"] += 1

        def tree_before_cursor_execute(*_args, **_kwargs):
            tree_query_count["value"] += 1

        event.listen(db.bind, "before_cursor_execute", root_before_cursor_execute)
        list_space_root_children(db, space.id, user_id)
        event.remove(db.bind, "before_cursor_execute", root_before_cursor_execute)

        event.listen(db.bind, "before_cursor_execute", tree_before_cursor_execute)
        get_space_tree(db, space.id, user_id)
        event.remove(db.bind, "before_cursor_execute", tree_before_cursor_execute)

        assert root_query_count["value"] < 40
        assert tree_query_count["value"] < 40
    finally:
        db.close()


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
        root_children_before = client.get(f"/api/spaces/{space_id}/root-children")
        assert root_children_before.status_code == 200
        root_items = root_children_before.json()["children"]
        created_keys = {
            ("folder", folder_b["id"]),
            ("folder", folder_a["id"]),
            ("folder", parent_folder["id"]),
            ("document", document["id"]),
        }
        remaining_items = [
            {"id": item["id"], "node_type": item["node_type"]}
            for item in root_items
            if (item["node_type"], item["id"]) not in created_keys
        ]

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
                    *remaining_items,
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


def test_reorder_is_scoped_to_single_parent_folder() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    parent_a = client.post("/api/folders", json={"title": f"pytest-parent-a-{uuid4()}", "space_id": space_id}).json()
    parent_b = client.post("/api/folders", json={"title": f"pytest-parent-b-{uuid4()}", "space_id": space_id}).json()
    doc_a1 = client.post(
        "/api/documents",
        json={"title": f"pytest-a1-{uuid4()}", "space_id": space_id, "document_type": "doc", "folder_id": parent_a["id"]},
    ).json()
    doc_a2 = client.post(
        "/api/documents",
        json={"title": f"pytest-a2-{uuid4()}", "space_id": space_id, "document_type": "doc", "folder_id": parent_a["id"]},
    ).json()
    doc_b1 = client.post(
        "/api/documents",
        json={"title": f"pytest-b1-{uuid4()}", "space_id": space_id, "document_type": "doc", "folder_id": parent_b["id"]},
    ).json()
    doc_b2 = client.post(
        "/api/documents",
        json={"title": f"pytest-b2-{uuid4()}", "space_id": space_id, "document_type": "doc", "folder_id": parent_b["id"]},
    ).json()

    try:
        parent_b_before = client.get(f"/api/folders/{parent_b['id']}/children")
        assert parent_b_before.status_code == 200
        parent_b_ids_before = [item["id"] for item in parent_b_before.json()["children"]]

        reorder_response = client.post(
            "/api/folders/reorder",
            json={
                "space_id": space_id,
                "parent_folder_id": parent_a["id"],
                "items": [
                    {"id": doc_a2["id"], "node_type": "document"},
                    {"id": doc_a1["id"], "node_type": "document"},
                ],
            },
        )
        assert reorder_response.status_code == 200

        parent_a_after = client.get(f"/api/folders/{parent_a['id']}/children")
        assert parent_a_after.status_code == 200
        assert [item["id"] for item in parent_a_after.json()["children"]] == [doc_a2["id"], doc_a1["id"]]

        parent_b_after = client.get(f"/api/folders/{parent_b['id']}/children")
        assert parent_b_after.status_code == 200
        assert [item["id"] for item in parent_b_after.json()["children"]] == parent_b_ids_before

        cross_parent_response = client.post(
            "/api/folders/reorder",
            json={
                "space_id": space_id,
                "parent_folder_id": parent_a["id"],
                "items": [
                    {"id": doc_a1["id"], "node_type": "document"},
                    {"id": doc_b1["id"], "node_type": "document"},
                ],
            },
        )
        assert cross_parent_response.status_code == 400
    finally:
        cleanup_document(doc_a1["id"])
        cleanup_document(doc_a2["id"])
        cleanup_document(doc_b1["id"])
        cleanup_document(doc_b2["id"])
        cleanup_folder(parent_a["id"])
        cleanup_folder(parent_b["id"])
