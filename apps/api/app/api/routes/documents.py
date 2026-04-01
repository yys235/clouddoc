from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.document import (
    DocumentContentUpdateRequest,
    DocumentCreateRequest,
    DocumentDetail,
    DocumentSummary,
    FavoriteStatusResponse,
    LinkPreviewRequest,
    LinkPreviewResponse,
    SearchResult,
)
from app.services.document_service import (
    create_document,
    create_pdf_document,
    favorite_document,
    fetch_link_preview,
    get_document_detail,
    list_documents,
    restore_document,
    search_documents,
    soft_delete_document,
    unfavorite_document,
    update_document_content,
)

router = APIRouter()


@router.get("", response_model=list[DocumentSummary])
def list_documents_route(
    state: str = Query(default="active", pattern="^(active|trash|all)$"),
    db: Session = Depends(get_db),
) -> list[DocumentSummary]:
    return list_documents(db, state=state)


@router.get("/search", response_model=list[SearchResult])
def search_documents_route(
    q: str = Query(default="", min_length=0),
    db: Session = Depends(get_db),
) -> list[SearchResult]:
    return search_documents(db, q)


@router.post("", response_model=DocumentDetail)
def create_document_route(
    payload: DocumentCreateRequest,
    db: Session = Depends(get_db),
) -> DocumentDetail:
    try:
        return create_document(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/upload-pdf", response_model=DocumentDetail)
async def upload_pdf_document_route(
    space_id: str = Form(...),
    title: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> DocumentDetail:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file is not allowed")

    try:
        return create_pdf_document(
            db,
            title=title or "",
            space_id=space_id,
            file_name=file.filename or "upload.pdf",
            file_bytes=file_bytes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/link-preview", response_model=LinkPreviewResponse)
def link_preview_route(payload: LinkPreviewRequest) -> LinkPreviewResponse:
    try:
        return fetch_link_preview(payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{doc_id}", response_model=DocumentDetail)
def get_document(doc_id: str, db: Session = Depends(get_db)) -> DocumentDetail:
    document = get_document_detail(db, doc_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.put("/{doc_id}/content", response_model=DocumentDetail)
def update_document_content_route(
    doc_id: str,
    payload: DocumentContentUpdateRequest,
    db: Session = Depends(get_db),
) -> DocumentDetail:
    document = update_document_content(db, doc_id, payload)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{doc_id}", response_model=DocumentDetail)
def delete_document_route(doc_id: str, db: Session = Depends(get_db)) -> DocumentDetail:
    document = soft_delete_document(db, doc_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post("/{doc_id}/restore", response_model=DocumentDetail)
def restore_document_route(doc_id: str, db: Session = Depends(get_db)) -> DocumentDetail:
    document = restore_document(db, doc_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post("/{doc_id}/favorite", response_model=FavoriteStatusResponse)
def favorite_document_route(doc_id: str, db: Session = Depends(get_db)) -> FavoriteStatusResponse:
    result = favorite_document(db, doc_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return result


@router.delete("/{doc_id}/favorite", response_model=FavoriteStatusResponse)
def unfavorite_document_route(doc_id: str, db: Session = Depends(get_db)) -> FavoriteStatusResponse:
    result = unfavorite_document(db, doc_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return result
