from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.permission import (
    DocumentCapabilities,
    DocumentIntegrationAccessResponse,
    DocumentPermissionAuditLogResponse,
    DocumentPermissionBatchCreateRequest,
    DocumentPermissionCreateRequest,
    DocumentPermissionResponse,
    DocumentPermissionSettingsResponse,
    DocumentPermissionSettingsUpdateRequest,
    DocumentPermissionUpdateRequest,
    OwnerTransferRequest,
)
from app.services.auth_service import optional_current_user_no_fallback_dependency, require_current_user_dependency
from app.services.document_permission_service import (
    delete_document_permission,
    get_document_capabilities,
    get_permission_settings,
    list_document_integrations,
    list_document_permissions,
    list_permission_audit_logs,
    transfer_document_owner,
    update_document_permission,
    update_permission_settings,
    upsert_document_permission,
)

router = APIRouter()


@router.get("/documents/{document_id}/capabilities", response_model=DocumentCapabilities)
def get_capabilities_route(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_no_fallback_dependency),
) -> DocumentCapabilities:
    capabilities = get_document_capabilities(db, document_id, current_user.id if current_user else None)
    if capabilities is None or not capabilities.can_view:
        raise HTTPException(status_code=404, detail="Document not found")
    return capabilities


@router.get("/documents/{document_id}/permission-settings", response_model=DocumentPermissionSettingsResponse)
def get_permission_settings_route(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> DocumentPermissionSettingsResponse:
    try:
        return get_permission_settings(db, document_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/documents/{document_id}/permission-settings", response_model=DocumentPermissionSettingsResponse)
def update_permission_settings_route(
    document_id: str,
    payload: DocumentPermissionSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> DocumentPermissionSettingsResponse:
    try:
        return update_permission_settings(db, document_id, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/documents/{document_id}/permissions", response_model=list[DocumentPermissionResponse])
def list_document_permissions_route(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[DocumentPermissionResponse]:
    try:
        return list_document_permissions(db, document_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/documents/{document_id}/integrations", response_model=list[DocumentIntegrationAccessResponse])
def list_document_integrations_route(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[DocumentIntegrationAccessResponse]:
    try:
        return list_document_integrations(db, document_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/documents/{document_id}/permissions", response_model=DocumentPermissionResponse)
def create_document_permission_route(
    document_id: str,
    payload: DocumentPermissionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> DocumentPermissionResponse:
    try:
        return upsert_document_permission(db, document_id, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/documents/{document_id}/permissions/batch", response_model=list[DocumentPermissionResponse])
def batch_create_document_permissions_route(
    document_id: str,
    payload: DocumentPermissionBatchCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[DocumentPermissionResponse]:
    responses: list[DocumentPermissionResponse] = []
    try:
        for item in payload.permissions:
            responses.append(upsert_document_permission(db, document_id, item, current_user.id))
        return responses
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/documents/{document_id}/permissions/{permission_id}", response_model=DocumentPermissionResponse)
def update_document_permission_route(
    document_id: str,
    permission_id: str,
    payload: DocumentPermissionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> DocumentPermissionResponse:
    try:
        permission = update_document_permission(db, document_id, permission_id, payload.permission_level, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if permission is None:
        raise HTTPException(status_code=404, detail="Permission not found")
    return permission


@router.delete("/documents/{document_id}/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document_permission_route(
    document_id: str,
    permission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> None:
    try:
        deleted = delete_document_permission(db, document_id, permission_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Permission not found")


@router.post("/documents/{document_id}/transfer-owner", status_code=status.HTTP_204_NO_CONTENT)
def transfer_document_owner_route(
    document_id: str,
    payload: OwnerTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> None:
    try:
        transfer_document_owner(db, document_id, payload.new_owner_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/documents/{document_id}/permission-audit-logs", response_model=list[DocumentPermissionAuditLogResponse])
def list_permission_audit_logs_route(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[DocumentPermissionAuditLogResponse]:
    try:
        return list_permission_audit_logs(db, document_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
