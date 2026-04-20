from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.core.config import settings
from app.main import app
from app.models.organization import Organization, OrganizationMember
from app.models.preference import UserPreference
from app.models.session import UserSession
from app.models.space import Space
from app.models.user import User
from app.services.submission_guard_service import submission_guard


client = TestClient(app)


def cleanup_user(email: str) -> None:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            return
        db.execute(delete(UserSession).where(UserSession.user_id == user.id))
        db.execute(delete(UserPreference).where(UserPreference.user_id == user.id))
        db.execute(delete(Space).where(Space.owner_id == user.id))
        db.execute(delete(OrganizationMember).where(OrganizationMember.user_id == user.id))
        db.execute(delete(Organization).where(Organization.owner_id == user.id))
        db.execute(delete(User).where(User.id == user.id))
        db.commit()
    finally:
        db.close()


def test_auth_me_does_not_bootstrap_demo_session_by_default() -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json() is None
    assert "clouddoc_session" not in response.cookies


def test_auth_me_can_explicitly_bootstrap_demo_session_in_development() -> None:
    response = client.get("/api/auth/me?bootstrap=true")
    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == "demo@clouddoc.local"
    assert "clouddoc_session" in response.cookies


def test_login_and_logout_demo_user() -> None:
    login_response = client.post(
        "/api/auth/login",
        json={"email": "demo@clouddoc.local", "password": "demo123456"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["email"] == "demo@clouddoc.local"
    assert "clouddoc_session" in login_response.cookies

    authed_client = TestClient(app)
    authed_client.cookies = login_response.cookies
    me_response = authed_client.get("/api/auth/require")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "demo@clouddoc.local"

    logout_response = authed_client.post("/api/auth/logout")
    assert logout_response.status_code == 204


def test_duplicate_submission_key_rejects_in_flight_mutation() -> None:
    login_response = client.post(
        "/api/auth/login",
        json={"email": "demo@clouddoc.local", "password": "demo123456"},
    )
    assert login_response.status_code == 200

    authed_client = TestClient(app)
    authed_client.cookies = login_response.cookies
    session_token = login_response.cookies.get(settings.session_cookie_name)
    submission_key = f"pytest-{uuid4()}"
    guard_key = f"{session_token}:POST:/api/auth/logout:{submission_key}"
    assert submission_guard.acquire(guard_key)
    try:
        response = authed_client.post("/api/auth/logout", headers={"X-CloudDoc-Submission-Key": submission_key})
        assert response.status_code == 409
        assert response.json()["detail"] == "Duplicate submission is already being processed"
    finally:
        submission_guard.release(guard_key)


def test_list_and_revoke_sessions() -> None:
    login_response = client.post(
        "/api/auth/login",
        json={"email": "demo@clouddoc.local", "password": "demo123456"},
    )
    assert login_response.status_code == 200

    authed_client = TestClient(app)
    authed_client.cookies = login_response.cookies

    sessions_response = authed_client.get("/api/sessions")
    assert sessions_response.status_code == 200
    sessions = sessions_response.json()
    assert len(sessions) >= 1
    current_session = next((session for session in sessions if session["is_current"]), None)
    assert current_session is not None

    revoke_response = authed_client.delete(f"/api/sessions/{current_session['id']}")
    assert revoke_response.status_code == 204


def test_register_creates_user_org_spaces_and_session() -> None:
    email = f"pytest-auth-{uuid4()}@example.com"
    try:
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Pytest Auth",
                "email": email,
                "password": "pytest-pass-123",
                "organization_name": "Pytest Org",
            },
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["user"]["email"] == email
        assert "clouddoc_session" in response.cookies

        db = SessionLocal()
        try:
            user = db.scalar(select(User).where(User.email == email))
            assert user is not None
            assert user.password_hash.startswith("pbkdf2_sha256$")

            spaces = db.scalars(select(Space).where(Space.owner_id == user.id)).all()
            assert len(spaces) >= 2
            assert any(space.space_type == "personal" for space in spaces)
            assert any(space.space_type == "team" for space in spaces)
        finally:
            db.close()
    finally:
        cleanup_user(email)


def test_user_preferences_are_persisted_per_user() -> None:
    login_response = client.post(
        "/api/auth/login",
        json={"email": "demo@clouddoc.local", "password": "demo123456"},
    )
    assert login_response.status_code == 200

    authed_client = TestClient(app)
    authed_client.cookies = login_response.cookies

    initial_response = authed_client.get("/api/preferences/me")
    assert initial_response.status_code == 200
    assert initial_response.json()["document_tree_open_mode"] in {"same-page", "new-window"}

    update_response = authed_client.patch(
        "/api/preferences/me",
        json={"document_tree_open_mode": "new-window"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["document_tree_open_mode"] == "new-window"

    persisted_response = authed_client.get("/api/preferences/me")
    assert persisted_response.status_code == 200
    assert persisted_response.json()["document_tree_open_mode"] == "new-window"

    invalid_response = authed_client.patch(
        "/api/preferences/me",
        json={"document_tree_open_mode": "side-panel"},
    )
    assert invalid_response.status_code == 422
