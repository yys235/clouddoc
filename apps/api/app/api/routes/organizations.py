from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.organization import (
    CurrentOrganizationResponse,
    OrganizationCreateRequest,
    OrganizationInvitationResponse,
    OrganizationInviteRequest,
    OrganizationMemberResponse,
    OrganizationMemberUpdateRequest,
)
from app.services.auth_service import require_current_user_dependency
from app.services.organization_management_service import (
    create_organization,
    invite_organization_member,
    update_organization_member,
)
from app.services.organization_service import get_current_organization, list_organization_members

router = APIRouter(prefix="/organizations")


@router.get("/current", response_model=CurrentOrganizationResponse | None)
def current_organization_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> CurrentOrganizationResponse | None:
    return get_current_organization(db, current_user.id)


@router.post("", response_model=CurrentOrganizationResponse)
def create_organization_route(
    payload: OrganizationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> CurrentOrganizationResponse:
    return create_organization(db, current_user=current_user, name=payload.name)


@router.get("/{organization_id}/members", response_model=list[OrganizationMemberResponse])
def list_members_route(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[OrganizationMemberResponse]:
    members = list_organization_members(db, organization_id, current_user.id)
    if not members:
        current_org = get_current_organization(db, current_user.id)
        if current_org is None or current_org.id != organization_id:
            raise HTTPException(status_code=404, detail="Organization not found")
    return members


@router.post("/{organization_id}/invite", response_model=OrganizationInvitationResponse)
def invite_member_route(
    organization_id: str,
    payload: OrganizationInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> OrganizationInvitationResponse:
    return invite_organization_member(
        db,
        organization_id=organization_id,
        current_user=current_user,
        email=payload.email,
        role=payload.role,
    )


@router.patch("/{organization_id}/members/{member_id}", response_model=OrganizationMemberResponse)
def update_member_route(
    organization_id: str,
    member_id: str,
    payload: OrganizationMemberUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> OrganizationMemberResponse:
    return update_organization_member(
        db,
        organization_id=organization_id,
        member_id=member_id,
        current_user=current_user,
        role=payload.role,
        status_value=payload.status,
    )
