from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.main import app
from app.models.document import Document, DocumentContent, DocumentFavorite, DocumentPermission, DocumentVersion
from app.models.template import Template


client = TestClient(app)
client.get("/api/auth/me?bootstrap=true")


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


def test_list_templates_and_instantiate() -> None:
    list_response = client.get("/api/templates")
    assert list_response.status_code == 200
    templates = list_response.json()
    assert len(templates) >= 1

    template_id = templates[0]["id"]
    instantiate_response = client.post(
        f"/api/templates/{template_id}/instantiate",
        json={"title": "模板实例化测试"},
    )
    assert instantiate_response.status_code == 200
    payload = instantiate_response.json()
    document = payload["document"]
    assert document["title"] == "模板实例化测试"
    assert document["document_type"] == "doc"

    cleanup_document(document["id"])
