from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.preference import UserPreference
from app.schemas.preference import UserPreferenceUpdateRequest


def get_or_create_user_preference(db: Session, user_id: str) -> UserPreference:
    preference = db.scalar(select(UserPreference).where(UserPreference.user_id == user_id))
    if preference is not None:
        return preference

    preference = UserPreference(user_id=user_id, document_tree_open_mode="same-page")
    db.add(preference)
    db.commit()
    db.refresh(preference)
    return preference


def update_user_preference(db: Session, user_id: str, payload: UserPreferenceUpdateRequest) -> UserPreference:
    preference = get_or_create_user_preference(db, user_id)
    if payload.document_tree_open_mode is not None:
        preference.document_tree_open_mode = payload.document_tree_open_mode
    db.commit()
    db.refresh(preference)
    return preference
