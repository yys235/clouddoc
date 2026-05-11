from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.system import (
    BootstrapInitializeRequest,
    BootstrapInitializeResponse,
    BootstrapStatusResponse,
    SystemSettingsSummaryResponse,
)
from app.services.auth_service import require_current_user_dependency
from app.services.system_service import bootstrap_status, initialize_system, system_settings_summary

router = APIRouter(prefix="/system")


@router.get("/bootstrap/status", response_model=BootstrapStatusResponse)
def bootstrap_status_route(db: Session = Depends(get_db)) -> BootstrapStatusResponse:
    return bootstrap_status(db)


@router.post("/bootstrap/initialize", response_model=BootstrapInitializeResponse)
def bootstrap_initialize_route(
    payload: BootstrapInitializeRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> BootstrapInitializeResponse:
    return initialize_system(db, payload, request=request, response=response)


@router.get("/settings", response_model=SystemSettingsSummaryResponse)
def system_settings_route(
    current_user: User = Depends(require_current_user_dependency),
    db: Session = Depends(get_db),
) -> SystemSettingsSummaryResponse:
    if not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin required")
    return system_settings_summary(db)
