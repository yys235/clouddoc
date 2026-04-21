import json
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.main import app
from app.core.db import SessionLocal
from app.models.document import Document, DocumentContent, DocumentFavorite, DocumentPermission, DocumentPermissionSettings, DocumentVersion
from app.models.event import EventLog
from app.models.integration import (
    Integration,
    IntegrationAuditLog,
    IntegrationResourceScope,
    IntegrationToken,
    IntegrationWebhook,
    IntegrationWebhookDelivery,
    OAuthAuthorizationCode,
    OAuthRefreshToken,
)
from app.models.folder import Folder
from app.models.notification import UserNotification
from app.models.organization import Organization, OrganizationInvitation, OrganizationMember
from app.models.preference import UserPreference
from app.models.share import ShareLink
from app.models.space import Space
from app.models.session import UserSession
from app.models.user import User


def register_user_client(name: str, email: str) -> TestClient:
    client = TestClient(app)
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "pytest-password", "organization_name": f"{name} Org"},
    )
    assert response.status_code == 201
    return client


def cleanup_user(email: str) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            return
        document_ids = db.scalars(select(Document.id).where(Document.owner_id == user.id)).all()
        if document_ids:
            db.execute(delete(EventLog).where(EventLog.document_id.in_(document_ids)))
            db.execute(delete(IntegrationAuditLog).where(IntegrationAuditLog.target_id.in_(document_ids)))
            db.execute(delete(DocumentFavorite).where(DocumentFavorite.document_id.in_(document_ids)))
            db.execute(delete(DocumentPermission).where(DocumentPermission.document_id.in_(document_ids)))
            db.execute(delete(DocumentPermissionSettings).where(DocumentPermissionSettings.document_id.in_(document_ids)))
            db.execute(delete(ShareLink).where(ShareLink.document_id.in_(document_ids)))
            for document in db.scalars(select(Document).where(Document.id.in_(document_ids))).all():
                document.current_version_id = None
            db.flush()
            db.execute(delete(DocumentVersion).where(DocumentVersion.document_id.in_(document_ids)))
            db.execute(delete(DocumentContent).where(DocumentContent.document_id.in_(document_ids)))
            db.execute(delete(Document).where(Document.id.in_(document_ids)))

        integration_ids = db.scalars(select(Integration.id).where(Integration.created_by == user.id)).all()
        if integration_ids:
            webhook_ids = db.scalars(select(IntegrationWebhook.id).where(IntegrationWebhook.integration_id.in_(integration_ids))).all()
            if webhook_ids:
                db.execute(delete(IntegrationWebhookDelivery).where(IntegrationWebhookDelivery.webhook_id.in_(webhook_ids)))
                db.execute(delete(IntegrationWebhook).where(IntegrationWebhook.id.in_(webhook_ids)))
            db.execute(delete(IntegrationAuditLog).where(IntegrationAuditLog.integration_id.in_(integration_ids)))
            db.execute(delete(IntegrationResourceScope).where(IntegrationResourceScope.integration_id.in_(integration_ids)))
            db.execute(delete(OAuthAuthorizationCode).where(OAuthAuthorizationCode.integration_id.in_(integration_ids)))
            db.execute(delete(OAuthRefreshToken).where(OAuthRefreshToken.integration_id.in_(integration_ids)))
            db.execute(delete(IntegrationToken).where(IntegrationToken.integration_id.in_(integration_ids)))
            db.execute(delete(Integration).where(Integration.id.in_(integration_ids)))
        db.execute(delete(IntegrationAuditLog).where(IntegrationAuditLog.actor_id == user.id))
        db.execute(delete(OAuthAuthorizationCode).where(OAuthAuthorizationCode.user_id == user.id))
        db.execute(delete(OAuthRefreshToken).where(OAuthRefreshToken.user_id == user.id))
        db.execute(delete(IntegrationToken).where(IntegrationToken.user_id == user.id))
        db.execute(delete(UserNotification).where(UserNotification.user_id == user.id))
        db.execute(delete(UserNotification).where(UserNotification.actor_id == user.id))
        db.execute(delete(UserPreference).where(UserPreference.user_id == user.id))
        db.execute(delete(UserSession).where(UserSession.user_id == user.id))
        db.execute(delete(Folder).where(Folder.owner_id == user.id))
        db.execute(delete(Space).where(Space.owner_id == user.id))
        organization_ids = db.scalars(select(Organization.id).where(Organization.owner_id == user.id)).all()
        if organization_ids:
            db.execute(delete(OrganizationInvitation).where(OrganizationInvitation.organization_id.in_(organization_ids)))
            db.execute(delete(OrganizationMember).where(OrganizationMember.organization_id.in_(organization_ids)))
            db.execute(delete(Space).where(Space.organization_id.in_(organization_ids)))
            db.execute(delete(Organization).where(Organization.id.in_(organization_ids)))
        db.execute(delete(OrganizationInvitation).where(OrganizationInvitation.invited_by == user.id))
        db.execute(delete(OrganizationMember).where(OrganizationMember.user_id == user.id))
        db.delete(user)
        db.commit()


def first_space_id(client: TestClient) -> str:
    response = client.get("/api/spaces")
    assert response.status_code == 200
    return response.json()[0]["id"]


def test_personal_access_token_markdown_write_and_revoke() -> None:
    email = f"pytest-open-token-{uuid4()}@example.com"
    client = register_user_client("Open Token User", email)
    space_id = first_space_id(client)

    try:
        create_token = client.post(
            "/api/tokens",
            json={
                "name": "pytest personal token",
                "scopes": ["documents:read", "documents:create", "documents:update", "search:read"],
            },
        )
        assert create_token.status_code == 200
        raw_token = create_token.json()["token"]
        token_id = create_token.json()["token_summary"]["id"]
        assert raw_token.startswith("cdp_")
        assert "token" not in client.get("/api/tokens").json()[0]

        headers = {"Authorization": f"Bearer {raw_token}"}
        create_document = client.post(
            "/api/open/documents/from-markdown",
            headers=headers,
            json={
                "title": "pytest markdown",
                "space_id": space_id,
                "markdown": "# Markdown Title\n\n- First\n- Second\n\n```python\nprint('ok')\n```",
            },
        )
        assert create_document.status_code == 200
        document_id = create_document.json()["id"]
        assert create_document.json()["title"] == "Markdown Title"

        detail = client.get(f"/api/open/documents/{document_id}", headers=headers)
        assert detail.status_code == 200
        blocks = detail.json()["content"]["content_json"]["content"]
        assert any(block["type"] == "bullet_list" for block in blocks)
        assert any(block["type"] == "code_block" for block in blocks)

        logs = client.get(f"/api/tokens/{token_id}/audit-logs")
        assert logs.status_code == 200
        assert any(item["operation"] == "open.documents.create_from_markdown" for item in logs.json())
        filtered_logs = client.get(
            f"/api/tokens/{token_id}/audit-logs",
            params={"source": "rest_open_api", "response_status": "success", "target_type": "document", "q": "create_from_markdown"},
        )
        assert filtered_logs.status_code == 200
        assert filtered_logs.json()
        assert all(item["source"] == "rest_open_api" for item in filtered_logs.json())
        assert all(item["target_type"] == "document" for item in filtered_logs.json())
        assert all("create_from_markdown" in item["operation"] for item in filtered_logs.json())

        revoke = client.delete(f"/api/tokens/{token_id}")
        assert revoke.status_code == 204
        denied = client.get(f"/api/open/documents/{document_id}", headers=headers)
        assert denied.status_code == 401
    finally:
        cleanup_user(email)


def test_integration_scope_limits_document_access_and_write() -> None:
    email = f"pytest-integration-{uuid4()}@example.com"
    client = register_user_client("Integration User", email)
    space_id = first_space_id(client)

    try:
        owner_token = client.post(
            "/api/tokens",
            json={"name": "owner setup", "scopes": ["documents:read", "documents:create", "documents:update"]},
        ).json()["token"]
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        document = client.post(
            "/api/open/documents/from-markdown",
            headers=owner_headers,
            json={"title": "pytest private", "space_id": space_id, "markdown": "# Scoped Secret\n\nbody"},
        ).json()
        document_id = document["id"]

        integration = client.post("/api/integrations", json={"name": "pytest integration"})
        assert integration.status_code == 200
        integration_id = integration.json()["id"]
        integration_token = client.post(
            "/api/tokens",
            json={
                "name": "integration token",
                "integration_id": integration_id,
                "scopes": ["documents:read", "documents:update"],
            },
        )
        assert integration_token.status_code == 200
        raw_token = integration_token.json()["token"]
        headers = {"Authorization": f"Bearer {raw_token}"}

        denied_before_scope = client.get(f"/api/open/documents/{document_id}", headers=headers)
        assert denied_before_scope.status_code == 404

        scope = client.post(
            f"/api/integrations/{integration_id}/scopes",
            json={"resource_type": "document", "resource_id": document_id, "permission_level": "view"},
        )
        assert scope.status_code == 200
        assert scope.json()["resource_title"] == "Scoped Secret"
        listed_scopes = client.get(f"/api/integrations/{integration_id}/scopes")
        assert listed_scopes.status_code == 200
        assert listed_scopes.json()[0]["resource_title"] == "Scoped Secret"
        allowed_read = client.get(f"/api/open/documents/{document_id}", headers=headers)
        assert allowed_read.status_code == 200

        denied_write = client.put(
            f"/api/open/documents/{document_id}/from-markdown",
            headers=headers,
            json={"markdown": "# Updated\n\nbody"},
        )
        assert denied_write.status_code == 403

        client.delete(f"/api/integrations/{integration_id}/scopes/{scope.json()['id']}")
        scope_edit = client.post(
            f"/api/integrations/{integration_id}/scopes",
            json={"resource_type": "document", "resource_id": document_id, "permission_level": "edit"},
        )
        assert scope_edit.status_code == 200
        allowed_write = client.put(
            f"/api/open/documents/{document_id}/from-markdown",
            headers=headers,
            json={"markdown": "# Updated\n\nbody"},
        )
        assert allowed_write.status_code == 200
        assert allowed_write.json()["title"] == "Updated"
    finally:
        cleanup_user(email)


def test_integration_webhook_create_update_delete() -> None:
    email = f"pytest-webhook-{uuid4()}@example.com"
    client = register_user_client("Webhook User", email)

    try:
        integration = client.post("/api/integrations", json={"name": "pytest webhook integration"})
        assert integration.status_code == 200
        integration_id = integration.json()["id"]

        created = client.post(
            f"/api/integrations/{integration_id}/webhooks",
            json={
                "url": "https://example.com/hooks/clouddoc",
                "event_types": ["document.created", "document.updated"],
            },
        )
        assert created.status_code == 200
        payload = created.json()
        assert payload["secret"]
        webhook_id = payload["webhook"]["id"]
        assert payload["webhook"]["status"] == "active"

        listed = client.get(f"/api/integrations/{integration_id}/webhooks")
        assert listed.status_code == 200
        assert listed.json()[0]["id"] == webhook_id

        updated = client.patch(
            f"/api/integrations/{integration_id}/webhooks/{webhook_id}",
            json={"status": "disabled", "event_types": ["document.deleted"]},
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == "disabled"
        assert updated.json()["event_types"] == ["document.deleted"]

        deleted = client.delete(f"/api/integrations/{integration_id}/webhooks/{webhook_id}")
        assert deleted.status_code == 204
        listed_after_delete = client.get(f"/api/integrations/{integration_id}/webhooks")
        assert listed_after_delete.status_code == 200
        assert listed_after_delete.json() == []
    finally:
        cleanup_user(email)


def test_integration_webhook_delivery_logged_on_document_event(monkeypatch) -> None:
    import app.services.integration_service as integration_service

    email = f"pytest-webhook-delivery-{uuid4()}@example.com"
    client = register_user_client("Webhook Delivery User", email)
    space_id = first_space_id(client)

    received: list[object] = []

    class FakeResponse:
        def __init__(self, status: int = 204) -> None:
            self.status = status

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_urlopen(request, timeout=0):  # noqa: ARG001
        received.append(request)
        return FakeResponse(204)

    monkeypatch.setattr(integration_service, "urlopen", fake_urlopen)

    try:
        integration = client.post("/api/integrations", json={"name": "pytest delivery integration"})
        assert integration.status_code == 200
        integration_id = integration.json()["id"]

        scope = client.post(
            f"/api/integrations/{integration_id}/scopes",
            json={"resource_type": "space", "resource_id": space_id, "permission_level": "view", "include_children": True},
        )
        assert scope.status_code == 200

        webhook = client.post(
            f"/api/integrations/{integration_id}/webhooks",
            json={
                "url": "https://example.com/hooks/clouddoc",
                "event_types": ["document.created"],
            },
        )
        assert webhook.status_code == 200
        webhook_id = webhook.json()["webhook"]["id"]
        integration_service.deliver_webhook_event.__globals__["urlopen"] = fake_urlopen

        created = client.post(
            "/api/documents",
            json={"title": "webhook event doc", "space_id": space_id, "document_type": "doc", "visibility": "private"},
        )
        assert created.status_code == 200

        with SessionLocal() as db:
            event = db.scalar(
                select(EventLog)
                .where(EventLog.document_id == created.json()["id"])
                .where(EventLog.event_type == "document.created")
                .order_by(EventLog.created_at.desc())
                .limit(1)
            )
            assert event is not None
            webhook_model = db.get(IntegrationWebhook, webhook_id)
            assert webhook_model is not None
            integration_service.deliver_webhook_event(db, webhook_model, event.payload)
            db.commit()

        assert received
        request = received[0]
        headers = {key.lower(): value for key, value in request.header_items()}
        raw_body = getattr(request, "data", b"") or b""
        body = json.loads(raw_body.decode("utf-8") or "{}")
        assert body["event_type"] == "document.created"
        assert headers["x-clouddoc-event"] == "document.created"
        assert headers["x-clouddoc-signature"].startswith("sha256=")

        deliveries = client.get(f"/api/integrations/{integration_id}/webhooks/{webhook_id}/deliveries")
        assert deliveries.status_code == 200
        assert deliveries.json()
        assert deliveries.json()[0]["event_type"] == "document.created"
        assert deliveries.json()[0]["response_status"] == "http_204"
        retried = client.post(
            f"/api/integrations/{integration_id}/webhooks/{webhook_id}/deliveries/{deliveries.json()[0]['id']}/retry"
        )
        assert retried.status_code == 200
        assert retried.json()["response_status"] == "http_204"
    finally:
        cleanup_user(email)


def test_integration_webhook_delivery_auto_retries_until_success(monkeypatch) -> None:
    import app.services.integration_service as integration_service

    email = f"pytest-webhook-auto-retry-{uuid4()}@example.com"
    client = register_user_client("Webhook Retry User", email)
    space_id = first_space_id(client)

    attempts = {"count": 0}

    class FakeResponse:
        def __init__(self, status: int = 204) -> None:
            self.status = status

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def flaky_urlopen(request, timeout=0):  # noqa: ARG001
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise integration_service.URLError("temporary failure")
        return FakeResponse(204)

    monkeypatch.setattr(integration_service, "urlopen", flaky_urlopen)

    try:
        integration = client.post("/api/integrations", json={"name": "pytest auto retry integration"})
        assert integration.status_code == 200
        integration_id = integration.json()["id"]

        scope = client.post(
            f"/api/integrations/{integration_id}/scopes",
            json={"resource_type": "space", "resource_id": space_id, "permission_level": "view", "include_children": True},
        )
        assert scope.status_code == 200

        webhook = client.post(
            f"/api/integrations/{integration_id}/webhooks",
            json={"url": "https://example.com/hooks/retry", "event_types": ["document.created"]},
        )
        assert webhook.status_code == 200
        webhook_id = webhook.json()["webhook"]["id"]

        created = client.post(
            "/api/documents",
            json={"title": "webhook retry doc", "space_id": space_id, "document_type": "doc", "visibility": "private"},
        )
        assert created.status_code == 200

        with SessionLocal() as db:
            delivery = db.scalar(
                select(IntegrationWebhookDelivery)
                .join(IntegrationWebhook, IntegrationWebhook.id == IntegrationWebhookDelivery.webhook_id)
                .where(IntegrationWebhook.id == webhook_id)
                .order_by(IntegrationWebhookDelivery.created_at.desc())
                .limit(1)
            )
            assert delivery is not None
            assert delivery.attempt_count == 1
            assert delivery.response_status == "network_error"
            assert delivery.next_retry_at is not None

            first_retry = integration_service.retry_due_webhook_deliveries(
                db,
                now=delivery.next_retry_at + integration_service.timedelta(seconds=1),
                webhook_id=webhook_id,
            )
            assert len(first_retry) == 1
            db.refresh(delivery)
            assert delivery.attempt_count == 2
            assert delivery.response_status == "network_error"
            assert delivery.next_retry_at is not None

            second_retry = integration_service.retry_due_webhook_deliveries(
                db,
                now=delivery.next_retry_at + integration_service.timedelta(seconds=1),
                webhook_id=webhook_id,
            )
            assert len(second_retry) == 1
            db.refresh(delivery)
            assert delivery.attempt_count == 3
            assert delivery.response_status == "http_204"
            assert delivery.delivered_at is not None
            assert delivery.next_retry_at is None
        assert attempts["count"] == 3
    finally:
        cleanup_user(email)


def test_oauth_authorization_code_exchange_refresh_and_revoke() -> None:
    email = f"pytest-oauth-{uuid4()}@example.com"
    client = register_user_client("OAuth User", email)
    space_id = first_space_id(client)

    try:
        integration = client.post("/api/integrations", json={"name": "pytest oauth integration"})
        assert integration.status_code == 200
        integration_id = integration.json()["id"]
        client_id = integration.json()["client_id"]

        oauth_config = client.patch(
            f"/api/integrations/{integration_id}/oauth-config",
            json={
                "oauth_enabled": True,
                "redirect_uris": ["https://example.com/callback"],
                "rotate_client_secret": True,
            },
        )
        assert oauth_config.status_code == 200
        client_secret = oauth_config.json()["client_secret"]
        assert client_secret.startswith("cds_")

        client_meta = client.get(f"/api/oauth/clients/{client_id}")
        assert client_meta.status_code == 200
        assert client_meta.json()["id"] == integration_id
        assert client_meta.json()["oauth_enabled"] is True

        scope = client.post(
            f"/api/integrations/{integration_id}/scopes",
            json={"resource_type": "space", "resource_id": space_id, "permission_level": "view", "include_children": True},
        )
        assert scope.status_code == 200

        authorize = client.post(
            "/api/oauth/authorize",
            json={
                "client_id": client_id,
                "redirect_uri": "https://example.com/callback",
                "scopes": ["documents:read", "search:read"],
                "state": "pytest-state",
            },
        )
        assert authorize.status_code == 200
        code = authorize.json()["code"]
        assert authorize.json()["state"] == "pytest-state"

        exchanged = client.post(
            "/api/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": "https://example.com/callback",
            },
        )
        assert exchanged.status_code == 200
        access_token = exchanged.json()["access_token"]
        refresh_token = exchanged.json()["refresh_token"]
        assert access_token.startswith("cda_")
        assert refresh_token.startswith("cdr_")

        headers = {"Authorization": f"Bearer {access_token}"}
        open_list = client.get("/api/open/documents", headers=headers)
        assert open_list.status_code == 200

        refreshed = client.post(
            "/api/oauth/token",
            json={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
            },
        )
        assert refreshed.status_code == 200
        assert refreshed.json()["access_token"].startswith("cda_")

        revoked = client.post(
            "/api/oauth/revoke",
            json={"client_id": client_id, "client_secret": client_secret, "token": refresh_token},
        )
        assert revoked.status_code == 204

        denied_refresh = client.post(
            "/api/oauth/token",
            json={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
            },
        )
        assert denied_refresh.status_code == 403
    finally:
        cleanup_user(email)
