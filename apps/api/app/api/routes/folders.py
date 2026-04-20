from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.folder import (
    AncestorItem,
    FolderBulkMoveRequest,
    FolderChildrenResponse,
    FolderCreateRequest,
    FolderFavoriteStatusResponse,
    FolderMoveRequest,
    FolderReorderRequest,
    FolderSummary,
    FolderUpdateRequest,
    TreePinRequest,
    TreePinResponse,
    TreeShortcutCreateRequest,
    TreeNodeActionsResponse,
    TreeNodeSummary,
)
from app.services.auth_service import optional_current_user_dependency, require_current_user_dependency
from app.services.folder_service import (
    bulk_move_nodes,
    create_folder,
    create_tree_shortcut,
    delete_folder,
    delete_tree_shortcut,
    favorite_folder,
    get_folder_ancestors,
    get_folder_detail,
    get_space_tree,
    get_tree_node_actions,
    list_favorite_folders,
    list_folder_children,
    move_folder,
    pin_tree_node,
    reorder_children,
    rename_folder,
    unpin_tree_node,
    unfavorite_folder,
)

router = APIRouter(prefix="/folders")


@router.post("", response_model=FolderSummary)
def create_folder_route(
    payload: FolderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> FolderSummary:
    try:
        return create_folder(db, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/bulk-move")
def bulk_move_route(
    payload: FolderBulkMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> dict:
    try:
        bulk_move_nodes(db, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/reorder")
def reorder_route(
    payload: FolderReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> dict:
    try:
        reorder_children(db, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/pins", response_model=TreePinResponse)
def pin_tree_node_route(
    payload: TreePinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> TreePinResponse:
    try:
        return pin_tree_node(db, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/pins", response_model=TreePinResponse)
def unpin_tree_node_route(
    payload: TreePinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> TreePinResponse:
    try:
        return unpin_tree_node(db, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/actions/{node_type}/{node_id}", response_model=TreeNodeActionsResponse)
def get_tree_node_actions_route(
    node_type: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> TreeNodeActionsResponse:
    try:
        return get_tree_node_actions(db, node_type, node_id, current_user.id if current_user else None)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        message = str(exc)
        if message.endswith("not found"):
            raise HTTPException(status_code=404, detail=message) from exc
        raise HTTPException(status_code=400, detail=message) from exc


@router.post("/shortcuts", response_model=TreeNodeSummary)
def create_tree_shortcut_route(
    payload: TreeShortcutCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> TreeNodeSummary:
    try:
        return create_tree_shortcut(db, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/shortcuts/{shortcut_id}", response_model=TreeNodeSummary)
def delete_tree_shortcut_route(
    shortcut_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> TreeNodeSummary:
    try:
        shortcut = delete_tree_shortcut(db, shortcut_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if shortcut is None:
        raise HTTPException(status_code=404, detail="Shortcut not found")
    return shortcut


@router.get("/favorites", response_model=list[FolderSummary])
def list_favorite_folders_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> list[FolderSummary]:
    return list_favorite_folders(db, current_user.id)


@router.post("/{folder_id}/favorite", response_model=FolderFavoriteStatusResponse)
def favorite_folder_route(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> FolderFavoriteStatusResponse:
    try:
        result = favorite_folder(db, folder_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result


@router.delete("/{folder_id}/favorite", response_model=FolderFavoriteStatusResponse)
def unfavorite_folder_route(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> FolderFavoriteStatusResponse:
    try:
        result = unfavorite_folder(db, folder_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result


@router.get("/{folder_id}", response_model=FolderSummary)
def get_folder_route(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> FolderSummary:
    folder = get_folder_detail(db, folder_id, current_user.id if current_user else None)
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


@router.patch("/{folder_id}", response_model=FolderSummary)
def rename_folder_route(
    folder_id: str,
    payload: FolderUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> FolderSummary:
    try:
        folder = rename_folder(db, folder_id, payload.title, current_user.id, visibility=payload.visibility)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


@router.post("/{folder_id}/move", response_model=FolderSummary)
def move_folder_route(
    folder_id: str,
    payload: FolderMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> FolderSummary:
    try:
        folder = move_folder(
            db,
            folder_id,
            parent_folder_id=payload.parent_folder_id,
            current_user_id=current_user.id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


@router.delete("/{folder_id}", response_model=FolderSummary)
def delete_folder_route(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user_dependency),
) -> FolderSummary:
    try:
        folder = delete_folder(db, folder_id, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


@router.get("/{folder_id}/children", response_model=FolderChildrenResponse)
def folder_children_route(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> FolderChildrenResponse:
    try:
        result = list_folder_children(db, folder_id, current_user.id if current_user else None)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return result


@router.get("/{folder_id}/ancestors", response_model=list[AncestorItem])
def folder_ancestors_route(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(optional_current_user_dependency),
) -> list[AncestorItem]:
    return get_folder_ancestors(db, folder_id, current_user.id if current_user else None)
