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
client.get("/api/auth/me")


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


def test_favorite_and_unfavorite_document() -> None:
    db = SessionLocal()
    try:
        space = db.scalar(select(Space).limit(1))
        assert space is not None
        space_id = space.id
    finally:
        db.close()

    title = f"pytest-favorite-{uuid4()}"
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
        favorite_response = client.post(f"/api/documents/{document_id}/favorite")
        assert favorite_response.status_code == 200
        assert favorite_response.json()["is_favorited"] is True

        all_documents = client.get("/api/documents?state=all")
        assert all_documents.status_code == 200
        assert any(
            item["id"] == document_id and item["is_favorited"] is True
            for item in all_documents.json()
        )

        unfavorite_response = client.delete(f"/api/documents/{document_id}/favorite")
        assert unfavorite_response.status_code == 200
        assert unfavorite_response.json()["is_favorited"] is False

        all_documents_after = client.get("/api/documents?state=all")
        assert all_documents_after.status_code == 200
        assert any(
            item["id"] == document_id and item["is_favorited"] is False
            for item in all_documents_after.json()
        )
    finally:
        cleanup_document(document_id)
