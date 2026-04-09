from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CurrentOrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    owner_id: str
    role: str
    member_count: int
    created_at: datetime
    updated_at: datetime


class OrganizationMemberResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    role: str
    status: str
    joined_at: datetime


class OrganizationCreateRequest(BaseModel):
    name: str


class OrganizationInviteRequest(BaseModel):
    email: str
    role: str = "member"


class OrganizationInvitationResponse(BaseModel):
    id: str
    organization_id: str
    email: str
    role: str
    status: str
    expires_at: datetime
    created_at: datetime


class OrganizationMemberUpdateRequest(BaseModel):
    role: str | None = None
    status: str | None = None
