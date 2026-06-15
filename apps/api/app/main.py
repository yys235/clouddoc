from contextlib import asynccontextmanager
from pathlib import Path
import asyncio

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.db import SessionLocal, init_db
from app.services.bootstrap_service import ensure_runtime_schema, seed_demo_data
from app.services.document_service import ensure_supported_document_types, purge_expired_deleted_documents, purge_unreferenced_document_assets
from app.services.folder_service import ensure_default_newdoc_folders
from app.services.integration_service import retry_due_webhook_deliveries
from app.services.submission_guard_service import submission_guard
from app.services.system_service import is_system_initialized


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        ensure_runtime_schema(db)
        ensure_supported_document_types(db)
        if settings.auto_seed_demo or settings.app_env == "development":
            seed_demo_data(db)
        ensure_default_newdoc_folders(db)
    finally:
        db.close()
    stop_event = asyncio.Event()

    async def webhook_retry_worker() -> None:
        while not stop_event.is_set():
            try:
                await asyncio.to_thread(_run_webhook_retries_once)
            except Exception:
                # Retry worker failures must not crash the API process.
                pass
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=max(1, settings.webhook_retry_interval_seconds))
            except asyncio.TimeoutError:
                continue

    async def deleted_document_purge_worker() -> None:
        while not stop_event.is_set():
            try:
                await asyncio.to_thread(_run_deleted_document_purge_once)
            except Exception:
                # Purge failures should be visible in logs but must not crash API startup.
                pass
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=3600)
            except asyncio.TimeoutError:
                continue

    worker_task = asyncio.create_task(webhook_retry_worker())
    purge_worker_task = asyncio.create_task(deleted_document_purge_worker())
    try:
        yield
    finally:
        stop_event.set()
        for task in (worker_task, purge_worker_task):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


def _run_webhook_retries_once() -> None:
    db = SessionLocal()
    try:
        retry_due_webhook_deliveries(db)
    finally:
        db.close()


def _run_deleted_document_purge_once() -> None:
    db = SessionLocal()
    try:
        purge_expired_deleted_documents(db, retention_days=settings.deleted_document_retention_days)
        purge_unreferenced_document_assets(db, retention_days=settings.deleted_document_retention_days)
    finally:
        db.close()


def create_application() -> FastAPI:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    app = FastAPI(
        title=settings.app_name,
        debug=settings.app_debug,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def require_initialized_system(request, call_next):
        path = request.url.path
        if (
            request.method == "OPTIONS"
            or not path.startswith(settings.api_prefix)
            or path.startswith(f"{settings.api_prefix}/system/bootstrap")
            or path.startswith(f"{settings.api_prefix}/share/")
        ):
            return await call_next(request)

        db = SessionLocal()
        try:
            initialized = is_system_initialized(db)
        finally:
            db.close()
        if not initialized:
            return JSONResponse(
                status_code=423,
                content={
                    "detail": {
                        "code": "system_not_initialized",
                        "message": "CloudDoc has not been initialized. Open /setup to complete first deployment setup.",
                    }
                },
            )
        return await call_next(request)

    @app.middleware("http")
    async def prevent_duplicate_submissions(request, call_next):
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await call_next(request)

        submission_key = request.headers.get("x-clouddoc-submission-key")
        if not submission_key:
            return await call_next(request)

        session_token = request.cookies.get(settings.session_cookie_name, "anonymous")
        guard_key = f"{session_token}:{request.method}:{request.url.path}:{submission_key}"
        if not submission_guard.acquire(guard_key):
            return JSONResponse(
                status_code=409,
                content={"detail": "Duplicate submission is already being processed"},
            )
        try:
            return await call_next(request)
        finally:
            submission_guard.release(guard_key)

    @app.get("/health", tags=["system"])
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    app.mount(settings.upload_url_prefix, StaticFiles(directory=settings.upload_dir), name="uploads")
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_application()
