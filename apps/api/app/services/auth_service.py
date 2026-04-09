from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.models.organization import Organization, OrganizationMember
from app.models.session import UserSession
from app.models.space import Space
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.session import SessionSummaryResponse

PBKDF2_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${derived.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_raw, salt, stored_hex = password_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations_raw),
    )
    return hmac.compare_digest(derived.hex(), stored_hex)


def is_password_hash_supported(password_hash: str | None) -> bool:
    return isinstance(password_hash, str) and password_hash.startswith("pbkdf2_sha256$")


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _build_cookie_settings() -> dict[str, object]:
    return {
        "httponly": True,
        "secure": settings.session_cookie_secure,
        "samesite": settings.session_cookie_samesite,
        "path": "/",
    }


def _set_session_cookie(response: Response, token: str, expires_at: datetime) -> None:
    max_age = max(int((expires_at - datetime.now(timezone.utc)).total_seconds()), 0)
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=max_age,
        expires=max_age,
        **_build_cookie_settings(),
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.session_cookie_name, path="/")


def _issue_session(db: Session, user: User, request: Request, response: Response) -> UserSession:
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.session_ttl_days)
    session = UserSession(
        user_id=user.id,
        token_hash=_hash_session_token(raw_token),
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        ip_address=(request.client.host if request.client else None),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    _set_session_cookie(response, raw_token, expires_at)
    return session


def _get_user_from_cookie(db: Session, request: Request) -> User | None:
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        return None

    session = db.scalar(
        select(UserSession).where(UserSession.token_hash == _hash_session_token(raw_token))
    )
    if session is None:
        return None
    if session.revoked_at is not None or session.expires_at <= datetime.now(timezone.utc):
        return None

    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        return None
    return user


def get_default_user(db: Session) -> User | None:
    return db.scalar(select(User).where(User.is_active.is_(True)).order_by(User.created_at.asc()).limit(1))


def resolve_current_user(
    db: Session,
    request: Request,
    response: Response | None = None,
    *,
    require_authenticated: bool,
    allow_dev_fallback: bool = True,
    persist_dev_session: bool = False,
) -> User | None:
    user = _get_user_from_cookie(db, request)
    if user is not None:
        return user

    if allow_dev_fallback and settings.app_env == "development":
        default_user = get_default_user(db)
        if default_user is not None:
            if persist_dev_session and response is not None:
                _issue_session(db, default_user, request, response)
            return default_user

    if require_authenticated:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return None


def get_current_user(request: Request, response: Response, db: Session) -> User:
    user = resolve_current_user(
        db,
        request,
        response,
        require_authenticated=True,
        allow_dev_fallback=True,
        persist_dev_session=False,
    )
    assert user is not None
    return user


def get_optional_current_user(request: Request, response: Response, db: Session) -> User | None:
    return resolve_current_user(
        db,
        request,
        response,
        require_authenticated=False,
        allow_dev_fallback=True,
        persist_dev_session=False,
    )


def require_current_user_dependency(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    return get_current_user(request, response, db)


def optional_current_user_dependency(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> User | None:
    return get_optional_current_user(request, response, db)


def register_user(db: Session, payload: RegisterRequest) -> User:
    email = payload.email.strip().lower()
    if "@" not in email:
        raise ValueError("Invalid email address")
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise ValueError("Email already registered")

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    organization_name = (payload.organization_name or f"{user.name} 的团队").strip()
    organization = Organization(name=organization_name, owner_id=user.id)
    db.add(organization)
    db.flush()

    db.add(
        OrganizationMember(
            organization_id=organization.id,
            user_id=user.id,
            role="owner",
            status="active",
        )
    )
    db.add_all(
        [
            Space(
                organization_id=None,
                owner_id=user.id,
                name="我的空间",
                space_type="personal",
                visibility="private",
            ),
            Space(
                organization_id=organization.id,
                owner_id=user.id,
                name=organization.name,
                space_type="team",
                visibility="organization",
            ),
        ]
    )
    db.commit()
    db.refresh(user)
    return user


def login_user(db: Session, payload: LoginRequest) -> User:
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return user


def create_user_session(db: Session, user: User, request: Request, response: Response) -> UserSession:
    return _issue_session(db, user, request, response)


def logout_current_session(db: Session, request: Request, response: Response) -> None:
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token:
        session = db.scalar(
            select(UserSession).where(UserSession.token_hash == _hash_session_token(raw_token))
        )
        if session is not None and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    clear_session_cookie(response)


def bootstrap_dev_session(db: Session, request: Request, response: Response) -> User:
    if settings.app_env != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development bootstrap is disabled")
    user = get_default_user(db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No development user available")
    _issue_session(db, user, request, response)
    return user


def cleanup_user_sessions(db: Session, user_id: str) -> None:
    db.execute(delete(UserSession).where(UserSession.user_id == user_id))
    db.commit()


def list_user_sessions(db: Session, request: Request, user_id: str) -> list[SessionSummaryResponse]:
    current_token = request.cookies.get(settings.session_cookie_name)
    current_hash = _hash_session_token(current_token) if current_token else None
    sessions = db.scalars(
        select(UserSession)
        .where(UserSession.user_id == user_id)
        .where(UserSession.revoked_at.is_(None))
        .order_by(UserSession.created_at.desc())
    ).all()
    return [
        SessionSummaryResponse(
            id=session.id,
            user_agent=session.user_agent,
            ip_address=session.ip_address,
            expires_at=session.expires_at,
            created_at=session.created_at,
            is_current=current_hash == session.token_hash,
        )
        for session in sessions
    ]


def revoke_user_session(db: Session, request: Request, response: Response, user_id: str, session_id: str) -> bool:
    session = db.scalar(
        select(UserSession)
        .where(UserSession.id == session_id)
        .where(UserSession.user_id == user_id)
    )
    if session is None:
        return False
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()

    current_token = request.cookies.get(settings.session_cookie_name)
    if current_token and _hash_session_token(current_token) == session.token_hash:
        clear_session_cookie(response)
    return True
