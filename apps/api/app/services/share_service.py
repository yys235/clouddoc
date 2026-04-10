from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import Document
from app.models.share import ShareLink
from app.schemas.share import ShareAccessResponse, ShareLinkSummaryResponse, ShareLinkUpsertRequest
from app.services.auth_service import hash_password, verify_password
from app.services.document_service import (
    can_manage_document,
    get_document_detail_for_share,
)


def _cookie_name_for_share(token: str) -> str:
    return f"{settings.share_cookie_prefix}_{token[:16]}"


def _cookie_value_for_share(token: str) -> str:
    return hmac.new(
        settings.app_secret_key.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _is_share_enabled(share: ShareLink | None) -> bool:
    return share is not None and share.is_active


def _is_share_expired(share: ShareLink | None) -> bool:
    return bool(share and share.expires_at and share.expires_at <= datetime.now(timezone.utc))


def _share_requires_password(share: ShareLink | None) -> bool:
    return bool(share and share.password_hash)


def _is_share_password_granted(request: Request, share: ShareLink) -> bool:
    cookie_name = _cookie_name_for_share(share.token)
    cookie_value = request.cookies.get(cookie_name)
    if not cookie_value:
        return False
    return hmac.compare_digest(cookie_value, _cookie_value_for_share(share.token))


def _set_share_cookie(response: Response, share: ShareLink) -> None:
    cookie_name = _cookie_name_for_share(share.token)
    cookie_value = _cookie_value_for_share(share.token)
    max_age = None
    expires = None
    if share.expires_at is not None:
        max_age = max(int((share.expires_at - datetime.now(timezone.utc)).total_seconds()), 0)
        expires = max_age
    response.set_cookie(
        cookie_name,
        cookie_value,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
        max_age=max_age,
        expires=expires,
    )


def _clear_share_cookie(response: Response, token: str) -> None:
    response.delete_cookie(_cookie_name_for_share(token), path="/")


def _share_summary(share: ShareLink | None) -> ShareLinkSummaryResponse:
    if share is None:
        return ShareLinkSummaryResponse()
    return ShareLinkSummaryResponse(
        id=share.id,
        token=share.token,
        share_url=f"/share/{share.token}",
        is_enabled=share.is_active,
        is_active=share.is_active and not _is_share_expired(share),
        requires_password=bool(share.password_hash),
        expires_at=share.expires_at,
        allow_copy=share.allow_copy,
        allow_export=share.allow_export,
        created_at=share.created_at,
        updated_at=share.updated_at,
        access_count=share.access_count,
        last_accessed_at=share.last_accessed_at,
    )


def _build_shared_access_response(db: Session, share: ShareLink) -> ShareAccessResponse:
    document = get_document_detail_for_share(db, share.document_id)
    if document is None:
        return ShareAccessResponse(status="not_found", share=_share_summary(share), document=None)
    return ShareAccessResponse(status="ok", share=_share_summary(share), document=document)


def _record_share_access(db: Session, share: ShareLink) -> ShareLink:
    share.access_count += 1
    share.last_accessed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(share)
    return share


def get_document_share_link(db: Session, document_id: str) -> ShareLink | None:
    return db.scalar(
        select(ShareLink)
        .where(ShareLink.document_id == document_id)
        .order_by(ShareLink.updated_at.desc())
        .limit(1)
    )


def get_document_share_settings(db: Session, *, document_id: str, current_user_id: str) -> ShareLinkSummaryResponse:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        raise ValueError("Document not found")
    if not can_manage_document(db, document, current_user_id):
        raise PermissionError("Not allowed to manage sharing for this document")
    return _share_summary(get_document_share_link(db, document_id))


def upsert_document_share_settings(
    db: Session,
    *,
    document_id: str,
    current_user_id: str,
    payload: ShareLinkUpsertRequest,
) -> ShareLinkSummaryResponse:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        raise ValueError("Document not found")
    if not can_manage_document(db, document, current_user_id):
        raise PermissionError("Not allowed to manage sharing for this document")

    share = get_document_share_link(db, document_id)
    if share is None:
        share = ShareLink(
            document_id=document_id,
            token=secrets.token_urlsafe(24),
            access_scope="public",
            permission_level="view",
            created_by=current_user_id,
        )
        db.add(share)
        db.flush()

    share.is_active = payload.enabled
    share.expires_at = payload.expires_at
    share.allow_copy = payload.allow_copy
    share.allow_export = payload.allow_export
    if payload.password is not None:
        normalized_password = payload.password.strip()
        share.password_hash = hash_password(normalized_password) if normalized_password else None
    db.commit()
    db.refresh(share)
    return _share_summary(share)


def rotate_document_share_link(db: Session, *, document_id: str, current_user_id: str) -> ShareLinkSummaryResponse:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        raise ValueError("Document not found")
    if not can_manage_document(db, document, current_user_id):
        raise PermissionError("Not allowed to rotate sharing for this document")
    share = get_document_share_link(db, document_id)
    if share is None:
        raise ValueError("Share link not found")
    share.token = secrets.token_urlsafe(24)
    db.commit()
    db.refresh(share)
    return _share_summary(share)


def disable_document_share(db: Session, *, document_id: str, current_user_id: str) -> ShareLinkSummaryResponse:
    document = db.get(Document, document_id)
    if document is None or document.is_deleted:
        raise ValueError("Document not found")
    if not can_manage_document(db, document, current_user_id):
        raise PermissionError("Not allowed to disable sharing for this document")
    share = get_document_share_link(db, document_id)
    if share is None:
        return ShareLinkSummaryResponse()
    share.is_active = False
    db.commit()
    db.refresh(share)
    return _share_summary(share)


def get_shared_document_access(
    db: Session,
    *,
    token: str,
    request: Request,
) -> ShareAccessResponse:
    share = db.scalar(select(ShareLink).where(ShareLink.token == token).limit(1))
    if share is None:
        return ShareAccessResponse(status="not_found", share=None, document=None)
    if not _is_share_enabled(share):
        return ShareAccessResponse(status="disabled", share=_share_summary(share), document=None)
    if _is_share_expired(share):
        return ShareAccessResponse(status="expired", share=_share_summary(share), document=None)
    if _share_requires_password(share) and not _is_share_password_granted(request, share):
        return ShareAccessResponse(status="password_required", share=_share_summary(share), document=None)

    return _build_shared_access_response(db, _record_share_access(db, share))


def verify_share_password(
    db: Session,
    *,
    token: str,
    password: str,
    request: Request,
    response: Response,
) -> ShareAccessResponse:
    share = db.scalar(select(ShareLink).where(ShareLink.token == token).limit(1))
    if share is None:
        return ShareAccessResponse(status="not_found", share=None, document=None)
    if not _is_share_enabled(share):
        return ShareAccessResponse(status="disabled", share=_share_summary(share), document=None)
    if _is_share_expired(share):
        return ShareAccessResponse(status="expired", share=_share_summary(share), document=None)
    if not share.password_hash:
        return get_shared_document_access(db, token=token, request=request)
    if not verify_password(password, share.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid share password")

    _set_share_cookie(response, share)
    return _build_shared_access_response(db, _record_share_access(db, share))


def clear_share_access(response: Response, token: str) -> None:
    _clear_share_cookie(response, token)
