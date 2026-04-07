from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.main import app
from app.models.document import Document, DocumentContent, DocumentPermission, DocumentVersion
from app.models.space import Space


client = TestClient(app)


def cleanup_document(document_id: str) -> None:
    db = SessionLocal()
    try:
        upload_file_path: Path | None = None
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

        db.execute(delete(DocumentPermission).where(DocumentPermission.document_id == document_id))
        db.execute(delete(DocumentVersion).where(DocumentVersion.document_id == document_id))
        db.execute(delete(DocumentContent).where(DocumentContent.document_id == document_id))
        db.execute(delete(Document).where(Document.id == document_id))
        db.commit()
        if upload_file_path is not None and upload_file_path.exists():
            upload_file_path.unlink()
    finally:
        db.close()


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
