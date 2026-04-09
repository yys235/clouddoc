from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.space import SpaceSummary
from app.services.auth_service import optional_current_user_dependency
from app.services.space_service import list_spaces

router = APIRouter()


@router.get("", response_model=list[SpaceSummary])
def list_spaces_route(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> list[SpaceSummary]:
    return list_spaces(db, user_id=current_user.id if current_user else None)
