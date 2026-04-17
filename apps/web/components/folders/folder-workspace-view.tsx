"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  createDocument,
  createFolder,
  bulkMoveNodes,
  deleteFolder,
  moveDocumentToFolder,
  moveFolder,
  reorderFolderChildren,
  renameFolder,
  type AncestorItem,
  type DocumentTreeOpenMode,
  type FolderChildrenResult,
  type FolderSummary,
  type SpaceSummary,
  type TreeNode,
  updateUserPreference,
  uploadPdfDocument,
} from "@/lib/api";

type NodeDragPayload = { id: string; nodeType: "folder" | "document" };
type TreeDropPosition = "before" | "inside" | "after";
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
  return [...nodes].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title) || a.nodeType.localeCompare(b.nodeType));
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
}) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <div key={`${node.nodeType}-${node.id}`} className="space-y-1">
          <div
            className={`relative rounded-lg ${
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
            <Link
              href={href}
              target={shouldOpenNewWindow ? "_blank" : undefined}
              rel={shouldOpenNewWindow ? "noreferrer" : undefined}
              className={`grid grid-cols-[18px_20px_minmax(0,1fr)] items-center gap-1 rounded-lg px-2 py-1.5 text-sm leading-5 transition hover:bg-slate-100 ${
                node.nodeType === "folder" && node.id === currentFolderId
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
                  className="inline-flex h-[18px] w-[18px] items-center justify-center rounded text-[11px] leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={expandedFolderIds.has(node.id) ? "折叠文件夹" : "展开文件夹"}
                >
                  {expandedFolderIds.has(node.id) ? "▾" : "▸"}
                </button>
              ) : (
                <span className="block h-[18px] w-[18px]" />
              )}
              <span className="flex h-5 w-5 items-center justify-center text-[15px] text-slate-400">
                {node.nodeType === "folder" ? "📁" : "📄"}
              </span>
              <span className="truncate pl-0.5">{node.title}</span>
            </Link>
            {dropIndicator?.key === `${node.nodeType}:${node.id}` && dropIndicator.position === "after" ? (
              <div className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-blue-400" />
            ) : null}
                </>
              );
            })()}
          </div>
          {node.children.length > 0 && (node.nodeType !== "folder" || expandedFolderIds.has(node.id)) ? (
            <div className="ml-[21px] border-l border-slate-200 pl-[9px]">
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
}: {
  spaces: SpaceSummary[];
  selectedSpace: SpaceSummary | null;
  tree: TreeNode[];
  currentChildren: FolderChildrenResult | null;
  currentFolder?: FolderSummary | null;
  ancestors?: AncestorItem[];
  apiUnavailable?: boolean;
  initialDocumentTreeOpenMode?: DocumentTreeOpenMode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadPdf, setShowUploadPdf] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState<string | null>(null);
  const [showDeleteFolder, setShowDeleteFolder] = useState(false);
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
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
  const folderOptions = useMemo(() => flattenFolders(liveTree), [liveTree]);
  const allFolderIds = useMemo(() => collectFolderIds(liveTree), [liveTree]);

  const currentFolderId = currentFolder?.id ?? null;
  const effectiveFolderTitle = currentFolder?.title ?? "根目录";

  useEffect(() => {
    setLiveTree(tree);
  }, [tree]);

  useEffect(() => {
    setLiveCurrentChildren(currentChildren);
  }, [currentChildren]);

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
        const document = await createDocument({
          title: "未命名文档",
          spaceId: selectedSpace.id,
          folderId: currentFolderId,
          documentType: "doc",
        });
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
    <div className="flex w-full gap-4 px-4 py-5">
      <aside className="w-[340px] shrink-0 rounded-3xl bg-white p-4 shadow-panel">
        <div className="flex items-center justify-between gap-3">
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
        <div className="mt-3 space-y-4">
              {spaces.map((space) => (
            <div key={space.id} className="space-y-2">
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
                  className={`block rounded-lg px-2.5 py-2 text-sm font-medium ${
                    selectedSpace?.id === space.id ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {space.name}
                </Link>
              </div>
              {selectedSpace?.id === space.id ? (
                <div className="ml-2 border-l border-slate-200 pl-2">
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
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 flex-1 space-y-4">
        {apiUnavailable ? <ApiUnavailableNotice /> : null}
        <div className="rounded-3xl bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
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
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">{effectiveFolderTitle}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {currentFolder
                  ? "当前文件夹中的子文件夹和文档。"
                  : "空间根目录内容。历史文档已统一归档到 newdoc。"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateFolder(true)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                新建文件夹
              </button>
              <button
                type="button"
                onClick={handleCreateDocument}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                新建文档
              </button>
              <button
                type="button"
                onClick={() => setShowUploadPdf(true)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                上传 PDF
              </button>
              <button
                type="button"
                onClick={() => setShowBulkMoveDialog(true)}
                disabled={selectedNodeKeys.length === 0}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                批量移动
              </button>
            </div>
          </div>

          {currentFolder?.canManage ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                className="min-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <select
                value={visibilityValue}
                onChange={(event) => setVisibilityValue(event.target.value as "private" | "public")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="private">私有</option>
                <option value="public">公开</option>
              </select>
              <button
                type="button"
                onClick={handleRenameFolder}
                disabled={isPending}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                重命名
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteFolder(true)}
                disabled={isPending}
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-600"
              >
                删除空文件夹
              </button>
            </div>
          ) : null}

          {notice ? <div className="mt-4 text-sm text-rose-500">{notice}</div> : null}
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-panel">
          <div className="mb-3 text-lg font-semibold">当前目录内容</div>
          <div className="space-y-2">
            {(liveCurrentChildren?.children ?? []).length > 0 ? (
              liveCurrentChildren!.children.map((node) => (
                <div
                  key={`${node.nodeType}-${node.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
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
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
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
              <button type="button" onClick={() => setShowCreateFolder(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                取消
              </button>
              <button type="button" onClick={handleCreateFolder} className="rounded-lg bg-accent px-3 py-2 text-sm text-white">
                创建
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
              <button type="button" onClick={() => setShowUploadPdf(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                取消
              </button>
              <button type="button" onClick={handleUploadPdf} className="rounded-lg bg-accent px-3 py-2 text-sm text-white" disabled={!pdfFile}>
                上传
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
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                根目录
              </button>
              {folderOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleMoveNode(option.id)}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
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
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                根目录
              </button>
              {folderOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleBulkMove(option.id)}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
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
      />
    </div>
  );
}
