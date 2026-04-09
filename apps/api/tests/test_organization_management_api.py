from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.main import app
from app.models.organization import Organization, OrganizationInvitation, OrganizationMember
from app.models.space import Space


client = TestClient(app)


def cleanup_organization(organization_id: str) -> None:
    db = SessionLocal()
    try:
        db.execute(delete(OrganizationInvitation).where(OrganizationInvitation.organization_id == organization_id))
        db.execute(delete(OrganizationMember).where(OrganizationMember.organization_id == organization_id))
        db.execute(delete(Space).where(Space.organization_id == organization_id))
        db.execute(delete(Organization).where(Organization.id == organization_id))
        db.commit()
    finally:
        db.close()


def test_create_organization_and_manage_members() -> None:
    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 200

    authed_client = TestClient(app)
    authed_client.cookies = me_response.cookies

    create_response = authed_client.post(
        "/api/organizations",
        json={"name": f"pytest-org-{uuid4()}"},
    )
    assert create_response.status_code == 200
    payload = create_response.json()
    organization_id = payload["id"]

    try:
        members_response = authed_client.get(f"/api/organizations/{organization_id}/members")
        assert members_response.status_code == 200
        members = members_response.json()
        assert len(members) == 1
        owner_member_id = members[0]["id"]

        invite_response = authed_client.post(
            f"/api/organizations/{organization_id}/invite",
            json={"email": f"invite-{uuid4()}@example.com", "role": "member"},
        )
        assert invite_response.status_code == 200
        assert invite_response.json()["status"] == "pending"

        patch_response = authed_client.patch(
            f"/api/organizations/{organization_id}/members/{owner_member_id}",
            json={"status": "active"},
        )
        assert patch_response.status_code == 200
        assert patch_response.json()["status"] == "active"
    finally:
        cleanup_organization(organization_id)
