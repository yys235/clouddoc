from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.folder import FolderChildrenResponse, TreeNodeSummary
from app.schemas.space import SpaceSummary
from app.services.auth_service import optional_current_user_dependency
from app.services.folder_service import get_space_tree, list_space_root_children
from app.services.space_service import list_spaces

router = APIRouter()


@router.get("", response_model=list[SpaceSummary])
def list_spaces_route(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> list[SpaceSummary]:
    return list_spaces(db, user_id=current_user.id if current_user else None)


@router.get("/{space_id}/root-children", response_model=FolderChildrenResponse)
def space_root_children_route(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> FolderChildrenResponse:
    try:
        return list_space_root_children(db, space_id, current_user.id if current_user else None)
    except PermissionError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{space_id}/tree", response_model=list[TreeNodeSummary])
def space_tree_route(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> list[TreeNodeSummary]:
    try:
        return get_space_tree(db, space_id, current_user.id if current_user else None)
    except PermissionError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=str(exc)) from exc
