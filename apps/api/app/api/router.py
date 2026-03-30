from fastapi import APIRouter

from app.api.routes.documents import router as documents_router
from app.api.routes.spaces import router as spaces_router
from app.api.routes.templates import router as templates_router

api_router = APIRouter()
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(spaces_router, prefix="/spaces", tags=["spaces"])
api_router.include_router(templates_router, prefix="/templates", tags=["templates"])
