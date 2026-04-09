from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.organization import Organization, OrganizationInvitation, OrganizationMember
from app.models.space import Space
from app.models.user import User
from app.schemas.organization import (
    CurrentOrganizationResponse,
    OrganizationInvitationResponse,
    OrganizationMemberResponse,
)


def _require_membership(db: Session, organization_id: str, user_id: str) -> OrganizationMember:
    membership = db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == organization_id)
        .where(OrganizationMember.user_id == user_id)
        .where(OrganizationMember.status == "active")
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to manage organization")
    return membership


def _member_response(db: Session, member: OrganizationMember) -> OrganizationMemberResponse:
    user = db.get(User, member.user_id)
    assert user is not None
    return OrganizationMemberResponse(
        id=member.id,
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=member.role,
        status=member.status,
        joined_at=member.created_at,
    )


def create_organization(db: Session, *, current_user: User, name: str) -> CurrentOrganizationResponse:
    organization = Organization(name=name.strip(), owner_id=current_user.id)
    db.add(organization)
    db.flush()

    db.add(
        OrganizationMember(
            organization_id=organization.id,
            user_id=current_user.id,
            role="owner",
            status="active",
        )
    )
    db.add(
        Space(
            organization_id=organization.id,
            owner_id=current_user.id,
            name=organization.name,
            space_type="team",
            visibility="organization",
        )
    )
    db.commit()
    db.refresh(organization)
    return CurrentOrganizationResponse(
        id=organization.id,
        name=organization.name,
        owner_id=organization.owner_id,
        role="owner",
        member_count=1,
        created_at=organization.created_at,
        updated_at=organization.updated_at,
    )


def invite_organization_member(
    db: Session,
    *,
    organization_id: str,
    current_user: User,
    email: str,
    role: str,
) -> OrganizationInvitationResponse:
    membership = _require_membership(db, organization_id, current_user.id)
    if membership.role not in {"owner", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to invite members")

    normalized_email = email.strip().lower()
    if "@" not in normalized_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email address")
    normalized_role = role.strip().lower()
    if normalized_role not in {"admin", "member"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    existing_user = db.scalar(select(User).where(User.email == normalized_email))
    if existing_user is not None:
      existing_membership = db.scalar(
          select(OrganizationMember)
          .where(OrganizationMember.organization_id == organization_id)
          .where(OrganizationMember.user_id == existing_user.id)
      )
      if existing_membership is not None:
          raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already in the organization")
      db.add(
          OrganizationMember(
              organization_id=organization_id,
              user_id=existing_user.id,
              role=normalized_role,
              status="invited",
          )
      )

    raw_token = secrets.token_urlsafe(24)
    invitation = OrganizationInvitation(
        organization_id=organization_id,
        email=normalized_email,
        role=normalized_role,
        invited_by=current_user.id,
        token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return OrganizationInvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        email=invitation.email,
        role=invitation.role,
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


def update_organization_member(
    db: Session,
    *,
    organization_id: str,
    member_id: str,
    current_user: User,
    role: str | None,
    status_value: str | None,
) -> OrganizationMemberResponse:
    membership = _require_membership(db, organization_id, current_user.id)
    if membership.role not in {"owner", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to manage members")

    target_member = db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.id == member_id)
        .where(OrganizationMember.organization_id == organization_id)
    )
    if target_member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if target_member.role == "owner" and current_user.id != target_member.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot change organization owner")

    if role is not None:
        normalized_role = role.strip().lower()
        if normalized_role not in {"owner", "admin", "member"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
        target_member.role = normalized_role

    if status_value is not None:
        normalized_status = status_value.strip().lower()
        if normalized_status not in {"active", "invited", "disabled"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
        target_member.status = normalized_status

    db.commit()
    db.refresh(target_member)
    return _member_response(db, target_member)
