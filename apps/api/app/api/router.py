from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.comments import router as comments_router
from app.api.routes.documents import router as documents_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.sessions import router as sessions_router
from app.api.routes.spaces import router as spaces_router
from app.api.routes.templates import router as templates_router

api_router = APIRouter()
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(comments_router, tags=["comments"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(notifications_router, tags=["notifications"])
api_router.include_router(organizations_router, tags=["organizations"])
api_router.include_router(sessions_router, tags=["sessions"])
api_router.include_router(spaces_router, prefix="/spaces", tags=["spaces"])
api_router.include_router(templates_router, prefix="/templates", tags=["templates"])
