from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.comments import router as comments_router
from app.api.routes.documents import router as documents_router
from app.api.routes.events import router as events_router
from app.api.routes.folders import router as folders_router
from app.api.routes.integrations import router as integrations_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.open_api import router as open_api_router
from app.api.routes.oauth import router as oauth_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.permissions import router as permissions_router
from app.api.routes.preferences import router as preferences_router
from app.api.routes.sessions import router as sessions_router
from app.api.routes.share import router as share_router
from app.api.routes.spaces import router as spaces_router
from app.api.routes.templates import router as templates_router

api_router = APIRouter()
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(comments_router, tags=["comments"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(events_router, tags=["events"])
api_router.include_router(folders_router, tags=["folders"])
api_router.include_router(integrations_router, tags=["integrations"])
api_router.include_router(notifications_router, tags=["notifications"])
api_router.include_router(open_api_router, tags=["open"])
api_router.include_router(oauth_router, tags=["oauth"])
api_router.include_router(organizations_router, tags=["organizations"])
api_router.include_router(permissions_router, tags=["permissions"])
api_router.include_router(preferences_router, tags=["preferences"])
api_router.include_router(sessions_router, tags=["sessions"])
api_router.include_router(share_router, tags=["share"])
api_router.include_router(spaces_router, prefix="/spaces", tags=["spaces"])
api_router.include_router(templates_router, prefix="/templates", tags=["templates"])
