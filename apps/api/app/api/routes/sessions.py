from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.session import SessionSummaryResponse
from app.services.auth_service import (
    list_user_sessions,
    require_current_user_dependency,
    revoke_user_session,
)

router = APIRouter(prefix="/sessions")


@router.get("", response_model=list[SessionSummaryResponse])
def list_sessions_route(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[SessionSummaryResponse]:
    return list_user_sessions(db, request, current_user.id)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session_route(
    session_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> Response:
    if not revoke_user_session(db, request, response, current_user.id, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
