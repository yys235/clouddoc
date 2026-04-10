from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.document import (
    CommentCreateRequest,
    CommentDeleteResponse,
    CommentReplyRequest,
    CommentStatusUpdateRequest,
    CommentThreadResponse,
)
from app.services.auth_service import optional_current_user_no_fallback_dependency, require_current_user_dependency
from app.services.comment_service import (
    create_comment_thread,
    delete_comment,
    list_comment_threads,
    reply_comment_thread,
    update_comment_thread_status,
)

router = APIRouter()


@router.get("/documents/{doc_id}/comments", response_model=list[CommentThreadResponse])
def list_comments_route(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_no_fallback_dependency),
) -> list[CommentThreadResponse]:
    return list_comment_threads(db, doc_id, current_user.id if current_user else None)


@router.post("/documents/{doc_id}/comments", response_model=CommentThreadResponse)
def create_comment_route(
    doc_id: str,
    payload: CommentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> CommentThreadResponse:
    try:
        return create_comment_thread(db, doc_id, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/comments/{thread_id}/reply", response_model=CommentThreadResponse)
def reply_comment_route(
    thread_id: str,
    payload: CommentReplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> CommentThreadResponse:
    thread = reply_comment_thread(db, thread_id, payload, current_user.id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Comment thread not found")
    return thread


@router.patch("/comments/{thread_id}/status", response_model=CommentThreadResponse)
def update_comment_status_route(
    thread_id: str,
    payload: CommentStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> CommentThreadResponse:
    try:
        thread = update_comment_thread_status(db, thread_id, payload, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if thread is None:
        raise HTTPException(status_code=404, detail="Comment thread not found")
    return thread


@router.delete("/comments/{comment_id}", response_model=CommentDeleteResponse)
def delete_comment_route(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> CommentDeleteResponse:
    result = delete_comment(db, comment_id=comment_id, current_user_id=current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    return result
