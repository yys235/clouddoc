from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import Document, DocumentContent, DocumentVersion
from app.models.folder import Folder
from app.models.organization import Organization, OrganizationMember
from app.models.space import Space
from app.models.system import SystemAuditLog, SystemSettings
from app.models.user import User
from app.schemas.system import (
    BootstrapCheck,
    BootstrapInitializeRequest,
    BootstrapInitializeResponse,
    BootstrapStatusResponse,
    SystemAuditLogResponse,
    SystemSettingsSummaryResponse,
)
from app.services.auth_service import create_user_session, hash_password
from app.services.document_service import build_default_content, extract_plain_text


def get_or_create_system_settings(db: Session) -> SystemSettings:
    settings_row = db.scalar(select(SystemSettings).order_by(SystemSettings.created_at.asc()).limit(1))
    if settings_row is not None:
        return settings_row
    settings_row = SystemSettings(initialized=False, product_name="CloudDoc")
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


def has_active_super_admin(db: Session) -> bool:
    return bool(
        db.scalar(
            select(User.id)
            .where(User.is_active.is_(True))
            .where(User.is_super_admin.is_(True))
            .limit(1)
        )
    )


def is_system_initialized(db: Session) -> bool:
    settings_row = get_or_create_system_settings(db)
    return bool(settings_row.initialized or has_active_super_admin(db))


def mark_system_initialized(
    db: Session,
    *,
    initialized_by: str,
    allow_demo_data: bool = False,
    allow_public_documents: bool = True,
    allow_share_links: bool = True,
    share_password_required_by_default: bool = False,
    allow_guest_public_read: bool = True,
    allow_user_pat: bool = True,
    allow_open_api: bool = True,
) -> SystemSettings:
    settings_row = get_or_create_system_settings(db)
    settings_row.initialized = True
    settings_row.initialized_at = settings_row.initialized_at or datetime.now(timezone.utc)
    settings_row.initialized_by = initialized_by
    settings_row.allow_demo_data = allow_demo_data
    settings_row.allow_public_documents = allow_public_documents
    settings_row.allow_share_links = allow_share_links
    settings_row.share_password_required_by_default = share_password_required_by_default
    settings_row.allow_guest_public_read = allow_guest_public_read
    settings_row.allow_user_pat = allow_user_pat
    settings_row.allow_open_api = allow_open_api
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


def bootstrap_status(db: Session) -> BootstrapStatusResponse:
    checks: list[BootstrapCheck] = []
    database_ok = True
    checks.append(BootstrapCheck(key="database", status="ok", message="PostgreSQL connected"))

    schema_ok = True
    checks.append(BootstrapCheck(key="schema", status="ok", message="Schema is ready"))

    upload_path = Path(settings.upload_dir)
    uploads_ok = upload_path.exists() and upload_path.is_dir()
    if not uploads_ok:
        try:
            upload_path.mkdir(parents=True, exist_ok=True)
            uploads_ok = True
        except OSError:
            uploads_ok = False
    checks.append(
        BootstrapCheck(
            key="uploads",
            status="ok" if uploads_ok else "warning",
            message="Upload directory is writable" if uploads_ok else "Upload directory is not writable",
        )
    )

    checks.append(BootstrapCheck(key="mcp", status="optional", message="MCP service is optional during setup"))

    settings_row = get_or_create_system_settings(db)
    super_admin_exists = has_active_super_admin(db)
    initialized = bool(settings_row.initialized or super_admin_exists)
    return BootstrapStatusResponse(
        initialized=initialized,
        needs_setup=not initialized,
        has_super_admin=super_admin_exists,
        database_ok=database_ok,
        schema_ok=schema_ok,
        uploads_ok=uploads_ok,
        setup_allowed=bool(settings.setup_enabled and not initialized),
        app_env=settings.app_env,
        checks=checks,
    )


def _validate_initialize_payload(
    db: Session,
    payload: BootstrapInitializeRequest,
    *,
    enforce_setup_enabled: bool,
    enforce_setup_token: bool,
) -> None:
    status_payload = bootstrap_status(db)
    if status_payload.initialized:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="System is already initialized")
    if enforce_setup_enabled and not status_payload.setup_allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System setup is disabled")
    if enforce_setup_token and settings.setup_token and payload.setup_token != settings.setup_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid setup token")
    if payload.space_visibility not in {"private", "organization"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid space visibility")
    if "@" not in payload.admin_email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid admin email")

    normalized_email = payload.admin_email.strip().lower()
    if db.scalar(select(User).where(User.email == normalized_email).limit(1)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admin email already exists")


def _create_initialized_system(
    db: Session,
    payload: BootstrapInitializeRequest,
    *,
    actor_type: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, Organization, Space, datetime]:
    normalized_email = payload.admin_email.strip().lower()
    now = datetime.now(timezone.utc)
    try:
        admin = User(
            name=payload.admin_name.strip(),
            email=normalized_email,
            password_hash=hash_password(payload.admin_password),
            is_active=True,
            is_super_admin=True,
        )
        db.add(admin)
        db.flush()

        organization = Organization(name=payload.organization_name.strip(), owner_id=admin.id)
        db.add(organization)
        db.flush()

        db.add(
            OrganizationMember(
                organization_id=organization.id,
                user_id=admin.id,
                role="owner",
                status="active",
            )
        )

        space = Space(
            organization_id=organization.id,
            owner_id=admin.id,
            name=payload.space_name.strip(),
            space_type="team",
            visibility=payload.space_visibility,
        )
        db.add(space)
        db.flush()

        newdoc = Folder(
            space_id=space.id,
            creator_id=admin.id,
            owner_id=admin.id,
            title="newdoc",
            visibility=payload.space_visibility,
            icon="folder",
            sort_order=10,
        )
        clouddoc = Folder(
            space_id=space.id,
            creator_id=admin.id,
            owner_id=admin.id,
            title="clouddoc",
            visibility=payload.space_visibility,
            icon="folder",
            sort_order=20,
        )
        db.add_all([newdoc, clouddoc])
        db.flush()

        if payload.import_demo_data:
            demo_content_json = build_default_content("CloudDoc 使用示例")
            demo_document = Document(
                space_id=space.id,
                folder_id=clouddoc.id,
                creator_id=admin.id,
                owner_id=admin.id,
                title="CloudDoc 使用示例",
                document_type="doc",
                status="draft",
                visibility=payload.space_visibility,
                icon="doc",
                sort_order=10,
                summary="首次部署初始化向导创建的示例文档。",
            )
            db.add(demo_document)
            db.flush()
            demo_content = DocumentContent(
                document_id=demo_document.id,
                version_no=1,
                schema_version=1,
                content_json=demo_content_json,
                plain_text=extract_plain_text(demo_content_json),
                created_by=admin.id,
            )
            db.add(demo_content)
            db.flush()
            demo_version = DocumentVersion(
                document_id=demo_document.id,
                content_id=demo_content.id,
                version_no=1,
                message="Initialized sample document",
                created_by=admin.id,
            )
            db.add(demo_version)
            db.flush()
            demo_document.current_version_id = demo_version.id

        settings_row = db.scalar(select(SystemSettings).order_by(SystemSettings.created_at.asc()).limit(1))
        if settings_row is None:
            settings_row = SystemSettings(product_name="CloudDoc")
            db.add(settings_row)
            db.flush()
        settings_row.initialized = True
        settings_row.initialized_at = now
        settings_row.initialized_by = admin.id
        settings_row.allow_public_documents = payload.allow_public_documents
        settings_row.allow_share_links = payload.allow_share_links
        settings_row.share_password_required_by_default = payload.share_password_required_by_default
        settings_row.allow_guest_public_read = payload.allow_guest_public_read
        settings_row.allow_user_pat = payload.allow_user_pat
        settings_row.allow_open_api = payload.allow_open_api
        settings_row.allow_demo_data = payload.import_demo_data
        db.add(settings_row)

        db.add(
            SystemAuditLog(
                actor_type=actor_type,
                actor_id=admin.id,
                action="system.bootstrap.initialized",
                target_type="system",
                target_id=settings_row.id,
                payload={
                    "organization_id": organization.id,
                    "space_id": space.id,
                    "import_demo_data": payload.import_demo_data,
                    "allow_open_api": payload.allow_open_api,
                    "allow_user_pat": payload.allow_user_pat,
                },
                ip_address=ip_address,
                user_agent=(user_agent or "")[:512] or None,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(admin)
    db.refresh(organization)
    db.refresh(space)
    return admin, organization, space, now


def initialize_system(
    db: Session,
    payload: BootstrapInitializeRequest,
    *,
    request: Request,
    response: Response,
) -> BootstrapInitializeResponse:
    _validate_initialize_payload(
        db,
        payload,
        enforce_setup_enabled=True,
        enforce_setup_token=True,
    )
    admin, organization, space, now = _create_initialized_system(
        db,
        payload,
        actor_type="setup",
        ip_address=(request.client.host if request.client else None),
        user_agent=request.headers.get("user-agent"),
    )
    create_user_session(db, admin, request, response)
    return BootstrapInitializeResponse(
        initialized=True,
        admin_user_id=admin.id,
        organization_id=organization.id,
        space_id=space.id,
        initialized_at=now,
    )


def initialize_system_from_cli(
    db: Session,
    payload: BootstrapInitializeRequest,
) -> BootstrapInitializeResponse:
    _validate_initialize_payload(
        db,
        payload,
        enforce_setup_enabled=False,
        enforce_setup_token=False,
    )
    admin, organization, space, now = _create_initialized_system(
        db,
        payload,
        actor_type="cli",
        user_agent="clouddoc-cli",
    )
    return BootstrapInitializeResponse(
        initialized=True,
        admin_user_id=admin.id,
        organization_id=organization.id,
        space_id=space.id,
        initialized_at=now,
    )


def system_settings_summary(db: Session) -> SystemSettingsSummaryResponse:
    settings_row = get_or_create_system_settings(db)
    initialized_by_email = None
    if settings_row.initialized_by:
        initialized_user = db.get(User, settings_row.initialized_by)
        initialized_by_email = initialized_user.email if initialized_user else None

    logs = db.scalars(
        select(SystemAuditLog).order_by(SystemAuditLog.created_at.desc()).limit(10)
    ).all()
    return SystemSettingsSummaryResponse(
        id=settings_row.id,
        product_name=settings_row.product_name,
        initialized=settings_row.initialized,
        initialized_at=settings_row.initialized_at,
        initialized_by=settings_row.initialized_by,
        initialized_by_email=initialized_by_email,
        allow_demo_data=settings_row.allow_demo_data,
        allow_public_documents=settings_row.allow_public_documents,
        allow_share_links=settings_row.allow_share_links,
        share_password_required_by_default=settings_row.share_password_required_by_default,
        allow_guest_public_read=settings_row.allow_guest_public_read,
        allow_user_pat=settings_row.allow_user_pat,
        allow_open_api=settings_row.allow_open_api,
        setup_enabled=settings.setup_enabled,
        app_env=settings.app_env,
        recent_audit_logs=[
            SystemAuditLogResponse(
                id=log.id,
                actor_type=log.actor_type,
                actor_id=log.actor_id,
                action=log.action,
                target_type=log.target_type,
                target_id=log.target_id,
                payload=log.payload,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                created_at=log.created_at,
            )
            for log in logs
        ],
    )
