from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.preference import UserPreferenceResponse, UserPreferenceUpdateRequest
from app.services.auth_service import require_current_user_dependency
from app.services.preference_service import get_or_create_user_preference, update_user_preference

router = APIRouter(prefix="/preferences")


@router.get("/me", response_model=UserPreferenceResponse)
def get_my_preferences_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> UserPreferenceResponse:
    return UserPreferenceResponse.model_validate(get_or_create_user_preference(db, current_user.id))


@router.patch("/me", response_model=UserPreferenceResponse)
def update_my_preferences_route(
    payload: UserPreferenceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> UserPreferenceResponse:
    try:
        preference = update_user_preference(db, current_user.id, payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserPreferenceResponse.model_validate(preference)
