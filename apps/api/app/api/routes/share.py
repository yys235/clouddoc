from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.share import (
    DocumentAccessUpdateRequest,
    ShareAccessResponse,
    ShareLinkSummaryResponse,
    ShareLinkUpsertRequest,
    SharePasswordVerifyRequest,
)
from app.services.auth_service import optional_current_user_no_fallback_dependency, require_current_user_dependency
from app.services.document_service import can_manage_document
from app.services.share_service import (
    disable_document_share,
    get_document_share_settings,
    get_shared_document_access,
    rotate_document_share_link,
    upsert_document_share_settings,
    verify_share_password,
)
from app.models.document import Document

router = APIRouter()


@router.get("/documents/{doc_id}/share", response_model=ShareLinkSummaryResponse)
def get_document_share_settings_route(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> ShareLinkSummaryResponse:
    try:
        return get_document_share_settings(db, document_id=doc_id, current_user_id=current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/documents/{doc_id}/share", response_model=ShareLinkSummaryResponse)
def upsert_document_share_route(
    doc_id: str,
    payload: ShareLinkUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> ShareLinkSummaryResponse:
    try:
        return upsert_document_share_settings(
            db,
            document_id=doc_id,
            current_user_id=current_user.id,
            payload=payload,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/documents/{doc_id}/share/rotate", response_model=ShareLinkSummaryResponse)
def rotate_document_share_route(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> ShareLinkSummaryResponse:
    try:
        return rotate_document_share_link(db, document_id=doc_id, current_user_id=current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/documents/{doc_id}/share", response_model=ShareLinkSummaryResponse)
def disable_document_share_route(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> ShareLinkSummaryResponse:
    try:
        return disable_document_share(db, document_id=doc_id, current_user_id=current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/documents/{doc_id}/access")
def update_document_access_route(
    doc_id: str,
    payload: DocumentAccessUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
):
    document = db.get(Document, doc_id)
    if document is None or document.is_deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    if not can_manage_document(db, document, current_user.id):
        raise HTTPException(status_code=403, detail="Not allowed to manage document access")
    next_visibility = payload.visibility.strip().lower()
    if next_visibility not in {"private", "public"}:
        raise HTTPException(status_code=400, detail="Invalid visibility")
    document.visibility = next_visibility
    db.commit()
    db.refresh(document)
    return {"visibility": document.visibility}


@router.get("/share/{token}", response_model=ShareAccessResponse)
def get_shared_document_route(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
    _: User | None = Depends(optional_current_user_no_fallback_dependency),
) -> ShareAccessResponse:
    return get_shared_document_access(db, token=token, request=request)


@router.post("/share/{token}/verify-password", response_model=ShareAccessResponse)
def verify_share_password_route(
    token: str,
    payload: SharePasswordVerifyRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> ShareAccessResponse:
    return verify_share_password(
        db,
        token=token,
        password=payload.password,
        request=request,
        response=response,
    )
