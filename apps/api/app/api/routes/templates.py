from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.template import (
    TemplateDetail,
    TemplateInstantiateRequest,
    TemplateInstantiateResponse,
    TemplateSummary,
)
from app.services.auth_service import optional_current_user_dependency, require_current_user_dependency
from app.services.template_service import get_template, instantiate_template, list_templates

router = APIRouter()


@router.get("", response_model=list[TemplateSummary])
def list_templates_route(
    db: Session = Depends(get_db),
    _: User | None = Depends(optional_current_user_dependency),
) -> list[TemplateSummary]:
    return list_templates(db)


@router.get("/{template_id}", response_model=TemplateDetail)
def get_template_route(
    template_id: str,
    db: Session = Depends(get_db),
    _: User | None = Depends(optional_current_user_dependency),
) -> TemplateDetail:
    template = get_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/{template_id}/instantiate", response_model=TemplateInstantiateResponse)
def instantiate_template_route(
    template_id: str,
    payload: TemplateInstantiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> TemplateInstantiateResponse:
    response = instantiate_template(db, template_id, payload, current_user.id)
    if response is None:
        raise HTTPException(status_code=404, detail="Template or target space not found")
    return response
