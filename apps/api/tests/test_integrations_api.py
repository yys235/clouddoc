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
            db.execute(delete(IntegrationToken).where(IntegrationToken.integration_id.in_(integration_ids)))
            db.execute(delete(Integration).where(Integration.id.in_(integration_ids)))
        db.execute(delete(IntegrationAuditLog).where(IntegrationAuditLog.actor_id == user.id))
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
