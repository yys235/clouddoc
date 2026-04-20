from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.db import SessionLocal, init_db
from app.services.bootstrap_service import seed_demo_data
from app.services.document_service import ensure_supported_document_types
from app.services.folder_service import ensure_default_newdoc_folders
from app.services.submission_guard_service import submission_guard


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        ensure_supported_document_types(db)
        seed_demo_data(db)
        ensure_default_newdoc_folders(db)
    finally:
        db.close()
    yield


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
