from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.document import DocumentDetail, DocumentSummary, SearchResult
from app.schemas.folder import TreeNodeSummary
from app.schemas.integration import MarkdownDocumentCreateRequest, MarkdownDocumentUpdateRequest
from app.services.integration_service import (
    OpenActorContext,
    authenticate_open_actor,
    create_audit_log,
    create_open_document_from_markdown,
    get_open_document,
    list_open_documents,
    list_open_folder_tree,
    search_open_documents,
    update_open_document_from_markdown,
)

router = APIRouter(prefix="/open")


def open_actor_dependency(request: Request, db: Session = Depends(get_db)) -> OpenActorContext:
    return authenticate_open_actor(db, request)


@router.get("/documents", response_model=list[DocumentSummary])
def list_open_documents_route(
    request: Request,
    state: str = "active",
    db: Session = Depends(get_db),
    context: OpenActorContext = Depends(open_actor_dependency),
) -> list[DocumentSummary]:
    try:
        items = list_open_documents(db, context, state)
        create_audit_log(db, context, operation="open.documents.list", target_type="document", request=request)
        return items
    except HTTPException:
        raise
    except Exception as exc:
        create_audit_log(
            db,
            context,
            operation="open.documents.list",
            target_type="document",
            response_status="error",
            error_message=str(exc),
            request=request,
        )
        raise


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_open_document_route(
    document_id: str,
    request: Request,
    db: Session = Depends(get_db),
    context: OpenActorContext = Depends(open_actor_dependency),
) -> DocumentDetail:
    document = get_open_document(db, context, document_id)
    if document is None:
        create_audit_log(
            db,
            context,
            operation="open.documents.get",
            target_type="document",
            target_id=document_id,
            response_status="error",
            error_message="not_found_or_unauthorized",
            request=request,
        )
        raise HTTPException(status_code=404, detail="Document not found")
    create_audit_log(db, context, operation="open.documents.get", target_type="document", target_id=document_id, request=request)
    return document


@router.post("/documents/from-markdown", response_model=DocumentDetail)
def create_document_from_markdown_route(
    payload: MarkdownDocumentCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    context: OpenActorContext = Depends(open_actor_dependency),
) -> DocumentDetail:
    try:
        document = create_open_document_from_markdown(db, context, payload)
        create_audit_log(
            db,
            context,
            operation="open.documents.create_from_markdown",
            target_type="document",
            target_id=document.id,
            request_summary={"title": payload.title, "space_id": payload.space_id, "folder_id": payload.folder_id},
            request=request,
        )
        return document
    except PermissionError as exc:
        create_audit_log(
            db,
            context,
            operation="open.documents.create_from_markdown",
            target_type="document",
            response_status="error",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.put("/documents/{document_id}/from-markdown", response_model=DocumentDetail)
def update_document_from_markdown_route(
    document_id: str,
    payload: MarkdownDocumentUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    context: OpenActorContext = Depends(open_actor_dependency),
) -> DocumentDetail:
    try:
        document = update_open_document_from_markdown(db, context, document_id, payload)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        create_audit_log(
            db,
            context,
            operation="open.documents.update_from_markdown",
            target_type="document",
            target_id=document_id,
            request_summary={"title": payload.title},
            request=request,
        )
        return document
    except PermissionError as exc:
        create_audit_log(
            db,
            context,
            operation="open.documents.update_from_markdown",
            target_type="document",
            target_id=document_id,
            response_status="error",
            error_message=str(exc),
            request=request,
        )
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/folders/tree/{space_id}", response_model=list[TreeNodeSummary])
def get_open_folder_tree_route(
    space_id: str,
    request: Request,
    db: Session = Depends(get_db),
    context: OpenActorContext = Depends(open_actor_dependency),
) -> list[TreeNodeSummary]:
    tree = list_open_folder_tree(db, context, space_id)
    create_audit_log(db, context, operation="open.folders.tree", target_type="space", target_id=space_id, request=request)
    return tree


@router.get("/search", response_model=list[SearchResult])
def search_open_documents_route(
    request: Request,
    q: str,
    db: Session = Depends(get_db),
    context: OpenActorContext = Depends(open_actor_dependency),
) -> list[SearchResult]:
    results = search_open_documents(db, context, q)
    create_audit_log(
        db,
        context,
        operation="open.search",
        target_type="document",
        request_summary={"q": q},
        request=request,
    )
    return results
