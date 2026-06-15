from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.folder import FolderChildrenResponse, TreeNodeSummary
from app.schemas.space import SpaceSummary, SpaceUpdateRequest
from app.services.auth_service import optional_current_user_dependency, require_current_user_dependency
from app.services.folder_service import get_space_tree, list_space_root_children
from app.services.space_service import list_spaces, update_space_name

router = APIRouter()


@router.get("", response_model=list[SpaceSummary])
def list_spaces_route(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> list[SpaceSummary]:
    return list_spaces(db, user_id=current_user.id if current_user else None)


@router.patch("/{space_id}", response_model=SpaceSummary)
def update_space_route(
    space_id: str,
    payload: SpaceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> SpaceSummary:
    try:
        space = update_space_name(db, space_id, payload.name, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if space is None:
        raise HTTPException(status_code=404, detail="Space not found")
    return space


@router.get("/{space_id}/root-children", response_model=FolderChildrenResponse)
def space_root_children_route(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> FolderChildrenResponse:
    try:
        return list_space_root_children(db, space_id, current_user.id if current_user else None)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
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
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
