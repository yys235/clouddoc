from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.main import app
from app.models.document import (
    Document,
    DocumentContent,
    DocumentFavorite,
    DocumentPermission,
    DocumentVersion,
)
from app.models.space import Space


client = TestClient(app)


def cleanup_document(document_id: str) -> None:
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is not None:
            document.current_version_id = None
            db.flush()

        db.execute(delete(DocumentFavorite).where(DocumentFavorite.document_id == document_id))
        db.execute(delete(DocumentPermission).where(DocumentPermission.document_id == document_id))
        db.execute(delete(DocumentVersion).where(DocumentVersion.document_id == document_id))
        db.execute(delete(DocumentContent).where(DocumentContent.document_id == document_id))
        db.execute(delete(Document).where(Document.id == document_id))
        db.commit()
    finally:
        db.close()


def test_search_documents_returns_title_and_body_matches() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    title = f"搜索需求-{uuid4()}"
    create_response = client.post(
        "/api/documents",
        json={
            "title": title,
            "space_id": space_id,
            "document_type": "doc",
        },
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["id"]

    try:
        update_response = client.put(
            f"/api/documents/{document_id}/content",
            json={
                "schema_version": 1,
                "plain_text": f"{title}\n这是一份关于搜索闭环验证的正文内容",
                "content_json": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "heading",
                            "attrs": {"level": 1, "anchor": "intro"},
                            "content": [{"type": "text", "text": title}],
                        },
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": "这是一份关于搜索闭环验证的正文内容"}],
                        },
                    ],
                },
            },
        )
        assert update_response.status_code == 200

        title_search = client.get("/api/documents/search", params={"q": "搜索需求"})
        assert title_search.status_code == 200
        assert any(item["id"] == document_id for item in title_search.json())

        body_search = client.get("/api/documents/search", params={"q": "搜索闭环验证"})
        assert body_search.status_code == 200
        assert any(
            item["id"] == document_id and "搜索闭环验证" in item["excerpt"]
            for item in body_search.json()
        )

        client.delete(f"/api/documents/{document_id}")
        deleted_search = client.get("/api/documents/search", params={"q": "搜索需求"})
        assert deleted_search.status_code == 200
        assert all(item["id"] != document_id for item in deleted_search.json())
    finally:
        cleanup_document(document_id)
