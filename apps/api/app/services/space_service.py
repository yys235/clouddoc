from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.organization import OrganizationMember
from app.models.space import Space
from app.schemas.space import SpaceSummary
from app.services.permission_service import can_access_space, can_manage_space


def list_spaces(db: Session, user_id: str | None = None) -> list[SpaceSummary]:
    statement = select(Space)
    if user_id is not None:
        membership_subquery = (
            select(OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user_id)
            .where(OrganizationMember.status == "active")
        )
        statement = statement.where(
            or_(
                Space.visibility == "public",
                Space.owner_id == user_id,
                Space.organization_id.in_(membership_subquery),
            )
        )
    statement = statement.order_by(Space.updated_at.desc())
    spaces = db.scalars(statement).all()
    return [
        SpaceSummary.model_validate(space)
        for space in spaces
        if can_access_space(db, space, user_id)
    ]


def update_space_name(db: Session, space_id: str, name: str, user_id: str) -> SpaceSummary | None:
    space = db.get(Space, space_id)
    if space is None:
        return None
    if not can_manage_space(db, space, user_id):
        raise PermissionError("Not allowed to rename this space")
    normalized_name = name.strip()
    if not normalized_name:
        raise ValueError("Space name is required")
    if len(normalized_name) > 120:
        raise ValueError("Space name must be 120 characters or fewer")
    space.name = normalized_name
    db.commit()
    db.refresh(space)
    return SpaceSummary.model_validate(space)
