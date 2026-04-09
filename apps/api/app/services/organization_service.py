from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.organization import Organization, OrganizationMember
from app.models.user import User
from app.schemas.organization import CurrentOrganizationResponse, OrganizationMemberResponse


def get_current_organization(db: Session, user_id: str) -> CurrentOrganizationResponse | None:
    membership = db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.user_id == user_id)
        .where(OrganizationMember.status == "active")
        .order_by(OrganizationMember.created_at.asc())
        .limit(1)
    )
    if membership is None:
        return None

    organization = db.get(Organization, membership.organization_id)
    if organization is None:
        return None

    member_count = (
        db.scalar(
            select(func.count())
            .select_from(OrganizationMember)
            .where(OrganizationMember.organization_id == organization.id)
            .where(OrganizationMember.status == "active")
        )
        or 0
    )

    return CurrentOrganizationResponse(
        id=organization.id,
        name=organization.name,
        owner_id=organization.owner_id,
        role=membership.role,
        member_count=int(member_count),
        created_at=organization.created_at,
        updated_at=organization.updated_at,
    )


def list_organization_members(
    db: Session,
    organization_id: str,
    current_user_id: str,
) -> list[OrganizationMemberResponse]:
    access = db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == organization_id)
        .where(OrganizationMember.user_id == current_user_id)
        .where(OrganizationMember.status == "active")
    )
    if access is None:
        return []

    rows = db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == organization_id)
        .order_by(OrganizationMember.created_at.asc())
    ).all()

    return [
        OrganizationMemberResponse(
            id=member.id,
            user_id=user.id,
            name=user.name,
            email=user.email,
            role=member.role,
            status=member.status,
            joined_at=member.created_at,
        )
        for member, user in rows
    ]
