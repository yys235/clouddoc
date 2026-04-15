from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.auth import AuthResponse, CurrentUserResponse, LoginRequest, RegisterRequest
from app.services.auth_service import (
    bootstrap_dev_session,
    create_user_session,
    get_current_user,
    login_user,
    logout_current_session,
    resolve_current_user,
    register_user,
)

router = APIRouter(prefix="/auth")


@router.get("/me", response_model=CurrentUserResponse | None)
def current_user_route(
    request: Request,
    response: Response,
    bootstrap: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> CurrentUserResponse | None:
    user = resolve_current_user(
        db,
        request,
        response,
        require_authenticated=False,
        allow_dev_fallback=bootstrap,
        persist_dev_session=bootstrap,
    )
    if user is None:
        return None
    return CurrentUserResponse.model_validate(user)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_route(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    try:
        user = register_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    create_user_session(db, user, request, response)
    return AuthResponse(user=CurrentUserResponse.model_validate(user), authenticated_at=datetime.now(timezone.utc))


@router.post("/login", response_model=AuthResponse)
def login_route(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    user = login_user(db, payload)
    create_user_session(db, user, request, response)
    return AuthResponse(user=CurrentUserResponse.model_validate(user), authenticated_at=datetime.now(timezone.utc))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_route(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    logout_current_session(db, request, response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/dev-bootstrap", response_model=CurrentUserResponse)
def dev_bootstrap_route(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    user = bootstrap_dev_session(db, request, response)
    return CurrentUserResponse.model_validate(user)


@router.get("/require", response_model=CurrentUserResponse)
def require_auth_route(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    user = get_current_user(request, response, db)
    return CurrentUserResponse.model_validate(user)
