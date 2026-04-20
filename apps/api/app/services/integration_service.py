from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.folder import Folder
from app.models.integration import (
    Integration,
    IntegrationAuditLog,
    IntegrationResourceScope,
    IntegrationToken,
    IntegrationWebhookDelivery,
    IntegrationWebhook,
)
from app.models.space import Space
from app.models.user import User
from app.schemas.document import DocumentContentUpdateRequest, DocumentCreateRequest
from app.schemas.integration import (
    IntegrationCreateRequest,
    IntegrationScopeCreateRequest,
    IntegrationWebhookCreateRequest,
    IntegrationWebhookUpdateRequest,
    IntegrationUpdateRequest,
    MarkdownDocumentCreateRequest,
    MarkdownDocumentUpdateRequest,
    TokenCreateRequest,
    TokenUpdateRequest,
)
from app.services.actor_context import ActorContext
from app.services.document_service import (
    create_document,
    get_document_detail,
    list_documents,
    search_documents,
    update_document_content,
)
from app.services.folder_service import create_folder, get_space_tree, list_folder_children, list_space_root_children
from app.services.markdown_service import markdown_to_content_json, markdown_to_plain_text
from app.services.permission_service import can_edit_document, can_view_document, normalize_permission_level, role_at_least


ALL_TOKEN_SCOPES = {
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:delete",
    "folders:read",
    "folders:create",
    "comments:read",
    "comments:create",
    "comments:update",
    "comments:delete",
    "search:read",
    "shares:read",
}
SUPPORTED_WEBHOOK_EVENTS = {
    "document.created",
    "document.updated",
    "document.deleted",
    "document.restored",
    "comment.created",
    "comment.deleted",
}


_rate_buckets: dict[str, list[float]] = {}


@dataclass(frozen=True)
class OpenActorContext:
    actor: ActorContext
    token: IntegrationToken
    integration: Integration | None

    @property
    def user_id(self) -> str:
        assert self.actor.user_id is not None
        return self.actor.user_id

    @property
    def scopes(self) -> set[str]:
        return {str(scope) for scope in (self.token.scopes or [])}


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _new_raw_token(prefix: str = "cdp") -> tuple[str, str, str]:
    secret = secrets.token_urlsafe(32)
    token_prefix = f"{prefix}_{secret[:10]}"
    raw_token = f"{token_prefix}.{secret}"
    return raw_token, token_prefix, _hash_token(raw_token)


def _normalize_scopes(scopes: list[str]) -> list[str]:
    normalized = sorted({scope.strip() for scope in scopes if scope.strip() in ALL_TOKEN_SCOPES})
    return normalized or ["documents:read"]


def create_token(db: Session, payload: TokenCreateRequest, current_user_id: str) -> tuple[IntegrationToken, str]:
    integration: Integration | None = None
    token_type = "personal"
    if payload.integration_id:
        integration = db.get(Integration, payload.integration_id)
        if integration is None or integration.created_by != current_user_id or integration.status == "deleted":
            raise PermissionError("Not allowed to create token for this integration")
        token_type = "integration"

    raw_token, token_prefix, token_hash = _new_raw_token("cdi" if integration else "cdp")
    token = IntegrationToken(
        integration_id=integration.id if integration else None,
        user_id=current_user_id,
        token_type=token_type,
        token_prefix=token_prefix,
        token_hash=token_hash,
        name=payload.name.strip() or "AI Token",
        scopes=_normalize_scopes(payload.scopes),
        expires_at=payload.expires_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token, raw_token


def list_tokens(db: Session, current_user_id: str) -> list[IntegrationToken]:
    return db.scalars(
        select(IntegrationToken)
        .where(IntegrationToken.user_id == current_user_id)
        .order_by(IntegrationToken.created_at.desc())
    ).all()


def update_token(db: Session, token_id: str, payload: TokenUpdateRequest, current_user_id: str) -> IntegrationToken | None:
    token = db.get(IntegrationToken, token_id)
    if token is None or token.user_id != current_user_id:
        return None
    if payload.name is not None:
        token.name = payload.name.strip() or token.name
    if payload.scopes is not None:
        token.scopes = _normalize_scopes(payload.scopes)
    if payload.expires_at is not None:
        token.expires_at = payload.expires_at
    if payload.revoked is True and token.revoked_at is None:
        token.revoked_at = datetime.now(timezone.utc)
    if payload.revoked is False:
        token.revoked_at = None
    db.commit()
    db.refresh(token)
    return token


def revoke_token(db: Session, token_id: str, current_user_id: str) -> bool:
    token = db.get(IntegrationToken, token_id)
    if token is None or token.user_id != current_user_id:
        return False
    token.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return True


def create_integration(db: Session, payload: IntegrationCreateRequest, current_user_id: str) -> Integration:
    client_id = f"cld_{secrets.token_urlsafe(18)}"
    integration = Integration(
        organization_id=payload.organization_id,
        created_by=current_user_id,
        name=payload.name.strip() or "Untitled Integration",
        description=payload.description,
        icon_url=payload.icon_url,
        status="active",
        client_id=client_id,
    )
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


def list_integrations(db: Session, current_user_id: str) -> list[Integration]:
    return db.scalars(
        select(Integration)
        .where(Integration.created_by == current_user_id)
        .where(Integration.status != "deleted")
        .order_by(Integration.created_at.desc())
    ).all()


def get_owned_integration(db: Session, integration_id: str, current_user_id: str) -> Integration | None:
    integration = db.get(Integration, integration_id)
    if integration is None or integration.created_by != current_user_id or integration.status == "deleted":
        return None
    return integration


def update_integration(
    db: Session,
    integration_id: str,
    payload: IntegrationUpdateRequest,
    current_user_id: str,
) -> Integration | None:
    integration = get_owned_integration(db, integration_id, current_user_id)
    if integration is None:
        return None
    if payload.name is not None:
        integration.name = payload.name.strip() or integration.name
    if payload.description is not None:
        integration.description = payload.description
    if payload.icon_url is not None:
        integration.icon_url = payload.icon_url
    if payload.status in {"active", "disabled"}:
        integration.status = payload.status
    db.commit()
    db.refresh(integration)
    return integration


def delete_integration(db: Session, integration_id: str, current_user_id: str) -> bool:
    integration = get_owned_integration(db, integration_id, current_user_id)
    if integration is None:
        return False
    integration.status = "deleted"
    now = datetime.now(timezone.utc)
    tokens = db.scalars(select(IntegrationToken).where(IntegrationToken.integration_id == integration.id)).all()
    for token in tokens:
        token.revoked_at = token.revoked_at or now
    db.commit()
    return True


def list_integration_scopes(db: Session, integration_id: str, current_user_id: str) -> list[IntegrationResourceScope]:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        raise PermissionError("Integration not found")
    return db.scalars(
        select(IntegrationResourceScope)
        .where(IntegrationResourceScope.integration_id == integration_id)
        .order_by(IntegrationResourceScope.created_at.desc())
    ).all()


def create_integration_scope(
    db: Session,
    integration_id: str,
    payload: IntegrationScopeCreateRequest,
    current_user_id: str,
) -> IntegrationResourceScope:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        raise PermissionError("Integration not found")
    if payload.resource_type not in {"space", "folder", "document", "public_documents"}:
        raise ValueError("Unsupported resource type")
    permission_level = normalize_permission_level(payload.permission_level)
    scope = IntegrationResourceScope(
        integration_id=integration_id,
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        include_children=payload.include_children,
        permission_level=permission_level,
        created_by=current_user_id,
    )
    db.add(scope)
    db.commit()
    db.refresh(scope)
    return scope


def delete_integration_scope(db: Session, integration_id: str, scope_id: str, current_user_id: str) -> bool:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        return False
    scope = db.get(IntegrationResourceScope, scope_id)
    if scope is None or scope.integration_id != integration_id:
        return False
    db.delete(scope)
    db.commit()
    return True


def _normalize_webhook_events(event_types: list[str]) -> list[str]:
    normalized = sorted({event.strip() for event in event_types if event.strip() in SUPPORTED_WEBHOOK_EVENTS})
    if not normalized:
        raise ValueError("At least one supported webhook event is required")
    return normalized


def create_integration_webhook(
    db: Session,
    integration_id: str,
    payload: IntegrationWebhookCreateRequest,
    current_user_id: str,
) -> tuple[IntegrationWebhook, str]:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        raise PermissionError("Integration not found")
    secret = secrets.token_urlsafe(24)
    webhook = IntegrationWebhook(
        integration_id=integration_id,
        url=payload.url.strip(),
        secret_hash=_hash_token(secret),
        secret_value=secret,
        event_types=_normalize_webhook_events(payload.event_types),
        status="active",
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return webhook, secret


def list_integration_webhooks(db: Session, integration_id: str, current_user_id: str) -> list[IntegrationWebhook]:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        raise PermissionError("Integration not found")
    return db.scalars(
        select(IntegrationWebhook)
        .where(IntegrationWebhook.integration_id == integration_id)
        .order_by(IntegrationWebhook.created_at.desc())
    ).all()


def update_integration_webhook(
    db: Session,
    integration_id: str,
    webhook_id: str,
    payload: IntegrationWebhookUpdateRequest,
    current_user_id: str,
) -> IntegrationWebhook | None:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        raise PermissionError("Integration not found")
    webhook = db.get(IntegrationWebhook, webhook_id)
    if webhook is None or webhook.integration_id != integration_id:
        return None
    if payload.event_types is not None:
        webhook.event_types = _normalize_webhook_events(payload.event_types)
    if payload.status in {"active", "disabled"}:
        webhook.status = payload.status
    db.commit()
    db.refresh(webhook)
    return webhook


def delete_integration_webhook(
    db: Session,
    integration_id: str,
    webhook_id: str,
    current_user_id: str,
) -> bool:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        raise PermissionError("Integration not found")
    webhook = db.get(IntegrationWebhook, webhook_id)
    if webhook is None or webhook.integration_id != integration_id:
        return False
    db.delete(webhook)
    db.commit()
    return True


def list_integration_webhook_deliveries(
    db: Session,
    integration_id: str,
    webhook_id: str,
    current_user_id: str,
    limit: int = 50,
) -> list[IntegrationWebhookDelivery]:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        raise PermissionError("Integration not found")
    webhook = db.get(IntegrationWebhook, webhook_id)
    if webhook is None or webhook.integration_id != integration_id:
        return []
    return db.scalars(
        select(IntegrationWebhookDelivery)
        .where(IntegrationWebhookDelivery.webhook_id == webhook_id)
        .order_by(IntegrationWebhookDelivery.created_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()


def retry_integration_webhook_delivery(
    db: Session,
    integration_id: str,
    webhook_id: str,
    delivery_id: str,
    current_user_id: str,
) -> IntegrationWebhookDelivery | None:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        raise PermissionError("Integration not found")
    webhook = db.get(IntegrationWebhook, webhook_id)
    if webhook is None or webhook.integration_id != integration_id:
        return None
    delivery = db.get(IntegrationWebhookDelivery, delivery_id)
    if delivery is None or delivery.webhook_id != webhook_id:
        return None
    new_delivery = deliver_webhook_event(db, webhook, delivery.payload)
    db.commit()
    db.refresh(new_delivery)
    return new_delivery


def _webhook_scope_allows_document(
    db: Session,
    integration: Integration,
    document: Document,
) -> bool:
    scopes = db.scalars(
        select(IntegrationResourceScope).where(IntegrationResourceScope.integration_id == integration.id)
    ).all()
    return any(_scope_allows_document(db, scope, document, "view") for scope in scopes)


def _webhook_scope_allows_folder(
    db: Session,
    integration: Integration,
    folder: Folder,
) -> bool:
    scopes = db.scalars(
        select(IntegrationResourceScope).where(IntegrationResourceScope.integration_id == integration.id)
    ).all()
    for scope in scopes:
        if not role_at_least(scope.permission_level, "view"):
            continue
        if scope.resource_type == "space" and scope.resource_id == folder.space_id:
            return True
        if scope.resource_type == "folder" and scope.resource_id == folder.id:
            return True
        if scope.resource_type == "folder" and scope.include_children and scope.resource_id and _folder_contains(db, scope.resource_id, folder.id):
            return True
    return False


def _matching_webhooks_for_event(db: Session, event: dict[str, Any]) -> list[IntegrationWebhook]:
    event_type = str(event.get("event_type") or "")
    webhooks = db.scalars(
        select(IntegrationWebhook)
        .where(IntegrationWebhook.status == "active")
    ).all()
    if not webhooks:
        return []

    document = db.get(Document, str(event.get("document_id"))) if event.get("document_id") else None
    folder = db.get(Folder, str(event.get("folder_id"))) if event.get("folder_id") else None
    matched: list[IntegrationWebhook] = []
    integration_cache: dict[str, Integration | None] = {}
    for webhook in webhooks:
        if event_type not in (webhook.event_types or []):
            continue
        integration = integration_cache.get(webhook.integration_id)
        if integration is None:
            integration = db.get(Integration, webhook.integration_id)
            integration_cache[webhook.integration_id] = integration
        if integration is None or integration.status != "active":
            continue
        if document is not None:
            if _webhook_scope_allows_document(db, integration, document):
                matched.append(webhook)
            continue
        if folder is not None:
            if _webhook_scope_allows_folder(db, integration, folder):
                matched.append(webhook)
            continue
        if event.get("space_id"):
            scopes = db.scalars(
                select(IntegrationResourceScope).where(IntegrationResourceScope.integration_id == integration.id)
            ).all()
            if any(
                scope.resource_type == "space"
                and scope.resource_id == str(event.get("space_id"))
                and role_at_least(scope.permission_level, "view")
                for scope in scopes
            ):
                matched.append(webhook)
    return matched


def _sign_webhook_payload(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def deliver_webhook_event(
    db: Session,
    webhook: IntegrationWebhook,
    event: dict[str, Any],
) -> IntegrationWebhookDelivery:
    body = json.dumps(event, ensure_ascii=False).encode("utf-8")
    event_type = str(event.get("event_type") or "")
    event_id = str(event.get("event_id") or "")
    occurred_at = str(event.get("occurred_at") or "")
    delivery = IntegrationWebhookDelivery(
        webhook_id=webhook.id,
        event_type=event_type,
        payload=event,
        response_status="pending",
        attempt_count=0,
    )
    db.add(delivery)
    db.flush()

    try:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "CloudDoc-Webhook/1.0",
            "X-CloudDoc-Event": event_type,
            "X-CloudDoc-Event-Id": event_id,
            "X-CloudDoc-Occurred-At": occurred_at,
        }
        if webhook.secret_value:
            headers["X-CloudDoc-Signature"] = _sign_webhook_payload(webhook.secret_value, body)
        request = UrlRequest(webhook.url, data=body, headers=headers, method="POST")
        with urlopen(request, timeout=2.5) as response:
            status_code = getattr(response, "status", 200)
        delivery.attempt_count = 1
        delivery.response_status = f"http_{status_code}"
        delivery.delivered_at = datetime.now(timezone.utc) if 200 <= status_code < 300 else None
        delivery.next_retry_at = None if 200 <= status_code < 300 else datetime.now(timezone.utc) + timedelta(minutes=5)
    except HTTPError as exc:
        delivery.attempt_count = 1
        delivery.response_status = f"http_{exc.code}"
        delivery.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    except URLError:
        delivery.attempt_count = 1
        delivery.response_status = "network_error"
        delivery.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    except Exception:
        delivery.attempt_count = 1
        delivery.response_status = "delivery_error"
        delivery.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    return delivery


def dispatch_webhooks_for_event(db: Session, event: dict[str, Any]) -> None:
    matched_webhooks = _matching_webhooks_for_event(db, event)
    if not matched_webhooks:
        return
    for webhook in matched_webhooks:
        deliver_webhook_event(db, webhook, event)


def _extract_bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    return header.split(" ", 1)[1].strip()


def authenticate_open_actor(db: Session, request: Request) -> OpenActorContext:
    raw_token = _extract_bearer_token(request)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token is required")
    return authenticate_open_actor_by_token(db, raw_token)


def authenticate_open_actor_by_token(db: Session, raw_token: str) -> OpenActorContext:
    token = db.scalar(select(IntegrationToken).where(IntegrationToken.token_hash == _hash_token(raw_token)).limit(1))
    now = datetime.now(timezone.utc)
    if token is None or token.revoked_at is not None or (token.expires_at and token.expires_at <= now):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.get(User, token.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token owner is inactive")
    integration = db.get(Integration, token.integration_id) if token.integration_id else None
    if token.integration_id and (integration is None or integration.status != "active"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Integration is disabled")
    token.last_used_at = now
    db.commit()
    return OpenActorContext(actor=ActorContext.from_user(user, actor_type="service"), token=token, integration=integration)


def enforce_rate_limit(context: OpenActorContext, *, write: bool = False) -> None:
    now = time.time()
    key = f"{context.token.id}:{'write' if write else 'read'}"
    window = 60.0
    limit = 30 if write else 120
    events = [event for event in _rate_buckets.get(key, []) if event >= now - window]
    if len(events) >= limit:
        _rate_buckets[key] = events
        raise HTTPException(status_code=429, detail="Token rate limit exceeded")
    events.append(now)
    _rate_buckets[key] = events


def require_scope(context: OpenActorContext, scope: str) -> None:
    if scope not in context.scopes:
        raise HTTPException(status_code=403, detail=f"Missing token scope: {scope}")


def _folder_contains(db: Session, ancestor_id: str, folder_id: str | None) -> bool:
    current_id = folder_id
    while current_id:
        if current_id == ancestor_id:
            return True
        folder = db.get(Folder, current_id)
        if folder is None:
            return False
        current_id = folder.parent_folder_id
    return False


def _integration_scopes(db: Session, context: OpenActorContext) -> list[IntegrationResourceScope]:
    if context.integration is None:
        return []
    return db.scalars(
        select(IntegrationResourceScope).where(IntegrationResourceScope.integration_id == context.integration.id)
    ).all()


def _scope_allows_document(db: Session, scope: IntegrationResourceScope, document: Document, required_role: str) -> bool:
    if not role_at_least(scope.permission_level, required_role):
        return False
    if scope.resource_type == "public_documents":
        return document.visibility == "public"
    if scope.resource_type == "space":
        return scope.resource_id == document.space_id
    if scope.resource_type == "document":
        return scope.resource_id == document.id
    if scope.resource_type == "folder":
        if document.folder_id == scope.resource_id:
            return True
        return bool(scope.include_children and scope.resource_id and _folder_contains(db, scope.resource_id, document.folder_id))
    return False


def open_actor_can_access_document(db: Session, context: OpenActorContext, document: Document, required_role: str) -> bool:
    if not can_view_document(db, document, context.user_id):
        return False
    if required_role in {"edit", "full_access"} and not can_edit_document(db, document, context.user_id):
        return False
    if context.integration is None:
        return True
    return any(_scope_allows_document(db, scope, document, required_role) for scope in _integration_scopes(db, context))


def _scope_allows_location(
    db: Session,
    scope: IntegrationResourceScope,
    *,
    space_id: str,
    folder_id: str | None,
    required_role: str,
) -> bool:
    if not role_at_least(scope.permission_level, required_role):
        return False
    if scope.resource_type == "space":
        return scope.resource_id == space_id
    if scope.resource_type == "folder":
        if folder_id == scope.resource_id:
            return True
        return bool(scope.include_children and scope.resource_id and _folder_contains(db, scope.resource_id, folder_id))
    return False


def open_actor_can_write_location(
    db: Session,
    context: OpenActorContext,
    *,
    space_id: str,
    folder_id: str | None,
) -> bool:
    if context.integration is None:
        return True
    return any(
        _scope_allows_location(db, scope, space_id=space_id, folder_id=folder_id, required_role="edit")
        for scope in _integration_scopes(db, context)
    )


def create_audit_log(
    db: Session,
    context: OpenActorContext,
    *,
    operation: str,
    target_type: str | None = None,
    target_id: str | None = None,
    request_summary: dict[str, Any] | None = None,
    response_status: str = "success",
    error_message: str | None = None,
    request: Request | None = None,
    source: str = "rest_open_api",
) -> None:
    db.add(
        IntegrationAuditLog(
            integration_id=context.integration.id if context.integration else None,
            token_id=context.token.id,
            actor_id=context.user_id,
            actor_type=context.actor.actor_type,
            source=source,
            operation=operation,
            target_type=target_type,
            target_id=target_id,
            request_summary=request_summary or {},
            response_status=response_status,
            error_message=error_message,
            ip_address=request.client.host if request and request.client else None,
            user_agent=(request.headers.get("user-agent") if request else None),
        )
    )
    db.commit()


def list_token_audit_logs(db: Session, token_id: str, current_user_id: str, limit: int = 50) -> list[IntegrationAuditLog]:
    token = db.get(IntegrationToken, token_id)
    if token is None or token.user_id != current_user_id:
        return []
    return db.scalars(
        select(IntegrationAuditLog)
        .where(IntegrationAuditLog.token_id == token_id)
        .order_by(IntegrationAuditLog.created_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()


def list_integration_audit_logs(
    db: Session,
    integration_id: str,
    current_user_id: str,
    limit: int = 50,
) -> list[IntegrationAuditLog]:
    if get_owned_integration(db, integration_id, current_user_id) is None:
        return []
    return db.scalars(
        select(IntegrationAuditLog)
        .where(IntegrationAuditLog.integration_id == integration_id)
        .order_by(IntegrationAuditLog.created_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()


def list_open_documents(db: Session, context: OpenActorContext, state: str = "active"):
    require_scope(context, "documents:read")
    enforce_rate_limit(context)
    documents = list_documents(db, state=state, user_id=context.user_id)
    if context.integration is None:
        return documents
    allowed_ids = {
        item.id
        for item in documents
        if (model := db.get(Document, item.id)) is not None and open_actor_can_access_document(db, context, model, "view")
    }
    return [item for item in documents if item.id in allowed_ids]


def search_open_documents(db: Session, context: OpenActorContext, query: str):
    require_scope(context, "search:read")
    enforce_rate_limit(context)
    results = search_documents(db, query, user_id=context.user_id)
    if context.integration is None:
        return results
    filtered = []
    for result in results:
        document = db.get(Document, result.id)
        if document is not None and open_actor_can_access_document(db, context, document, "view"):
            filtered.append(result)
    return filtered


def get_open_document(db: Session, context: OpenActorContext, document_id: str):
    require_scope(context, "documents:read")
    enforce_rate_limit(context)
    document = db.get(Document, document_id)
    if document is None or document.is_deleted or not open_actor_can_access_document(db, context, document, "view"):
        return None
    return get_document_detail(db, document_id, context.user_id)


def create_open_document_from_markdown(db: Session, context: OpenActorContext, payload: MarkdownDocumentCreateRequest):
    require_scope(context, "documents:create")
    enforce_rate_limit(context, write=True)
    if not open_actor_can_write_location(db, context, space_id=payload.space_id, folder_id=payload.folder_id):
        raise PermissionError("Token is not authorized to write to this location")
    document = create_document(
        db,
        DocumentCreateRequest(
            title=payload.title,
            space_id=payload.space_id,
            folder_id=payload.folder_id,
            document_type="doc",
            visibility=payload.visibility,
        ),
        context.user_id,
    )
    content_json = markdown_to_content_json(payload.markdown)
    updated = update_document_content(
        db,
        document.id,
        DocumentContentUpdateRequest(
            schema_version=1,
            content_json=content_json,
            plain_text=markdown_to_plain_text(payload.markdown),
        ),
        context.user_id,
    )
    return updated or document


def update_open_document_from_markdown(
    db: Session,
    context: OpenActorContext,
    document_id: str,
    payload: MarkdownDocumentUpdateRequest,
):
    require_scope(context, "documents:update")
    enforce_rate_limit(context, write=True)
    document = db.get(Document, document_id)
    if document is None or document.is_deleted or not open_actor_can_access_document(db, context, document, "edit"):
        raise PermissionError("Token is not authorized to update this document")
    content_json = markdown_to_content_json(payload.markdown)
    if payload.title:
        content = content_json.setdefault("content", [])
        if content:
            first = content[0]
            if isinstance(first, dict) and first.get("type") == "heading":
                first["content"] = [{"type": "text", "text": payload.title}]
    return update_document_content(
        db,
        document_id,
        DocumentContentUpdateRequest(
            schema_version=1,
            content_json=content_json,
            plain_text=markdown_to_plain_text(payload.markdown),
        ),
        context.user_id,
    )


def list_open_folder_tree(db: Session, context: OpenActorContext, space_id: str):
    require_scope(context, "folders:read")
    enforce_rate_limit(context)
    return get_space_tree(db, space_id, context.user_id)
