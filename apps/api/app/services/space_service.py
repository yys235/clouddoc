from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.organization import OrganizationMember
from app.models.space import Space
from app.schemas.space import SpaceSummary
from app.services.permission_service import can_access_space


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
