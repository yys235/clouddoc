from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.integration import (
    IntegrationAuditLogSummary,
    IntegrationCreateRequest,
    IntegrationScopeCreateRequest,
    IntegrationScopeSummary,
    IntegrationSummary,
    IntegrationUpdateRequest,
    IntegrationWebhookCreateRequest,
    IntegrationWebhookCreateResponse,
    IntegrationWebhookDeliverySummary,
    IntegrationWebhookSummary,
    IntegrationWebhookUpdateRequest,
    TokenCreateRequest,
    TokenCreateResponse,
    TokenSummary,
    TokenUpdateRequest,
)
from app.services.auth_service import require_current_user_dependency
from app.services.integration_service import (
    create_integration,
    create_integration_scope,
    create_integration_webhook,
    create_token,
    delete_integration,
    delete_integration_scope,
    delete_integration_webhook,
    list_integration_audit_logs,
    list_integration_scopes,
    list_integration_webhook_deliveries,
    list_integration_webhooks,
    list_integrations,
    list_token_audit_logs,
    list_tokens,
    retry_integration_webhook_delivery,
    revoke_token,
    update_integration,
    update_integration_webhook,
    update_token,
)

router = APIRouter()


@router.get("/tokens", response_model=list[TokenSummary])
def list_tokens_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[TokenSummary]:
    return list_tokens(db, current_user.id)


@router.post("/tokens", response_model=TokenCreateResponse)
def create_token_route(
    payload: TokenCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> TokenCreateResponse:
    try:
        token, raw_token = create_token(db, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return TokenCreateResponse(token=raw_token, token_summary=TokenSummary.model_validate(token))


@router.patch("/tokens/{token_id}", response_model=TokenSummary)
def update_token_route(
    token_id: str,
    payload: TokenUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> TokenSummary:
    token = update_token(db, token_id, payload, current_user.id)
    if token is None:
        raise HTTPException(status_code=404, detail="Token not found")
    return token


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_token_route(
    token_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> None:
    if not revoke_token(db, token_id, current_user.id):
        raise HTTPException(status_code=404, detail="Token not found")


@router.get("/tokens/{token_id}/audit-logs", response_model=list[IntegrationAuditLogSummary])
def token_audit_logs_route(
    token_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[IntegrationAuditLogSummary]:
    return list_token_audit_logs(db, token_id, current_user.id, limit)


@router.get("/integrations", response_model=list[IntegrationSummary])
def list_integrations_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[IntegrationSummary]:
    return list_integrations(db, current_user.id)


@router.post("/integrations", response_model=IntegrationSummary)
def create_integration_route(
    payload: IntegrationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> IntegrationSummary:
    return create_integration(db, payload, current_user.id)


@router.patch("/integrations/{integration_id}", response_model=IntegrationSummary)
def update_integration_route(
    integration_id: str,
    payload: IntegrationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> IntegrationSummary:
    integration = update_integration(db, integration_id, payload, current_user.id)
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.delete("/integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_integration_route(
    integration_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> None:
    if not delete_integration(db, integration_id, current_user.id):
        raise HTTPException(status_code=404, detail="Integration not found")


@router.get("/integrations/{integration_id}/scopes", response_model=list[IntegrationScopeSummary])
def list_integration_scopes_route(
    integration_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[IntegrationScopeSummary]:
    try:
        return list_integration_scopes(db, integration_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/integrations/{integration_id}/scopes", response_model=IntegrationScopeSummary)
def create_integration_scope_route(
    integration_id: str,
    payload: IntegrationScopeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> IntegrationScopeSummary:
    try:
        return create_integration_scope(db, integration_id, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/integrations/{integration_id}/scopes/{scope_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_integration_scope_route(
    integration_id: str,
    scope_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> None:
    if not delete_integration_scope(db, integration_id, scope_id, current_user.id):
        raise HTTPException(status_code=404, detail="Integration scope not found")


@router.get("/integrations/{integration_id}/audit-logs", response_model=list[IntegrationAuditLogSummary])
def integration_audit_logs_route(
    integration_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[IntegrationAuditLogSummary]:
    return list_integration_audit_logs(db, integration_id, current_user.id, limit)


@router.get("/integrations/{integration_id}/webhooks", response_model=list[IntegrationWebhookSummary])
def list_integration_webhooks_route(
    integration_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[IntegrationWebhookSummary]:
    try:
        return list_integration_webhooks(db, integration_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/integrations/{integration_id}/webhooks", response_model=IntegrationWebhookCreateResponse)
def create_integration_webhook_route(
    integration_id: str,
    payload: IntegrationWebhookCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> IntegrationWebhookCreateResponse:
    try:
        webhook, secret = create_integration_webhook(db, integration_id, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return IntegrationWebhookCreateResponse(secret=secret, webhook=IntegrationWebhookSummary.model_validate(webhook))


@router.patch("/integrations/{integration_id}/webhooks/{webhook_id}", response_model=IntegrationWebhookSummary)
def update_integration_webhook_route(
    integration_id: str,
    webhook_id: str,
    payload: IntegrationWebhookUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> IntegrationWebhookSummary:
    try:
        webhook = update_integration_webhook(db, integration_id, webhook_id, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if webhook is None:
        raise HTTPException(status_code=404, detail="Integration webhook not found")
    return IntegrationWebhookSummary.model_validate(webhook)


@router.delete("/integrations/{integration_id}/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_integration_webhook_route(
    integration_id: str,
    webhook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> None:
    try:
        deleted = delete_integration_webhook(db, integration_id, webhook_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Integration webhook not found")


@router.get(
    "/integrations/{integration_id}/webhooks/{webhook_id}/deliveries",
    response_model=list[IntegrationWebhookDeliverySummary],
)
def list_integration_webhook_deliveries_route(
    integration_id: str,
    webhook_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[IntegrationWebhookDeliverySummary]:
    try:
        return list_integration_webhook_deliveries(db, integration_id, webhook_id, current_user.id, limit)
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/integrations/{integration_id}/webhooks/{webhook_id}/deliveries/{delivery_id}/retry",
    response_model=IntegrationWebhookDeliverySummary,
)
def retry_integration_webhook_delivery_route(
    integration_id: str,
    webhook_id: str,
    delivery_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> IntegrationWebhookDeliverySummary:
    try:
        delivery = retry_integration_webhook_delivery(db, integration_id, webhook_id, delivery_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if delivery is None:
        raise HTTPException(status_code=404, detail="Integration webhook delivery not found")
    return delivery
