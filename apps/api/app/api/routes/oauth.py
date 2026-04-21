from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.integration import (
    IntegrationSummary,
    OAuthAuthorizeRequest,
    OAuthAuthorizeResponse,
    OAuthRevokeRequest,
    OAuthTokenRequest,
    OAuthTokenResponse,
)
from app.services.auth_service import require_current_user_dependency
from app.services.integration_service import (
    create_oauth_authorization_code,
    exchange_oauth_token,
    get_integration_by_client_id,
    revoke_oauth_token,
)


router = APIRouter(prefix="/oauth")


@router.get("/clients/{client_id}", response_model=IntegrationSummary)
def get_oauth_client_route(
    client_id: str,
    db: Session = Depends(get_db),
):
    integration = get_integration_by_client_id(db, client_id)
    if integration is None or integration.status != "active" or not integration.oauth_enabled:
        raise HTTPException(status_code=404, detail="OAuth client not found")
    return integration


@router.post("/authorize", response_model=OAuthAuthorizeResponse)
def authorize_oauth_route(
    payload: OAuthAuthorizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> OAuthAuthorizeResponse:
    try:
        code, raw_code, integration = create_oauth_authorization_code(db, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OAuthAuthorizeResponse(
        code=raw_code,
        state=payload.state,
        expires_at=code.expires_at,
        integration=integration,
    )


@router.post("/token", response_model=OAuthTokenResponse)
def exchange_oauth_token_route(
    payload: OAuthTokenRequest,
    db: Session = Depends(get_db),
) -> OAuthTokenResponse:
    try:
        return exchange_oauth_token(db, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke_oauth_token_route(
    payload: OAuthRevokeRequest,
    db: Session = Depends(get_db),
) -> None:
    try:
        revoked = revoke_oauth_token(db, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not revoked:
        raise HTTPException(status_code=404, detail="OAuth token not found")
