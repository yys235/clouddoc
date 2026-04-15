from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_get_current_organization_and_members() -> None:
    me_response = client.get("/api/auth/me?bootstrap=true")
    assert me_response.status_code == 200
    assert "clouddoc_session" in me_response.cookies

    authed_client = TestClient(app)
    authed_client.cookies = me_response.cookies

    current_response = authed_client.get("/api/organizations/current")
    assert current_response.status_code == 200
    payload = current_response.json()
    assert payload["name"] == "CloudDoc Demo Org"
    assert payload["role"] == "owner"
    assert payload["member_count"] >= 1

    members_response = authed_client.get(f"/api/organizations/{payload['id']}/members")
    assert members_response.status_code == 200
    members = members_response.json()
    assert len(members) >= 1
    assert members[0]["email"] == "demo@clouddoc.local"
