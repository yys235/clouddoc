"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DocumentShareDialog } from "@/components/editor/document-share-dialog";
import {
  createDocument,
  createFolder,
  bulkMoveNodes,
  deleteDocument,
  deleteFolder,
  duplicateDocument,
  favoriteDocument,
  favoriteFolder,
  moveDocumentToFolder,
  moveFolder,
  pinTreeNode,
  reorderFolderChildren,
  renameDocument,
  renameFolder,
  subscribeDocumentLibraryBrowserEvents,
  type AncestorItem,
  type DocumentTreeOpenMode,
  type FolderChildrenResult,
  type FolderSummary,
  type OrganizationMember,
  type SpaceSummary,
  type TreeNode,
  unpinTreeNode,
  unfavoriteDocument,
  unfavoriteFolder,
  updateUserPreference,
  uploadPdfDocument,
} from "@/lib/api";

type NodeDragPayload = { id: string; nodeType: "folder" | "document" };
type TreeDropPosition = "before" | "inside" | "after";
type ActiveTreeMenu = { node: TreeNode; x: number; y: number };
type TreeShareDialogTarget = {
  node: TreeNode;
  tab: "visibility" | "members" | "share" | "security" | "integrations" | "audit";
};
type LibraryEvent = {
  event_id?: string;
  event_type?: string;
  space_id?: string | null;
  document_id?: string | null;
  folder_id?: string | null;
  document?: {
    id: string;
    title: string;
    document_type?: string;
    status?: string;
    visibility: string;
    space_id: string;
    folder_id?: string | null;
    sort_order?: number;
    updated_at?: string | null;
    is_deleted?: boolean;
  };
  folder?: {
    id: string;
    title: string;
    visibility: string;
    space_id: string;
    parent_folder_id?: string | null;
    sort_order?: number;
    updated_at?: string | null;
    is_deleted?: boolean;
  };
};

function parseDragPayload(raw: string): NodeDragPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const payload = JSON.parse(raw) as NodeDragPayload;
    if ((payload.nodeType === "folder" || payload.nodeType === "document") && payload.id) {
      return payload;
    }
  } catch {
    return null;
  }
  return null;
}

function getTreeDropPosition(event: DragEvent<HTMLElement>, nodeType: TreeNode["nodeType"]): TreeDropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const offset = event.clientY - rect.top;
  const topZone = rect.height * 0.28;
  const bottomZone = rect.height * 0.72;
  if (offset < topZone) {
    return "before";
  }
  if (offset > bottomZone) {
    return "after";
  }
  return nodeType === "folder" ? "inside" : "after";
}

function findTreeNode(nodes: TreeNode[], nodeId: string, nodeType: TreeNode["nodeType"]): TreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId && node.nodeType === nodeType) {
      return node;
    }
    const child = findTreeNode(node.children, nodeId, nodeType);
    if (child) {
      return child;
    }
  }
  return null;
}

function findFolderChildren(nodes: TreeNode[], folderId: string | null): TreeNode[] {
  if (folderId === null) {
    return nodes;
  }
  const folder = findTreeNode(nodes, folderId, "folder");
  return folder?.children ?? [];
}

function sortNodes(nodes: TreeNode[]) {
  return [...nodes].sort(
    (a, b) =>
      Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
      a.sortOrder - b.sortOrder ||
      a.title.localeCompare(b.title) ||
      a.nodeType.localeCompare(b.nodeType),
  );
}

function removeTreeNode(nodes: TreeNode[], nodeId: string, nodeType: TreeNode["nodeType"]): TreeNode[] {
  let changed = false;
  const next = nodes
    .filter((node) => {
      const keep = !(node.id === nodeId && node.nodeType === nodeType);
      if (!keep) changed = true;
      return keep;
    })
    .map((node) => {
      const children = removeTreeNode(node.children, nodeId, nodeType);
      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
      return node;
    });
  return changed ? next : nodes;
}

function updateTreeNodeTitle(nodes: TreeNode[], nodeId: string, nodeType: TreeNode["nodeType"], title: string): TreeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === nodeId && node.nodeType === nodeType) {
      changed = true;
      return { ...node, title };
    }
    const children = updateTreeNodeTitle(node.children, nodeId, nodeType, title);
    if (children !== node.children) {
      changed = true;
      return { ...node, children };
    }
    return node;
  });
  return changed ? next : nodes;
}

function updateTreeNodePinned(nodes: TreeNode[], nodeId: string, nodeType: TreeNode["nodeType"], isPinned: boolean): TreeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === nodeId && node.nodeType === nodeType) {
      changed = true;
      return { ...node, isPinned };
    }
    const children = updateTreeNodePinned(node.children, nodeId, nodeType, isPinned);
    if (children !== node.children) {
      changed = true;
      return { ...node, children };
    }
    return node;
  });
  return changed ? sortNodes(next) : nodes;
}

function updateTreeNodeFavorited(
  nodes: TreeNode[],
  nodeId: string,
  nodeType: TreeNode["nodeType"],
  isFavorited: boolean,
): TreeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === nodeId && node.nodeType === nodeType) {
      changed = true;
      return { ...node, isFavorited };
    }
    const children = updateTreeNodeFavorited(node.children, nodeId, nodeType, isFavorited);
    if (children !== node.children) {
      changed = true;
      return { ...node, children };
    }
    return node;
  });
  return changed ? next : nodes;
}

function updateTreeNodeVisibility(
  nodes: TreeNode[],
  nodeId: string,
  nodeType: TreeNode["nodeType"],
  visibility: string,
): TreeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === nodeId && node.nodeType === nodeType) {
      changed = true;
      return { ...node, visibility };
    }
    const children = updateTreeNodeVisibility(node.children, nodeId, nodeType, visibility);
    if (children !== node.children) {
      changed = true;
      return { ...node, children };
    }
    return node;
  });
  return changed ? next : nodes;
}

function upsertTreeNode(nodes: TreeNode[], node: TreeNode, parentFolderId: string | null): TreeNode[] {
  const withoutExisting = removeTreeNode(nodes, node.id, node.nodeType);
  if (parentFolderId === null) {
    return sortNodes([...withoutExisting, node]);
  }
  let changed = false;
  const next = withoutExisting.map((item) => {
    if (item.nodeType === "folder" && item.id === parentFolderId) {
      changed = true;
      return { ...item, children: sortNodes([...removeTreeNode(item.children, node.id, node.nodeType), node]) };
    }
    const children = upsertTreeNode(item.children, node, parentFolderId);
    if (children !== item.children) {
      changed = true;
      return { ...item, children };
    }
    return item;
  });
  return changed ? next : withoutExisting;
}

function eventDocumentToNode(document: NonNullable<LibraryEvent["document"]>): TreeNode {
  return {
    id: document.id,
    nodeType: "document",
    title: document.title,
    spaceId: document.space_id,
    parentFolderId: document.folder_id ?? undefined,
    sortOrder: document.sort_order ?? 0,
    visibility: document.visibility,
    updatedAt: document.updated_at ? new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(document.updated_at)) : "",
    canManage: true,
    documentType: document.document_type ?? "doc",
    isDeleted: Boolean(document.is_deleted),
    isPinned: false,
    isFavorited: false,
    children: [],
  };
}

function eventFolderToNode(folder: NonNullable<LibraryEvent["folder"]>): TreeNode {
  return {
    id: folder.id,
    nodeType: "folder",
    title: folder.title,
    spaceId: folder.space_id,
    parentFolderId: folder.parent_folder_id ?? undefined,
    sortOrder: folder.sort_order ?? 0,
    visibility: folder.visibility,
    updatedAt: folder.updated_at ? new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(folder.updated_at)) : "",
    canManage: true,
    isDeleted: Boolean(folder.is_deleted),
    isPinned: false,
    isFavorited: false,
    children: [],
  };
}

function upsertCurrentChild(children: TreeNode[], node: TreeNode, currentFolderId: string | null): TreeNode[] {
  if ((node.parentFolderId ?? null) !== currentFolderId || node.isDeleted) {
    return removeTreeNode(children, node.id, node.nodeType);
  }
  return sortNodes([...removeTreeNode(children, node.id, node.nodeType), node]);
}

function buildReorderedSiblingItems(
  siblings: TreeNode[],
  dragged: NodeDragPayload,
  target: NodeDragPayload,
  position: Exclude<TreeDropPosition, "inside">,
) {
  const draggedKey = `${dragged.nodeType}:${dragged.id}`;
  const targetKey = `${target.nodeType}:${target.id}`;
  const withoutDragged = siblings.filter((item) => `${item.nodeType}:${item.id}` !== draggedKey);
  const targetIndex = withoutDragged.findIndex((item) => `${item.nodeType}:${item.id}` === targetKey);
  if (targetIndex === -1) {
    return null;
  }

  const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
  const nextItems: Array<{ id: string; nodeType: "folder" | "document" }> = withoutDragged.map((item) => ({
    id: item.id,
    nodeType: item.nodeType,
  }));
  nextItems.splice(insertIndex, 0, dragged);
  return nextItems;
}

function FolderTree({
  nodes,
  currentFolderId,
  documentOpenMode,
  onDropNode,
  onReorderNode,
  expandedFolderIds,
  onToggleFolder,
  dropIndicator,
  onDropIndicatorChange,
  activeMenuKey,
  onOpenMenu,
}: {
  nodes: TreeNode[];
  currentFolderId?: string | null;
  documentOpenMode: DocumentTreeOpenMode;
  onDropNode: (targetFolderId: string | null, payload: NodeDragPayload) => void;
  onReorderNode: (dragged: NodeDragPayload, target: NodeDragPayload, position: Exclude<TreeDropPosition, "inside">) => void;
  expandedFolderIds: Set<string>;
  onToggleFolder: (folderId: string) => void;
  dropIndicator: { key: string; position: TreeDropPosition } | null;
  onDropIndicatorChange: (indicator: { key: string; position: TreeDropPosition } | null) => void;
  activeMenuKey?: string | null;
  onOpenMenu: (node: TreeNode, event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div className="space-y-0.5" role="tree">
      {nodes.map((node) => (
        <div key={`${node.nodeType}-${node.id}`} className="space-y-0.5">
          <div
            onContextMenu={(event) => onOpenMenu(node, event)}
            tabIndex={0}
            role="treeitem"
            aria-expanded={node.nodeType === "folder" ? expandedFolderIds.has(node.id) : undefined}
            aria-label={`${node.title}${node.nodeType === "folder" ? " 文件夹" : " 文档"}`}
            className={`group relative rounded-lg ${
              dropIndicator?.key === `${node.nodeType}:${node.id}` && dropIndicator.position === "inside"
                ? "bg-blue-50 ring-1 ring-blue-200"
                : ""
            }`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/clouddoc-node",
                JSON.stringify({ id: node.id, nodeType: node.nodeType }),
              );
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              if (!Array.from(event.dataTransfer.types).includes("application/clouddoc-node")) {
                return;
              }
              event.preventDefault();
              const position = getTreeDropPosition(event, node.nodeType);
              onDropIndicatorChange({ key: `${node.nodeType}:${node.id}`, position });
              event.dataTransfer.dropEffect = "move";
            }}
            onDragLeave={() => onDropIndicatorChange(null)}
            onDrop={(event) => {
              event.preventDefault();
              onDropIndicatorChange(null);
              const payload = parseDragPayload(event.dataTransfer.getData("application/clouddoc-node"));
              if (!payload) return;
              if (payload.id === node.id && payload.nodeType === node.nodeType) return;
              const position = getTreeDropPosition(event, node.nodeType);
              if (position === "inside" && node.nodeType === "folder") {
                onDropNode(node.id, payload);
                return;
              }
              onReorderNode(payload, { id: node.id, nodeType: node.nodeType }, position === "inside" ? "after" : position);
            }}
            onDragEnd={() => onDropIndicatorChange(null)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
              const isDocument = node.nodeType === "document";
              const href = node.nodeType === "folder" ? `/folders/${node.id}` : `/docs/${node.id}`;
              if (event.key === "Enter") {
                event.preventDefault();
                if (isDocument && documentOpenMode === "new-window") {
                  window.open(href, "_blank", "noopener,noreferrer");
                } else {
                  window.location.href = href;
                }
              } else if (event.key === "ArrowRight" && node.nodeType === "folder" && !expandedFolderIds.has(node.id)) {
                event.preventDefault();
                onToggleFolder(node.id);
              } else if (event.key === "ArrowLeft" && node.nodeType === "folder" && expandedFolderIds.has(node.id)) {
                event.preventDefault();
                onToggleFolder(node.id);
              } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                event.preventDefault();
                onOpenMenu(node, event as unknown as MouseEvent<HTMLElement>);
              }
            }}
          >
            {(() => {
              const isDocument = node.nodeType === "document";
              const href = node.nodeType === "folder" ? `/folders/${node.id}` : `/docs/${node.id}`;
              const shouldOpenNewWindow = isDocument && documentOpenMode === "new-window";
              return (
                <>
            {dropIndicator?.key === `${node.nodeType}:${node.id}` && dropIndicator.position === "before" ? (
              <div className="absolute -top-1 left-2 right-2 h-0.5 rounded-full bg-blue-400" />
            ) : null}
            <div
              className={`grid grid-cols-[16px_minmax(0,1fr)_26px] items-center gap-1 px-1.5 py-0.5 text-[13px] leading-4 transition hover:bg-slate-100 ${
                (node.nodeType === "folder" && node.id === currentFolderId) || activeMenuKey === `${node.nodeType}:${node.id}`
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600"
              }`}
            >
              {node.nodeType === "folder" ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleFolder(node.id);
                  }}
                  className="inline-flex h-4 w-4 items-center justify-center text-[10px] leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={expandedFolderIds.has(node.id) ? "折叠文件夹" : "展开文件夹"}
                >
                  {expandedFolderIds.has(node.id) ? "▾" : "▸"}
                </button>
              ) : (
                <span className="block h-4 w-4" />
              )}
              <Link
                href={href}
                target={shouldOpenNewWindow ? "_blank" : undefined}
                rel={shouldOpenNewWindow ? "noreferrer" : undefined}
                draggable={false}
                onClick={(event) => event.stopPropagation()}
                className="grid min-w-0 grid-cols-[17px_minmax(0,1fr)] items-center gap-1 py-0"
              >
                <span className="flex h-4 w-4 items-center justify-center text-[13px] text-slate-400">
                  {node.nodeType === "folder" ? "📁" : "📄"}
                </span>
                <span className="truncate pl-0.5">{node.title}</span>
              </Link>
              <button
                type="button"
                onClick={(event) => onOpenMenu(node, event)}
                className={`flex h-5 w-6 items-center justify-center border text-[15px] font-semibold leading-none shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition ${
                  activeMenuKey === `${node.nodeType}:${node.id}`
                    ? "border-blue-300 bg-blue-50 text-blue-600 opacity-100"
                    : "border-slate-300 bg-white text-slate-500 opacity-0 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                }`}
                aria-label={`${node.title} 更多操作`}
              >
                ⋯
              </button>
            </div>
            {dropIndicator?.key === `${node.nodeType}:${node.id}` && dropIndicator.position === "after" ? (
              <div className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-blue-400" />
            ) : null}
                </>
              );
            })()}
          </div>
          {node.children.length > 0 && (node.nodeType !== "folder" || expandedFolderIds.has(node.id)) ? (
            <div className="ml-[18px] border-l border-slate-200 pl-[7px]">
              <FolderTree
                nodes={node.children}
                currentFolderId={currentFolderId}
                documentOpenMode={documentOpenMode}
                onDropNode={onDropNode}
                onReorderNode={onReorderNode}
                expandedFolderIds={expandedFolderIds}
                onToggleFolder={onToggleFolder}
                dropIndicator={dropIndicator}
                onDropIndicatorChange={onDropIndicatorChange}
                activeMenuKey={activeMenuKey}
                onOpenMenu={onOpenMenu}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function collectFolderIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (items: TreeNode[]) => {
    for (const item of items) {
      if (item.nodeType === "folder") {
        ids.push(item.id);
        if (item.children.length > 0) {
          walk(item.children);
        }
      }
    }
  };
  walk(nodes);
  return ids;
}

function flattenFolders(nodes: TreeNode[]): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = [];
  const walk = (items: TreeNode[], prefix = "") => {
    for (const item of items) {
      if (item.nodeType === "folder") {
        const label = prefix ? `${prefix} / ${item.title}` : item.title;
        result.push({ id: item.id, label });
        if (item.children.length > 0) {
          walk(item.children, label);
        }
      }
    }
  };
  walk(nodes);
  return result;
}

export function FolderWorkspaceView({
  spaces,
  selectedSpace,
  tree,
  currentChildren,
  currentFolder,
  ancestors,
  apiUnavailable = false,
  initialDocumentTreeOpenMode = "same-page",
  mentionCandidates = [],
}: {
  spaces: SpaceSummary[];
  selectedSpace: SpaceSummary | null;
  tree: TreeNode[];
  currentChildren: FolderChildrenResult | null;
  currentFolder?: FolderSummary | null;
  ancestors?: AncestorItem[];
  apiUnavailable?: boolean;
  initialDocumentTreeOpenMode?: DocumentTreeOpenMode;
  mentionCandidates?: OrganizationMember[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadPdf, setShowUploadPdf] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState<string | null>(null);
  const [showDeleteFolder, setShowDeleteFolder] = useState(false);
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
  const [activeTreeMenu, setActiveTreeMenu] = useState<ActiveTreeMenu | null>(null);
  const [treeRenameTarget, setTreeRenameTarget] = useState<TreeNode | null>(null);
  const [treeRenameValue, setTreeRenameValue] = useState("");
  const [treeDeleteTarget, setTreeDeleteTarget] = useState<TreeNode | null>(null);
  const [treeShareDialogTarget, setTreeShareDialogTarget] = useState<TreeShareDialogTarget | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentLocationMode, setDocumentLocationMode] = useState<"existing" | "new-folder">("existing");
  const [documentFolderId, setDocumentFolderId] = useState(currentFolder?.id ?? "__root__");
  const [newDocumentFolderTitle, setNewDocumentFolderTitle] = useState("");
  const [newDocumentFolderParentId, setNewDocumentFolderParentId] = useState(currentFolder?.id ?? "__root__");
  const [folderTitle, setFolderTitle] = useState("");
  const [renameValue, setRenameValue] = useState(currentFolder?.title ?? "");
  const [visibilityValue, setVisibilityValue] = useState<"private" | "public">(
    (currentFolder?.visibility as "private" | "public") ?? "private",
  );
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [selectedNodeKeys, setSelectedNodeKeys] = useState<string[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [treeDropIndicator, setTreeDropIndicator] = useState<{ key: string; position: TreeDropPosition } | null>(null);
  const [documentTreeOpenMode, setDocumentTreeOpenMode] = useState<DocumentTreeOpenMode>(initialDocumentTreeOpenMode);
  const [liveTree, setLiveTree] = useState<TreeNode[]>(tree);
  const [liveCurrentChildren, setLiveCurrentChildren] = useState<FolderChildrenResult | null>(currentChildren);
  const handledEventIdsRef = useRef<Set<string>>(new Set());
  const treeMenuRef = useRef<HTMLDivElement | null>(null);
  const folderOptions = useMemo(() => flattenFolders(liveTree), [liveTree]);
  const allFolderIds = useMemo(() => collectFolderIds(liveTree), [liveTree]);

  const currentFolderId = currentFolder?.id ?? null;
  const effectiveFolderTitle = currentFolder?.title ?? "根目录";

  const openCreateDocumentDialog = () => {
    const defaultFolderId = currentFolderId ?? "__root__";
    setDocumentTitle("");
    setDocumentLocationMode("existing");
    setDocumentFolderId(defaultFolderId);
    setNewDocumentFolderTitle("");
    setNewDocumentFolderParentId(defaultFolderId);
    setShowCreateDocument(true);
  };

  const closeCreateDocumentDialog = () => {
    setShowCreateDocument(false);
    setDocumentTitle("");
    setDocumentLocationMode("existing");
    setDocumentFolderId(currentFolderId ?? "__root__");
    setNewDocumentFolderTitle("");
    setNewDocumentFolderParentId(currentFolderId ?? "__root__");
  };

  useEffect(() => {
    setLiveTree(tree);
  }, [tree]);

  useEffect(() => {
    setLiveCurrentChildren(currentChildren);
  }, [currentChildren]);

  useEffect(() => {
    return subscribeDocumentLibraryBrowserEvents((event) => {
      const docId = event.document_id || event.document?.id;
      if (!docId || event.event_type !== "document.deleted") {
        return;
      }
      setLiveTree((current) => removeTreeNode(current, docId, "document"));
      setLiveCurrentChildren((current) =>
        current ? { ...current, children: removeTreeNode(current.children, docId, "document") } : current,
      );
      setSelectedNodeKeys((current) => current.filter((key) => key !== `document:${docId}`));
    });
  }, []);

  useEffect(() => {
    if (!selectedSpace || apiUnavailable) {
      return;
    }
    const source = new EventSource("/api/events/stream", { withCredentials: true });
    const applyEvent = (payload: LibraryEvent) => {
      if (!payload.event_type || payload.space_id !== selectedSpace.id) {
        return;
      }
      if (payload.event_id) {
        if (handledEventIdsRef.current.has(payload.event_id)) {
          return;
        }
        handledEventIdsRef.current.add(payload.event_id);
        if (handledEventIdsRef.current.size > 500) {
          handledEventIdsRef.current = new Set(Array.from(handledEventIdsRef.current).slice(-250));
        }
      }
      if (payload.document) {
        const node = eventDocumentToNode(payload.document);
        setLiveTree((current) => {
          if (payload.event_type === "document.deleted" || node.isDeleted) {
            return removeTreeNode(current, node.id, "document");
          }
          return upsertTreeNode(current, node, node.parentFolderId ?? null);
        });
        setLiveCurrentChildren((current) => {
          if (!current) return current;
          return {
            ...current,
            children:
              payload.event_type === "document.deleted" || node.isDeleted
                ? removeTreeNode(current.children, node.id, "document")
                : upsertCurrentChild(current.children, node, currentFolderId),
          };
        });
        return;
      }
      if (payload.folder) {
        const node = eventFolderToNode(payload.folder);
        setLiveTree((current) => {
          if (payload.event_type === "folder.deleted" || node.isDeleted) {
            return removeTreeNode(current, node.id, "folder");
          }
          return upsertTreeNode(current, node, node.parentFolderId ?? null);
        });
        setLiveCurrentChildren((current) => {
          if (!current) return current;
          return {
            ...current,
            children:
              payload.event_type === "folder.deleted" || node.isDeleted
                ? removeTreeNode(current.children, node.id, "folder")
                : upsertCurrentChild(current.children, node, currentFolderId),
          };
        });
      }
    };
    const listener = (event: MessageEvent<string>) => {
      try {
        applyEvent(JSON.parse(event.data) as LibraryEvent);
      } catch {
        // Ignore malformed stream payloads and keep the current UI state.
      }
    };
    const eventNames = [
      "document.created",
      "document.updated",
      "document.renamed",
      "document.deleted",
      "document.restored",
      "document.moved",
      "document.reordered",
      "document.content_updated",
      "document.permission_changed",
      "folder.created",
      "folder.updated",
      "folder.renamed",
      "folder.deleted",
      "folder.moved",
      "folder.reordered",
    ];
    for (const eventName of eventNames) {
      source.addEventListener(eventName, listener);
    }
    source.onerror = () => {
      source.close();
      setNotice("实时连接已断开，当前数据可能不是最新。刷新页面可重新连接。");
    };
    source.onopen = () => {
      setNotice((current) => (current.startsWith("实时连接已断开") ? "" : current));
    };
    return () => {
      for (const eventName of eventNames) {
        source.removeEventListener(eventName, listener);
      }
      source.close();
    };
  }, [apiUnavailable, currentFolderId, selectedSpace]);

  useEffect(() => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      for (const id of allFolderIds) {
        if (!next.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [allFolderIds]);

  const handleDocumentTreeOpenModeChange = (mode: DocumentTreeOpenMode) => {
    setDocumentTreeOpenMode(mode);
    startTransition(async () => {
      try {
        setNotice("");
        await updateUserPreference({ documentTreeOpenMode: mode });
        router.refresh();
      } catch {
        setNotice("保存个人配置失败");
      }
    });
  };

  const refreshView = () => {
    router.refresh();
  };

  const closeTreeMenu = () => {
    setActiveTreeMenu(null);
  };

  const openTreeMenu = (node: TreeNode, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const baseX = event.type === "contextmenu" ? event.clientX : rect.right + 4;
    const baseY = event.type === "contextmenu" ? event.clientY : rect.top;
    const menuWidth = 210;
    const menuHeight = 360;
    const x = Math.max(8, Math.min(baseX, window.innerWidth - menuWidth - 8));
    const y = Math.max(8, Math.min(baseY, window.innerHeight - menuHeight - 8));
    setActiveTreeMenu({ node, x, y });
  };

  useEffect(() => {
    if (!activeTreeMenu) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (treeMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      closeTreeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTreeMenu();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTreeMenu]);

  const getNodeHref = (node: TreeNode) => (node.nodeType === "folder" ? `/folders/${node.id}` : `/docs/${node.id}`);

  const runTreeMenuAction = (action: () => void) => {
    closeTreeMenu();
    action();
  };

  const handleCopyNodeLink = async (node: TreeNode) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${getNodeHref(node)}`);
      setNotice("链接已复制");
    } catch {
      setNotice("复制链接失败，请检查浏览器剪贴板权限");
    }
  };

  const openTreeRenameDialog = (node: TreeNode) => {
    setTreeRenameTarget(node);
    setTreeRenameValue(node.title);
  };

  const handleTreeRename = () => {
    if (!treeRenameTarget) return;
    const target = treeRenameTarget;
    const nextTitle = treeRenameValue.trim() || (target.nodeType === "folder" ? "未命名文件夹" : "未命名文档");
    startTransition(async () => {
      try {
        setNotice("");
        if (target.nodeType === "folder") {
          await renameFolder(target.id, nextTitle, target.visibility as "private" | "public");
        } else {
          await renameDocument(target.id, nextTitle);
        }
        setLiveTree((current) => updateTreeNodeTitle(current, target.id, target.nodeType, nextTitle));
        setLiveCurrentChildren((current) =>
          current
            ? { ...current, children: updateTreeNodeTitle(current.children, target.id, target.nodeType, nextTitle) }
            : current,
        );
        setTreeRenameTarget(null);
        setTreeRenameValue("");
        refreshView();
      } catch {
        setNotice("重命名失败");
      }
    });
  };

  const handleTreeDelete = () => {
    if (!treeDeleteTarget) return;
    const target = treeDeleteTarget;
    startTransition(async () => {
      try {
        setNotice("");
        if (target.nodeType === "folder") {
          await deleteFolder(target.id);
        } else {
          await deleteDocument(target.id);
        }
        setLiveTree((current) => removeTreeNode(current, target.id, target.nodeType));
        setLiveCurrentChildren((current) =>
          current
            ? { ...current, children: removeTreeNode(current.children, target.id, target.nodeType) }
            : current,
        );
        setSelectedNodeKeys((current) => current.filter((key) => key !== `${target.nodeType}:${target.id}`));
        setTreeDeleteTarget(null);
        if (target.nodeType === "folder" && target.id === currentFolderId) {
          router.push(`/documents?space=${selectedSpace?.id ?? ""}`);
        }
        refreshView();
      } catch {
        setNotice(target.nodeType === "folder" ? "删除文件夹失败，可能文件夹非空或权限不足" : "删除文档失败");
      }
    });
  };

  const handleToggleTreeFavorite = (node: TreeNode) => {
    startTransition(async () => {
      try {
        setNotice("");
        if (node.nodeType === "document") {
          if (node.isFavorited) {
            await unfavoriteDocument(node.id);
          } else {
            await favoriteDocument(node.id);
          }
        } else if (node.isFavorited) {
          await unfavoriteFolder(node.id);
        } else {
          await favoriteFolder(node.id);
        }
        const nextFavorited = !node.isFavorited;
        setLiveTree((current) => updateTreeNodeFavorited(current, node.id, node.nodeType, nextFavorited));
        setLiveCurrentChildren((current) =>
          current
            ? { ...current, children: updateTreeNodeFavorited(current.children, node.id, node.nodeType, nextFavorited) }
            : current,
        );
        setNotice(nextFavorited ? "已收藏" : "已取消收藏");
      } catch {
        setNotice(node.isFavorited ? "取消收藏失败" : "收藏失败");
      }
    });
  };

  const handleDuplicateTreeDocument = (node: TreeNode) => {
    if (node.nodeType !== "document") return;
    startTransition(async () => {
      try {
        setNotice("");
        const document = await duplicateDocument(node.id);
        setNotice("已创建副本");
        if (document.folderId === currentFolderId) {
          refreshView();
        } else {
          refreshView();
        }
      } catch {
        setNotice("创建副本失败");
      }
    });
  };

  const openTreeDocumentShareDialog = (node: TreeNode, tab: TreeShareDialogTarget["tab"]) => {
    if (node.nodeType !== "document") {
      setNotice("文件夹分享和密级设置暂未开放");
      return;
    }
    setTreeShareDialogTarget({ node, tab });
  };

  const handleToggleTreePin = (node: TreeNode) => {
    startTransition(async () => {
      try {
        setNotice("");
        if (node.isPinned) {
          await unpinTreeNode({ nodeType: node.nodeType, nodeId: node.id });
          setLiveTree((current) => updateTreeNodePinned(current, node.id, node.nodeType, false));
          setLiveCurrentChildren((current) =>
            current ? { ...current, children: updateTreeNodePinned(current.children, node.id, node.nodeType, false) } : current,
          );
          setNotice("已取消置顶");
        } else {
          await pinTreeNode({ nodeType: node.nodeType, nodeId: node.id });
          setLiveTree((current) => updateTreeNodePinned(current, node.id, node.nodeType, true));
          setLiveCurrentChildren((current) =>
            current ? { ...current, children: updateTreeNodePinned(current.children, node.id, node.nodeType, true) } : current,
          );
          setNotice("已置顶");
        }
      } catch {
        setNotice("更新置顶状态失败");
      }
    });
  };

  const handleToggleFolder = (folderId: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleSelection = (key: string) => {
    setSelectedNodeKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const handleDropNodeIntoFolder = (targetFolderId: string | null, payload: NodeDragPayload) => {
    startTransition(async () => {
      try {
        setNotice("");
        if (payload.nodeType === "folder") {
          await moveFolder(payload.id, targetFolderId);
        } else {
          await moveDocumentToFolder(payload.id, targetFolderId);
        }
        refreshView();
      } catch {
        setNotice("移动节点失败");
      }
    });
  };

  const handleTreeReorderDrop = (
    dragged: NodeDragPayload,
    target: NodeDragPayload,
    position: Exclude<TreeDropPosition, "inside">,
  ) => {
    if (!selectedSpace) return;
    const targetNode = findTreeNode(liveTree, target.id, target.nodeType);
    if (!targetNode) return;

    const targetParentFolderId = targetNode.parentFolderId ?? null;
    const siblings = findFolderChildren(liveTree, targetParentFolderId);
    const items = buildReorderedSiblingItems(siblings, dragged, target, position);
    if (!items) return;

    const draggedNode = findTreeNode(liveTree, dragged.id, dragged.nodeType);
    const draggedParentFolderId = draggedNode?.parentFolderId ?? null;
    const needsMove = draggedParentFolderId !== targetParentFolderId;

    startTransition(async () => {
      try {
        setNotice("");
        if (needsMove) {
          if (dragged.nodeType === "folder") {
            await moveFolder(dragged.id, targetParentFolderId);
          } else {
            await moveDocumentToFolder(dragged.id, targetParentFolderId);
          }
        }
        await reorderFolderChildren({
          spaceId: selectedSpace.id,
          parentFolderId: targetParentFolderId,
          items,
        });
        refreshView();
      } catch {
        setNotice("移动或排序节点失败");
      }
    });
  };

  const handleCreateFolder = () => {
    if (!selectedSpace) return;
    startTransition(async () => {
      try {
        setNotice("");
        const folder = await createFolder({
          title: folderTitle.trim() || "未命名文件夹",
          spaceId: selectedSpace.id,
          parentFolderId: currentFolderId,
        });
        setShowCreateFolder(false);
        setFolderTitle("");
        router.push(`/folders/${folder.id}`);
        router.refresh();
      } catch {
        setNotice("创建文件夹失败");
      }
    });
  };

  const handleCreateDocument = () => {
    if (!selectedSpace) return;
    startTransition(async () => {
      try {
        setNotice("");
        let targetFolderId = documentFolderId === "__root__" ? null : documentFolderId;
        if (documentLocationMode === "new-folder") {
          const folder = await createFolder({
            title: newDocumentFolderTitle.trim() || "未命名文件夹",
            spaceId: selectedSpace.id,
            parentFolderId: newDocumentFolderParentId === "__root__" ? null : newDocumentFolderParentId,
          });
          targetFolderId = folder.id;
        }
        const document = await createDocument({
          title: documentTitle.trim() || "未命名文档",
          spaceId: selectedSpace.id,
          folderId: targetFolderId,
          documentType: "doc",
        });
        closeCreateDocumentDialog();
        router.push(`/docs/${document.id}`);
        router.refresh();
      } catch {
        setNotice("创建文档失败");
      }
    });
  };

  const handleUploadPdf = () => {
    if (!selectedSpace || !pdfFile) return;
    startTransition(async () => {
      try {
        setNotice("");
        const document = await uploadPdfDocument({
          title: pdfTitle.trim() || pdfFile.name.replace(/\.pdf$/i, ""),
          spaceId: selectedSpace.id,
          folderId: currentFolderId,
          file: pdfFile,
        });
        setShowUploadPdf(false);
        setPdfTitle("");
        setPdfFile(null);
        router.push(`/docs/${document.id}`);
        router.refresh();
      } catch {
        setNotice("上传 PDF 失败");
      }
    });
  };

  const handleRenameFolder = () => {
    if (!currentFolder) return;
    startTransition(async () => {
      try {
        setNotice("");
        await renameFolder(
          currentFolder.id,
          renameValue.trim() || "未命名文件夹",
          visibilityValue,
        );
        refreshView();
      } catch {
        setNotice("重命名文件夹失败");
      }
    });
  };

  const handleDeleteFolder = () => {
    if (!currentFolder) return;
    startTransition(async () => {
      try {
        setNotice("");
        await deleteFolder(currentFolder.id);
        setShowDeleteFolder(false);
        router.push(`/documents?space=${selectedSpace?.id ?? ""}`);
        router.refresh();
      } catch {
        setNotice("删除文件夹失败，可能文件夹非空");
      }
    });
  };

  const handleMoveNode = (targetFolderId: string) => {
    if (!showMoveDialog) return;
    const [nodeType, nodeId] = showMoveDialog.split(":", 2);
    startTransition(async () => {
      try {
        setNotice("");
        if (nodeType === "folder") {
          await moveFolder(nodeId, targetFolderId === "__root__" ? null : targetFolderId);
        } else {
          await moveDocumentToFolder(nodeId, targetFolderId === "__root__" ? null : targetFolderId);
        }
        setShowMoveDialog(null);
        refreshView();
      } catch {
        setNotice("移动节点失败");
      }
    });
  };

  const handleBulkMove = (targetFolderId: string) => {
    if (!selectedSpace || selectedNodeKeys.length === 0) return;
    const folderIds = selectedNodeKeys
      .filter((key) => key.startsWith("folder:"))
      .map((key) => key.replace("folder:", ""));
    const documentIds = selectedNodeKeys
      .filter((key) => key.startsWith("document:"))
      .map((key) => key.replace("document:", ""));
    startTransition(async () => {
      try {
        setNotice("");
        await bulkMoveNodes({
          spaceId: selectedSpace.id,
          targetFolderId: targetFolderId === "__root__" ? null : targetFolderId,
          folderIds,
          documentIds,
        });
        setSelectedNodeKeys([]);
        setShowBulkMoveDialog(false);
        refreshView();
      } catch {
        setNotice("批量移动失败");
      }
    });
  };

  const handleReorderDrop = (dragged: { id: string; nodeType: "folder" | "document" }, target: { id: string; nodeType: "folder" | "document" }) => {
    if (!selectedSpace || !liveCurrentChildren) return;
    const currentItems = [...liveCurrentChildren.children];
    const dragKey = `${dragged.nodeType}:${dragged.id}`;
    const targetKey = `${target.nodeType}:${target.id}`;
    const fromIndex = currentItems.findIndex((item) => `${item.nodeType}:${item.id}` === dragKey);
    const toIndex = currentItems.findIndex((item) => `${item.nodeType}:${item.id}` === targetKey);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const reordered = [...currentItems];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    startTransition(async () => {
      try {
        setNotice("");
        await reorderFolderChildren({
          spaceId: selectedSpace.id,
          parentFolderId: currentFolderId,
          items: reordered.map((item) => ({ id: item.id, nodeType: item.nodeType })),
        });
        refreshView();
      } catch {
        setNotice("排序失败");
      }
    });
  };

  const breadcrumbItems = ancestors ?? [];

  return (
    <div className="flex h-screen w-full gap-3 overflow-hidden px-3 py-3">
      <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden border border-slate-200 bg-white p-2.5 shadow-panel">
        <div className="shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">文档树</div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>打开</span>
            <select
              value={documentTreeOpenMode}
              onChange={(event) => handleDocumentTreeOpenModeChange(event.target.value as DocumentTreeOpenMode)}
              className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              aria-label="文档树打开文档方式"
            >
              <option value="same-page">本页</option>
              <option value="new-window">新窗口</option>
            </select>
          </label>
        </div>
        <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {spaces.map((space) => (
            <div key={space.id} className="space-y-1">
              <div
                onDragOver={(event) => {
                  if (selectedSpace?.id === space.id) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => {
                  if (selectedSpace?.id !== space.id) return;
                  event.preventDefault();
                  const payload = parseDragPayload(event.dataTransfer.getData("application/clouddoc-node"));
                  if (!payload) return;
                  handleDropNodeIntoFolder(null, payload);
                }}
              >
                <Link
                  href={`/documents?space=${space.id}`}
                  className={`block px-2 py-1 text-sm font-medium ${
                    selectedSpace?.id === space.id ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {space.name}
                </Link>
              </div>
              {selectedSpace?.id === space.id ? (
                <div className="ml-1.5 border-l border-slate-200 pl-1.5">
                  <FolderTree
                    nodes={liveTree}
                    currentFolderId={currentFolderId}
                    documentOpenMode={documentTreeOpenMode}
                    onDropNode={handleDropNodeIntoFolder}
                    onReorderNode={handleTreeReorderDrop}
                    expandedFolderIds={expandedFolderIds}
                    onToggleFolder={handleToggleFolder}
                    dropIndicator={treeDropIndicator}
                    onDropIndicatorChange={setTreeDropIndicator}
                    activeMenuKey={activeTreeMenu ? `${activeTreeMenu.node.nodeType}:${activeTreeMenu.node.id}` : null}
                    onOpenMenu={openTreeMenu}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <section className="h-full min-w-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {apiUnavailable ? <ApiUnavailableNotice /> : null}
        <div className="border border-slate-200 bg-white px-4 py-3 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <nav className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                <Link href={`/documents?space=${selectedSpace?.id ?? ""}`} className="hover:text-slate-700">
                  {selectedSpace?.name ?? "空间"}
                </Link>
                {breadcrumbItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span>/</span>
                    <Link href={`/folders/${item.id}`} className="hover:text-slate-700">
                      {item.title}
                    </Link>
                  </div>
                ))}
              </nav>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{effectiveFolderTitle}</h1>
              <p className="mt-1.5 text-sm text-slate-600">
                {currentFolder
                  ? "当前文件夹中的子文件夹和文档。"
                  : "空间根目录内容。历史文档已统一归档到 newdoc。"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowCreateFolder(true)}
                disabled={isPending || !selectedSpace}
                className="border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                新建文件夹
              </button>
              <button
                type="button"
                onClick={openCreateDocumentDialog}
                disabled={isPending || !selectedSpace}
                className="border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "处理中..." : "新建文档"}
              </button>
              <button
                type="button"
                onClick={() => setShowUploadPdf(true)}
                disabled={isPending || !selectedSpace}
                className="border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                上传 PDF
              </button>
              <button
                type="button"
                onClick={() => setShowBulkMoveDialog(true)}
                disabled={isPending || selectedNodeKeys.length === 0}
                className="border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                批量移动
              </button>
            </div>
          </div>

          {currentFolder?.canManage ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                className="min-w-[240px] border border-slate-200 bg-white px-3 py-1.5 text-sm"
              />
              <select
                value={visibilityValue}
                onChange={(event) => setVisibilityValue(event.target.value as "private" | "public")}
                className="border border-slate-200 bg-white px-3 py-1.5 text-sm"
              >
                <option value="private">私有</option>
                <option value="public">公开</option>
              </select>
              <button
                type="button"
                onClick={handleRenameFolder}
                disabled={isPending}
                className="border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                重命名
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteFolder(true)}
                disabled={isPending}
                className="border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-600"
              >
                删除空文件夹
              </button>
            </div>
          ) : null}

          {notice ? <div className="mt-4 text-sm text-rose-500">{notice}</div> : null}
        </div>

        <div className="border border-slate-200 bg-white px-4 py-3 shadow-panel">
          <div className="mb-2 text-lg font-semibold">当前目录内容</div>
          <div className="space-y-1.5">
            {(liveCurrentChildren?.children ?? []).length > 0 ? (
              liveCurrentChildren!.children.map((node) => (
                <div
                  key={`${node.nodeType}-${node.id}`}
                  className="flex items-center justify-between border border-slate-200 px-3 py-2"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/clouddoc-node",
                      JSON.stringify({ id: node.id, nodeType: node.nodeType }),
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const payload = parseDragPayload(event.dataTransfer.getData("application/clouddoc-node"));
                    if (!payload) return;
                    handleReorderDrop(payload, { id: node.id, nodeType: node.nodeType });
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedNodeKeys.includes(`${node.nodeType}:${node.id}`)}
                      onChange={() => toggleSelection(`${node.nodeType}:${node.id}`)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <div className="min-w-0">
                      <Link
                        href={node.nodeType === "folder" ? `/folders/${node.id}` : `/docs/${node.id}`}
                        draggable={false}
                        onClick={(event) => event.stopPropagation()}
                        className="block truncate text-sm font-medium text-slate-900 hover:text-accent"
                      >
                        {node.nodeType === "folder" ? "📁 " : "📄 "}
                        {node.title}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">
                        {node.nodeType === "folder" ? "文件夹" : node.documentType || "文档"} · {node.updatedAt}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMoveDialog(`${node.nodeType}:${node.id}`)}
                      className="border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                    >
                      移动
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">当前目录为空。</div>
            )}
          </div>
        </div>
      </section>

      {activeTreeMenu ? (
        <div
          ref={treeMenuRef}
          className="fixed z-[140] w-[210px] border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-[0_16px_36px_rgba(15,23,42,0.16)]"
          style={{ left: activeTreeMenu.x, top: activeTreeMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100"
            onClick={() => runTreeMenuAction(() => window.open(getNodeHref(activeTreeMenu.node), "_blank", "noopener,noreferrer"))}
          >
            <span className="w-4 text-slate-400">↗</span>
            <span>在新标签页打开</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100"
            onClick={() => runTreeMenuAction(() => void handleCopyNodeLink(activeTreeMenu.node))}
          >
            <span className="w-4 text-slate-400">🔗</span>
            <span>复制链接</span>
          </button>
          {activeTreeMenu.node.nodeType === "document" ? (
            <button
              type="button"
              disabled={!activeTreeMenu.node.canManage}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
              onClick={() => runTreeMenuAction(() => openTreeDocumentShareDialog(activeTreeMenu.node, "share"))}
              title={activeTreeMenu.node.canManage ? undefined : "你没有分享该文档的权限"}
            >
              <span className="w-4 text-slate-400">↗</span>
              <span>分享</span>
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100"
            onClick={() => runTreeMenuAction(() => handleToggleTreeFavorite(activeTreeMenu.node))}
          >
            <span className="w-4 text-slate-400">{activeTreeMenu.node.isFavorited ? "★" : "☆"}</span>
            <span>{activeTreeMenu.node.isFavorited ? "取消收藏" : "收藏"}</span>
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            disabled={!activeTreeMenu.node.canManage}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
            onClick={() => runTreeMenuAction(() => setShowMoveDialog(`${activeTreeMenu.node.nodeType}:${activeTreeMenu.node.id}`))}
            title={activeTreeMenu.node.canManage ? undefined : "你没有移动该节点的权限"}
          >
            <span className="w-4 text-slate-400">↪</span>
            <span>移动到</span>
          </button>
          <button
            type="button"
            disabled={!activeTreeMenu.node.canManage}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
            onClick={() => runTreeMenuAction(() => openTreeRenameDialog(activeTreeMenu.node))}
            title={activeTreeMenu.node.canManage ? undefined : "你没有重命名该节点的权限"}
          >
            <span className="w-4 text-slate-400">✎</span>
            <span>重命名</span>
          </button>
          {activeTreeMenu.node.nodeType === "document" ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100"
              onClick={() => runTreeMenuAction(() => handleDuplicateTreeDocument(activeTreeMenu.node))}
            >
              <span className="w-4 text-slate-400">⧉</span>
              <span>创建副本</span>
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100"
            onClick={() => runTreeMenuAction(() => handleToggleTreePin(activeTreeMenu.node))}
          >
            <span className="w-4 text-slate-400">{activeTreeMenu.node.isPinned ? "⌄" : "⌃"}</span>
            <span>{activeTreeMenu.node.isPinned ? "取消置顶" : "添加到置顶"}</span>
          </button>
          {activeTreeMenu.node.nodeType === "document" ? (
            <>
              <button
                type="button"
                disabled={!activeTreeMenu.node.canManage}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
                onClick={() => runTreeMenuAction(() => openTreeDocumentShareDialog(activeTreeMenu.node, "members"))}
                title={activeTreeMenu.node.canManage ? undefined : "你没有转移所有权的权限"}
              >
                <span className="w-4 text-slate-400">⇄</span>
                <span>转移所有权</span>
              </button>
              <button
                type="button"
                disabled={!activeTreeMenu.node.canManage}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
                onClick={() => runTreeMenuAction(() => openTreeDocumentShareDialog(activeTreeMenu.node, "security"))}
                title={activeTreeMenu.node.canManage ? undefined : "你没有设置密级的权限"}
              >
                <span className="w-4 text-slate-400">⚙</span>
                <span>设置密级</span>
              </button>
            </>
          ) : null}
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            disabled={
              !activeTreeMenu.node.canManage ||
              (activeTreeMenu.node.nodeType === "folder" && activeTreeMenu.node.children.length > 0)
            }
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
            onClick={() => runTreeMenuAction(() => setTreeDeleteTarget(activeTreeMenu.node))}
            title={
              !activeTreeMenu.node.canManage
                ? "你没有删除该节点的权限"
                : activeTreeMenu.node.nodeType === "folder" && activeTreeMenu.node.children.length > 0
                  ? "非空文件夹暂不支持删除"
                  : undefined
            }
          >
            <span className="w-4">⌫</span>
            <span>删除</span>
          </button>
        </div>
      ) : null}

      {treeShareDialogTarget ? (
        <DocumentShareDialog
          open={Boolean(treeShareDialogTarget)}
          documentId={treeShareDialogTarget.node.id}
          currentVisibility={treeShareDialogTarget.node.visibility === "public" ? "public" : "private"}
          canTransferOwner={treeShareDialogTarget.node.canManage}
          initialTab={treeShareDialogTarget.tab}
          mentionCandidates={mentionCandidates}
          onClose={() => setTreeShareDialogTarget(null)}
          onSaved={({ visibility }) => {
            setLiveTree((current) =>
              updateTreeNodeVisibility(current, treeShareDialogTarget.node.id, "document", visibility),
            );
            setLiveCurrentChildren((current) =>
              current
                ? {
                    ...current,
                    children: updateTreeNodeVisibility(current.children, treeShareDialogTarget.node.id, "document", visibility),
                  }
                : current,
            );
          }}
        />
      ) : null}

      {showCreateDocument ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={closeCreateDocumentDialog} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">新建文档</div>
                <div className="mt-1 text-sm text-slate-500">确认文档创建位置，默认使用当前目录。</div>
              </div>
              <button
                type="button"
                onClick={closeCreateDocumentDialog}
                disabled={isPending}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60"
              >
                关闭
              </button>
            </div>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              文档标题
              <input
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                placeholder="未命名文档"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="mt-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="document-location-mode"
                  checked={documentLocationMode === "existing"}
                  onChange={() => setDocumentLocationMode("existing")}
                  className="h-4 w-4 border-slate-300 text-accent"
                />
                选择已有位置
              </label>
              {documentLocationMode === "existing" ? (
                <select
                  value={documentFolderId}
                  onChange={(event) => setDocumentFolderId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  aria-label="选择文档创建位置"
                >
                  <option value="__root__">{selectedSpace?.name ?? "空间"} / 根目录</option>
                  {folderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="document-location-mode"
                  checked={documentLocationMode === "new-folder"}
                  onChange={() => setDocumentLocationMode("new-folder")}
                  className="h-4 w-4 border-slate-300 text-accent"
                />
                新建文件夹后创建
              </label>
              {documentLocationMode === "new-folder" ? (
                <div className="grid gap-3">
                  <input
                    value={newDocumentFolderTitle}
                    onChange={(event) => setNewDocumentFolderTitle(event.target.value)}
                    placeholder="新文件夹名称"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <select
                    value={newDocumentFolderParentId}
                    onChange={(event) => setNewDocumentFolderParentId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    aria-label="选择新文件夹父级位置"
                  >
                    <option value="__root__">{selectedSpace?.name ?? "空间"} / 根目录</option>
                    {folderOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-slate-500">
                    文档会创建在这个新文件夹中。
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateDocumentDialog}
                disabled={isPending}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateDocument}
                disabled={isPending}
                className="rounded-lg bg-accent px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "创建中..." : "确认创建"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateFolder ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="absolute inset-0" onClick={() => setShowCreateFolder(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
            <div className="text-lg font-semibold">新建文件夹</div>
            <input
              value={folderTitle}
              onChange={(event) => setFolderTitle(event.target.value)}
              placeholder="文件夹名称"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreateFolder(false)} disabled={isPending} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-60">
                取消
              </button>
              <button type="button" onClick={handleCreateFolder} disabled={isPending} className="rounded-lg bg-accent px-3 py-2 text-sm text-white disabled:opacity-60">
                {isPending ? "创建中..." : "创建"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showUploadPdf ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="absolute inset-0" onClick={() => setShowUploadPdf(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
            <div className="text-lg font-semibold">上传 PDF</div>
            <input
              value={pdfTitle}
              onChange={(event) => setPdfTitle(event.target.value)}
              placeholder="PDF 标题，可留空"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowUploadPdf(false)} disabled={isPending} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-60">
                取消
              </button>
              <button type="button" onClick={handleUploadPdf} className="rounded-lg bg-accent px-3 py-2 text-sm text-white disabled:opacity-60" disabled={isPending || !pdfFile}>
                {isPending ? "上传中..." : "上传"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {treeRenameTarget ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setTreeRenameTarget(null)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
            <div className="text-lg font-semibold">
              重命名{treeRenameTarget.nodeType === "folder" ? "文件夹" : "文档"}
            </div>
            <input
              value={treeRenameValue}
              onChange={(event) => setTreeRenameValue(event.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTreeRenameTarget(null)}
                disabled={isPending}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleTreeRename}
                disabled={isPending}
                className="rounded-lg bg-accent px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {isPending ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showMoveDialog ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="absolute inset-0" onClick={() => setShowMoveDialog(null)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
            <div className="text-lg font-semibold">移动文档</div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => handleMoveNode("__root__")}
                disabled={isPending}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                根目录
              </button>
              {folderOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleMoveNode(option.id)}
                  disabled={isPending}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showBulkMoveDialog ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="absolute inset-0" onClick={() => setShowBulkMoveDialog(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
            <div className="text-lg font-semibold">批量移动</div>
            <div className="mt-2 text-sm text-slate-500">已选择 {selectedNodeKeys.length} 项</div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => handleBulkMove("__root__")}
                disabled={isPending}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                根目录
              </button>
              {folderOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleBulkMove(option.id)}
                  disabled={isPending}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={showDeleteFolder}
        title="确认删除文件夹"
        description="只有空文件夹可以删除。确认后会删除当前文件夹。"
        confirmLabel="确认删除"
        cancelLabel="取消"
        onCancel={() => setShowDeleteFolder(false)}
        onConfirm={handleDeleteFolder}
        pending={isPending}
      />
      <ConfirmDialog
        open={Boolean(treeDeleteTarget)}
        title={`确认删除${treeDeleteTarget?.nodeType === "folder" ? "文件夹" : "文档"}`}
        description={
          treeDeleteTarget?.nodeType === "folder"
            ? "只有空文件夹可以删除。确认后该文件夹会从目录树移除。"
            : "确认后该文档会移入回收站，其他页面会通过事件同步移除。"
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        danger
        onCancel={() => setTreeDeleteTarget(null)}
        onConfirm={handleTreeDelete}
        pending={isPending}
      />
    </div>
  );
}
