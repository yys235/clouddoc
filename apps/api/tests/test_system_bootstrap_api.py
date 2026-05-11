from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.cli import main as cli_main
from app.core.db import SessionLocal
from app.main import app
from app.models.document import Document, DocumentContent, DocumentVersion
from app.models.folder import Folder
from app.models.organization import Organization, OrganizationMember
from app.models.session import UserSession
from app.models.space import Space
from app.models.system import SystemAuditLog, SystemSettings
from app.models.user import User

client = TestClient(app)


def _snapshot_initialization_state():
    db = SessionLocal()
    try:
        settings_row = db.scalar(select(SystemSettings).order_by(SystemSettings.created_at.asc()).limit(1))
        user_flags = [(user.id, user.is_super_admin) for user in db.scalars(select(User)).all()]
        return {
            "settings_id": settings_row.id if settings_row else None,
            "settings_initialized": settings_row.initialized if settings_row else None,
            "settings_initialized_by": settings_row.initialized_by if settings_row else None,
            "user_flags": user_flags,
        }
    finally:
        db.close()


def _restore_initialization_state(snapshot, created_email: str | None = None) -> None:
    db = SessionLocal()
    try:
        if created_email:
            user = db.scalar(select(User).where(User.email == created_email))
            if user is not None:
                for settings_row in db.scalars(select(SystemSettings)).all():
                    if settings_row.initialized_by == user.id:
                        settings_row.initialized_by = None
                db.flush()
                document_ids = db.scalars(select(Document.id).where(Document.owner_id == user.id)).all()
                if document_ids:
                    for document in db.scalars(select(Document).where(Document.id.in_(document_ids))).all():
                        document.current_version_id = None
                    db.flush()
                    db.execute(delete(DocumentVersion).where(DocumentVersion.document_id.in_(document_ids)))
                    db.execute(delete(DocumentContent).where(DocumentContent.document_id.in_(document_ids)))
                    db.execute(delete(Document).where(Document.id.in_(document_ids)))
                db.execute(delete(SystemAuditLog).where(SystemAuditLog.actor_id == user.id))
                db.execute(delete(UserSession).where(UserSession.user_id == user.id))
                db.execute(delete(Folder).where(Folder.owner_id == user.id))
                db.execute(delete(Space).where(Space.owner_id == user.id))
                db.execute(delete(OrganizationMember).where(OrganizationMember.user_id == user.id))
                db.execute(delete(Organization).where(Organization.owner_id == user.id))
                db.execute(delete(User).where(User.id == user.id))

        for user_id, is_super_admin in snapshot["user_flags"]:
            user = db.get(User, user_id)
            if user is not None:
                user.is_super_admin = is_super_admin

        if snapshot["settings_id"]:
            settings_row = db.get(SystemSettings, snapshot["settings_id"])
            if settings_row is not None:
                settings_row.initialized = bool(snapshot["settings_initialized"])
                settings_row.initialized_by = snapshot["settings_initialized_by"]
        db.commit()
    finally:
        db.close()


def _force_uninitialized() -> None:
    db = SessionLocal()
    try:
        settings_row = db.scalar(select(SystemSettings).order_by(SystemSettings.created_at.asc()).limit(1))
        if settings_row is None:
            settings_row = SystemSettings(initialized=False)
            db.add(settings_row)
        settings_row.initialized = False
        settings_row.initialized_by = None
        for user in db.scalars(select(User)).all():
            user.is_super_admin = False
        db.commit()
    finally:
        db.close()


def test_bootstrap_status_reports_initialized_for_seeded_development() -> None:
    response = client.get("/api/system/bootstrap/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["initialized"] is True
    assert payload["needs_setup"] is False
    assert payload["has_super_admin"] is True


def test_uninitialized_system_locks_business_api() -> None:
    snapshot = _snapshot_initialization_state()
    try:
        _force_uninitialized()
        response = client.get("/api/documents")
        assert response.status_code == 423
        assert response.json()["detail"]["code"] == "system_not_initialized"
    finally:
        _restore_initialization_state(snapshot)


def test_initialize_system_creates_admin_org_space_and_locks_repeat() -> None:
    snapshot = _snapshot_initialization_state()
    email = f"pytest-bootstrap-{uuid4()}@example.com"
    try:
        _force_uninitialized()
        response = client.post(
            "/api/system/bootstrap/initialize",
            json={
                "admin_name": "Bootstrap Admin",
                "admin_email": email,
                "admin_password": "bootstrap-pass-123",
                "organization_name": "Bootstrap Org",
                "space_name": "Bootstrap Space",
                "space_visibility": "organization",
                "allow_public_documents": True,
                "allow_share_links": True,
                "share_password_required_by_default": False,
                "allow_guest_public_read": True,
                "allow_user_pat": True,
                "allow_open_api": True,
                "import_demo_data": True,
            },
        )
        assert response.status_code == 200
        assert response.json()["initialized"] is True
        assert "clouddoc_session" in response.cookies

        db = SessionLocal()
        try:
            admin = db.scalar(select(User).where(User.email == email))
            assert admin is not None
            assert admin.is_super_admin is True
            assert db.scalar(select(Organization).where(Organization.owner_id == admin.id)) is not None
            assert db.scalar(select(Space).where(Space.owner_id == admin.id)) is not None
            assert db.scalar(select(Folder).where(Folder.owner_id == admin.id).where(Folder.title == "newdoc")) is not None
            assert db.scalar(select(Document).where(Document.owner_id == admin.id).where(Document.title == "CloudDoc 使用示例")) is not None
            assert db.scalar(select(SystemAuditLog).where(SystemAuditLog.action == "system.bootstrap.initialized")) is not None
        finally:
            db.close()

        repeat_response = client.post(
            "/api/system/bootstrap/initialize",
            json={
                "admin_name": "Another Admin",
                "admin_email": f"repeat-{email}",
                "admin_password": "bootstrap-pass-123",
                "organization_name": "Another Org",
                "space_name": "Another Space",
            },
        )
        assert repeat_response.status_code == 409

        settings_response = client.get("/api/system/settings")
        assert settings_response.status_code == 200
        settings_payload = settings_response.json()
        assert settings_payload["initialized"] is True
        assert settings_payload["initialized_by_email"] == email
        assert settings_payload["recent_audit_logs"]
    finally:
        _restore_initialization_state(snapshot, created_email=email)


def test_cli_initialize_system_creates_super_admin_without_web_session(capsys) -> None:
    snapshot = _snapshot_initialization_state()
    email = f"pytest-cli-bootstrap-{uuid4()}@example.com"
    try:
        _force_uninitialized()
        exit_code = cli_main(
            [
                "init-system",
                "--admin-email",
                email,
                "--admin-name",
                "CLI Admin",
                "--admin-password",
                "cli-bootstrap-pass-123",
                "--organization-name",
                "CLI Bootstrap Org",
                "--space-name",
                "CLI Bootstrap Space",
                "--space-visibility",
                "private",
                "--allow-open-api",
                "false",
                "--import-demo-data",
                "false",
            ]
        )
        assert exit_code == 0
        output = capsys.readouterr().out
        assert '"initialized": true' in output

        db = SessionLocal()
        try:
            admin = db.scalar(select(User).where(User.email == email))
            assert admin is not None
            assert admin.is_super_admin is True
            settings_row = db.scalar(select(SystemSettings).order_by(SystemSettings.created_at.asc()).limit(1))
            assert settings_row is not None
            assert settings_row.initialized is True
            assert settings_row.allow_open_api is False
            assert db.scalar(
                select(SystemAuditLog)
                .where(SystemAuditLog.actor_id == admin.id)
                .where(SystemAuditLog.actor_type == "cli")
            ) is not None
        finally:
            db.close()
    finally:
        _restore_initialization_state(snapshot, created_email=email)
