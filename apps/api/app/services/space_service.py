from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.space import Space
from app.schemas.space import SpaceSummary


def list_spaces(db: Session) -> list[SpaceSummary]:
    statement = select(Space).order_by(Space.updated_at.desc())
    return [SpaceSummary.model_validate(space) for space in db.scalars(statement).all()]
