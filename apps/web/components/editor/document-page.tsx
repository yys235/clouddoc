"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DocumentViewModel } from "@/lib/mock-document";
import { BlockEditor, EditableBlock } from "@/components/editor/block-editor";
import { CommentSidebar } from "@/components/editor/comment-sidebar";
import { DocumentShareDialog } from "@/components/editor/document-share-dialog";
import {
  type AncestorItem,
  createCommentThread,
  deleteComment,
  fetchCommentThreads,
  fetchCurrentUser,
  favoriteDocument,
  fetchLinkPreview,
  type CommentAnchor,
  type CommentThread,
  type OrganizationMember,
  type ShareLinkSettings,
  replyCommentThread,
  softDeleteDocument,
  unfavoriteDocument,
  updateCommentThreadStatus,
  uploadImageAsset,
  updateDocumentContent,
} from "@/lib/api";

function EyeIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 ${active ? "text-sky-600" : "text-slate-500"}`}
    >
      <path
        d="M1.9 10c1.86-3.1 4.56-4.65 8.1-4.65s6.24 1.55 8.1 4.65c-1.86 3.1-4.56 4.65-8.1 4.65S3.76 13.1 1.9 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.35" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PencilIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 ${active ? "text-sky-600" : "text-slate-500"}`}
    >
      <path
        d="M3.2 13.85V16.8h2.95L15 7.95 12.05 5 3.2 13.85Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.95 6.1 13.9 9.05"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.95 5.1 13.35 3.7a1.48 1.48 0 0 1 2.1 0l.85.85a1.48 1.48 0 0 1 0 2.1l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4 text-sky-600">
      <path
        d="M4.5 10.2 8.1 13.8 15.7 6.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 text-slate-500 transition duration-200 ${open ? "rotate-180" : "rotate-0"}`}
    >
      <path
        d="M5.5 7.8 10 12.3l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PdfPreview({
  fileUrl,
  fileName,
  fileSize,
}: {
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
        <div className="font-medium text-slate-800">{fileName || "PDF 文件"}</div>
        {fileSize ? (
          <div className="mt-1 text-xs text-slate-400">
            {(fileSize / 1024 / 1024).toFixed(2)} MB
          </div>
        ) : null}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
        <div>当前 PDF 采用浏览器原生阅读器打开，不在页面内嵌预览。</div>
        {fileUrl ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              新标签打开 PDF
            </a>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
            >
              打开原始文件
            </a>
          </div>
        ) : (
          <div className="mt-3">当前 PDF 未找到可打开文件。</div>
        )}
      </div>
    </div>
  );
}

function flattenText(nodes: { text?: string; content?: { text?: string }[] }[] | undefined) {
  return (
    nodes
      ?.map((node) => {
        if (typeof node.text === "string") {
          return node.text;
        }
        return node.content?.map((child) => child.text ?? "").join("") ?? "";
      })
      .join("")
      .trim() ?? ""
  );
}

function nodeText(nodes: { text?: string; content?: { text?: string }[] }[] | undefined) {
  return (
    nodes
      ?.map((node) => {
        if (typeof node.text === "string") {
          return node.text;
        }
        return node.content?.map((child) => child.text ?? "").join("") ?? "";
      })
      .join("")
      .trim() ?? ""
  );
}

function blockId() {
  return crypto.randomUUID();
}

function blockHasMeaningfulContent(block: EditableBlock) {
  if (block.type === "divider") {
    return true;
  }

  if (block.type === "link") {
    return Boolean(block.meta?.href?.trim() || block.text.trim());
  }

  if (block.type === "image") {
    return Boolean(block.text.trim());
  }

  return Boolean(block.text.trim());
}

function documentModeStorageKey(docId: string) {
  return `clouddoc:document-mode:${docId}`;
}

function normalizeExternalHref(rawHref: string) {
  const href = rawHref.trim();
  if (!href) {
    return "";
  }

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(href)) {
    return `https://${href}`;
  }

  return "";
}

function sanitizeHeadingLevel(level: number | undefined) {
  const value = Number(level ?? 1);
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(6, Math.trunc(value)));
}


type LinkCardView = "link" | "title" | "card" | "preview";

type LinkCardMeta = {
  href?: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  icon?: string;
  view?: LinkCardView;
  status?: "idle" | "loading" | "ready" | "error";
};

function parseLinkSource(text: string) {
  const parts = text.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      title: parts[0],
      href: normalizeExternalHref(parts[1]),
    };
  }

  const value = text.trim();
  const normalizedHref = normalizeExternalHref(value);
  return {
    title: normalizedHref ? "" : value,
    href: normalizedHref,
  };
}

function composeLinkSource(meta: LinkCardMeta | undefined, fallbackText: string) {
  const href = meta?.href?.trim() ?? "";
  const title = meta?.title?.trim() ?? "";
  if (title && href && title !== href) {
    return `${title} | ${href}`;
  }
  if (href) {
    return href;
  }
  return fallbackText.trim();
}

function inferSiteNameFromHref(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

function emptyTextNode() {
  return [{ type: "text", text: "" }];
}

function rawTextFromNode(node: { attrs?: Record<string, unknown>; content?: { text?: string; content?: { text?: string }[] }[] }) {
  const rawText = node.attrs?.raw_text;
  if (typeof rawText === "string") {
    return rawText;
  }
  return flattenText(node.content);
}

function blocksFromDocument(document: DocumentViewModel): EditableBlock[] {
  const blocks: EditableBlock[] = document.content.slice(1).map((node, index): EditableBlock => {
    const persistedBlockId = String(node.attrs?.block_id ?? "");
    const fallbackId = (suffix: string) => persistedBlockId || `${document.id}-${suffix}-${index}`;
    if (node.type === "heading") {
      const level = sanitizeHeadingLevel(Number(node.attrs?.level ?? 2));
      return {
        id: fallbackId("heading"),
        type: "heading" as const,
        headingLevel: level,
        text: flattenText(node.content),
      };
    }

    if (node.type === "bullet_list") {
      return {
        id: fallbackId("list"),
        type: "bullet_list" as const,
        text:
          node.content
            ?.map((item) => flattenText(item.content))
            .filter(Boolean)
            .join("\n") ?? "",
      };
    }

    if (node.type === "ordered_list") {
      return {
        id: fallbackId("ordered-list"),
        type: "ordered_list" as const,
        text:
          node.content
            ?.map((item) => flattenText(item.content))
            .filter(Boolean)
            .join("\n") ?? "",
      };
    }

    if (node.type === "check_list") {
      return {
        id: fallbackId("check"),
        type: "check_list" as const,
        text:
          node.content
            ?.map((item) => {
              const checked = Boolean(item.attrs?.checked);
              const value = flattenText(item.content);
              if (!value.trim()) {
                return "";
              }
              return `${checked ? "[x]" : "[ ]"} ${value}`.trim();
            })
            .filter((line) => line !== undefined)
            .join("\n") ?? "",
      };
    }

    if (node.type === "blockquote") {
      return {
        id: fallbackId("quote"),
        type: "quote" as const,
        text: rawTextFromNode(node),
      };
    }

    if (node.type === "horizontal_rule") {
      return {
        id: fallbackId("divider"),
        type: "divider" as const,
        text: "",
      };
    }

    if (node.type === "link_card") {
      const title = String(node.attrs?.title ?? "").trim();
      const href = String(node.attrs?.href ?? "").trim();
      if (!normalizeExternalHref(href)) {
        return {
          id: fallbackId("paragraph"),
          type: "paragraph" as const,
          text: title,
        };
      }
      const description = String(node.attrs?.description ?? "").trim();
      const siteName = String(node.attrs?.site_name ?? "").trim();
      const image = String(node.attrs?.image ?? "").trim();
      const icon = String(node.attrs?.icon ?? "").trim();
      const view = String(node.attrs?.view ?? "link").trim() as LinkCardView;
      const status = String(node.attrs?.status ?? "ready").trim() as LinkCardMeta["status"];
      const meta: LinkCardMeta = {
        href,
        title: title || undefined,
        description: description || undefined,
        siteName: siteName || undefined,
        image: image || undefined,
        icon: icon || undefined,
        view,
        status,
      };
      return {
        id: fallbackId("link"),
        type: "link" as const,
        text: composeLinkSource(meta, title || href),
        meta,
      };
    }

    if (node.type === "image_block") {
      const alt = String(node.attrs?.alt ?? "").trim();
      const src = String(node.attrs?.src ?? "").trim();
      const align = String(node.attrs?.align ?? "center").trim();
      const imageAlign: EditableBlock["imageAlign"] = align === "left" || align === "right" ? align : "center";
      return {
        id: fallbackId("image"),
        type: "image" as const,
        text: alt && src ? `${alt} | ${src}` : alt || src,
        imageAlign,
      };
    }

    if (node.type === "code_block") {
      return {
        id: fallbackId("code"),
        type: "code_block" as const,
        text: node.content?.[0]?.text ?? "",
      };
    }

    return {
      id: fallbackId("paragraph"),
      type: "paragraph" as const,
      text: rawTextFromNode(node),
    };
  });

  return blocks.length > 0 ? blocks : [{ id: blockId(), type: "paragraph", text: "" }];
}

function contentFromBlocks(title: string, blocks: EditableBlock[]) {
  const contentNodes: Array<Record<string, unknown>> = [
    {
      type: "heading",
      attrs: { level: 1, anchor: "intro" },
      content: [{ type: "text", text: title || "未命名文档" }],
    },
  ];

  for (const block of blocks) {
    const text = block.text.trim();
    const rawText = block.text;

    if (block.type === "heading") {
      const level = sanitizeHeadingLevel(block.headingLevel ?? 2);
      if (!text) {
        contentNodes.push({
          type: "heading",
          attrs: {
            level,
            anchor: `empty-heading-${block.id}`,
            block_id: block.id,
            preservedEmpty: true,
          },
          content: emptyTextNode(),
        });
        continue;
      }

      contentNodes.push({
        type: "heading",
        attrs: {
          level,
          block_id: block.id,
          anchor: block.id,
        },
        content: [{ type: "text", text }],
      });
      continue;
    }

    if (block.type === "bullet_list") {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        contentNodes.push({
          type: "bullet_list",
          attrs: { preservedEmpty: true, block_id: block.id },
          content: [
            {
              type: "list_item",
              content: emptyTextNode(),
            },
          ],
        });
        continue;
      }

      contentNodes.push({
        type: "bullet_list",
        attrs: { block_id: block.id },
        content: lines.map((line) => ({
          type: "list_item",
          content: [{ type: "text", text: line.replace(/^- /, "").trim() }],
        })),
      });
      continue;
    }

    if (block.type === "ordered_list") {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        contentNodes.push({
          type: "ordered_list",
          attrs: { preservedEmpty: true, block_id: block.id },
          content: [
            {
              type: "list_item",
              content: emptyTextNode(),
            },
          ],
        });
        continue;
      }

      contentNodes.push({
        type: "ordered_list",
        attrs: { block_id: block.id },
        content: lines.map((line) => ({
          type: "list_item",
          content: [{ type: "text", text: line.replace(/^\d+[.)]\s*/, "").trim() }],
        })),
      });
      continue;
    }

    if (block.type === "check_list") {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      contentNodes.push({
        type: "check_list",
        attrs: lines.length === 0 ? { preservedEmpty: true, block_id: block.id } : { block_id: block.id },
        content:
          lines.length > 0
            ? lines.map((line) => {
                const checked = /^\[(x|X)\]/.test(line);
                return {
                  type: "check_item",
                  attrs: { checked },
                  content: [
                    {
                      type: "text",
                      text: line.replace(/^\[(x|X| )\]\s*/, "").trim(),
                    },
                  ],
                };
              })
            : [
                {
                  type: "check_item",
                  attrs: { checked: false },
                  content: [{ type: "text", text: "" }],
                },
              ],
      });
      continue;
    }

    if (block.type === "quote") {
      if (!text) {
        contentNodes.push({
          type: "blockquote",
          attrs: { preservedEmpty: true, raw_text: rawText, block_id: block.id },
          content: emptyTextNode(),
        });
        continue;
      }

      contentNodes.push({
        type: "blockquote",
        attrs: rawText.includes("\n") ? { raw_text: rawText, block_id: block.id } : { block_id: block.id },
        content: [{ type: "text", text: text.replace(/\n/g, " ") }],
      });
      continue;
    }

    if (block.type === "divider") {
      contentNodes.push({
        type: "horizontal_rule",
        attrs: { block_id: block.id },
      });
      continue;
    }

    if (block.type === "link") {
      const parsed = parseLinkSource(text);
      const meta = block.meta ?? {};
      const normalizedHref = meta.href?.trim() || parsed.href || "";
      const resolvedTitle = meta.title?.trim() || parsed.title || normalizedHref || "未命名链接";
      contentNodes.push({
        type: "link_card",
        attrs: {
          block_id: block.id,
          title: resolvedTitle,
          href: normalizedHref,
          description: meta.description?.trim() || "",
          site_name: meta.siteName?.trim() || (normalizedHref ? inferSiteNameFromHref(normalizedHref) : ""),
          image: meta.image?.trim() || "",
          icon: meta.icon?.trim() || "",
          view: meta.view || "link",
          status: meta.status || (normalizedHref ? "ready" : "idle"),
          preservedEmpty: !text && !normalizedHref,
        },
      });
      continue;
    }

    if (block.type === "image") {
      const [altPart, srcPart] = text.split("|").map((part) => part.trim());
      contentNodes.push({
        type: "image_block",
        attrs: {
          block_id: block.id,
          alt: altPart || "图片",
          src: srcPart || altPart || "",
          align: block.imageAlign || "center",
          preservedEmpty: !text,
        },
      });
      continue;
    }

    if (block.type === "code_block") {
      if (!text) {
        contentNodes.push({
          type: "code_block",
          attrs: { language: "plain", preservedEmpty: true, block_id: block.id },
          content: emptyTextNode(),
        });
        continue;
      }

      contentNodes.push({
        type: "code_block",
        attrs: { language: "plain", block_id: block.id },
        content: [{ type: "text", text }],
      });
      continue;
    }

    if (!text) {
      contentNodes.push({
        type: "paragraph",
        attrs: { preservedEmpty: true, raw_text: rawText, block_id: block.id },
        content: emptyTextNode(),
      });
      continue;
    }

    contentNodes.push({
      type: "paragraph",
      attrs: rawText.includes("\n") ? { raw_text: rawText, block_id: block.id } : { block_id: block.id },
      content: [{ type: "text", text: text.replace(/\n/g, " ") }],
    });
  }

  if (contentNodes.length === 1) {
    contentNodes.push({
      type: "paragraph",
      content: [{ type: "text", text: "Start writing here..." }],
    });
  }

  return {
    type: "doc",
    version: 1,
    content: contentNodes,
  };
}

type DraftHistorySnapshot = {
  title: string;
  blocks: EditableBlock[];
};

type DraftHistoryState = {
  past: DraftHistorySnapshot[];
  future: DraftHistorySnapshot[];
};

const DRAFT_HISTORY_LIMIT = 100;

function cloneDraftBlocks(blocks: EditableBlock[]) {
  return blocks.map((block) => ({
    ...block,
    meta: block.meta ? { ...block.meta } : undefined,
  }));
}

function draftHistorySignature(snapshot: DraftHistorySnapshot) {
  return JSON.stringify({
    title: snapshot.title,
    blocks: snapshot.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      text: block.text,
      headingLevel: block.headingLevel ?? null,
      imageAlign: block.imageAlign ?? null,
      meta: block.meta ?? null,
    })),
  });
}

export function DocumentPage({
  document,
  mentionCandidates,
  initialActiveThreadId,
  shareSettings,
  breadcrumbs,
  spaceName,
}: {
  document: DocumentViewModel;
  mentionCandidates: OrganizationMember[];
  initialActiveThreadId?: string | null;
  shareSettings?: ShareLinkSettings | null;
  breadcrumbs?: AncestorItem[];
  spaceName?: string;
}) {
  const router = useRouter();
  const [currentDocument, setCurrentDocument] = useState(document);
  const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [commentsUnavailable, setCommentsUnavailable] = useState(false);
  const [pendingCommentAnchor, setPendingCommentAnchor] = useState<CommentAnchor | null>(null);
  const [activeCommentThreadId, setActiveCommentThreadId] = useState<string | null>(initialActiveThreadId ?? null);
  const [hoveredCommentThreadId, setHoveredCommentThreadId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [modeLoadedForDocId, setModeLoadedForDocId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [currentShareSettings, setCurrentShareSettings] = useState<ShareLinkSettings | null>(shareSettings ?? null);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const modeMenuHideTimerRef = useRef<number | null>(null);
  const [isMutating, startTransition] = useTransition();
  const [draftTitle, setDraftTitle] = useState(document.title);
  const [draftBlocks, setDraftBlocks] = useState(() => blocksFromDocument(document));
  const [draftHistory, setDraftHistory] = useState<DraftHistoryState>({ past: [], future: [] });
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isPdfDocument = currentDocument.documentType === "pdf";
  const canManageDocument = currentDocument.canManage && !currentDocument.isSharedView;
  const canOpenShareDialog = canManageDocument && currentDocument.canShare && !currentDocument.isSharedView;
  const canDeleteDocument = currentDocument.canDelete && !currentDocument.isSharedView;
  const canEditDocument = currentDocument.canEdit && !currentDocument.isSharedView && !isPdfDocument;
  const canCommentDocument = currentDocument.canComment && !currentDocument.isSharedView;
  const showCommentSidebar = !isPdfDocument && !currentDocument.isSharedView;

  const modeOptions = [
    {
      value: "edit" as const,
      label: "编辑",
      description: "可编辑文档",
      icon: PencilIcon,
    },
    {
      value: "read" as const,
      label: "只读",
      description: "仅查看文档",
      icon: EyeIcon,
    },
  ];
  const currentMode = isEditing ? "edit" : "read";
  const currentModeOption = modeOptions.find((item) => item.value === currentMode) ?? modeOptions[1];

  useEffect(() => {
    setCurrentDocument(document);
    setDraftTitle(document.title);
    setDraftBlocks(blocksFromDocument(document));
    setDraftHistory({ past: [], future: [] });
    setModeLoadedForDocId(null);
    setNotice("");
    setShowDeleteConfirm(false);
    setShowShareDialog(false);
    setIsModeMenuOpen(false);
    setPendingCommentAnchor(null);
    setActiveCommentThreadId(initialActiveThreadId ?? null);
    setHoveredCommentThreadId(null);
    setCurrentShareSettings(shareSettings ?? null);
  }, [document, initialActiveThreadId, shareSettings]);

  useEffect(() => {
    if (!showCommentSidebar) {
      setCurrentUserId(null);
      return;
    }
    let disposed = false;
    const loadCurrentUser = async () => {
      const result = await fetchCurrentUser();
      if (disposed) {
        return;
      }
      setCurrentUserId(result.data?.id ?? null);
    };
    void loadCurrentUser();
    return () => {
      disposed = true;
    };
  }, [showCommentSidebar]);

  useEffect(() => {
    if (!showCommentSidebar) {
      setCommentThreads([]);
      setCommentsUnavailable(false);
      return;
    }
    let disposed = false;
    const loadComments = async () => {
      const result = await fetchCommentThreads(document.id);
      if (disposed) {
        return;
      }
      setCommentThreads(result.data);
      setCommentsUnavailable(result.unavailable);
    };
    void loadComments();
    return () => {
      disposed = true;
    };
  }, [document.id, showCommentSidebar]);

  useEffect(() => {
    if (currentDocument.isSharedView || (!canEditDocument && !canCommentDocument && !canManageDocument)) {
      return;
    }
    const source = new EventSource("/api/events/stream", { withCredentials: true });
    const reloadComments = () => {
      if (!showCommentSidebar) {
        return;
      }
      void fetchCommentThreads(currentDocument.id).then((result) => {
        setCommentThreads(result.data);
        setCommentsUnavailable(result.unavailable);
      });
    };
    const handleDocumentEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { document_id?: string; event_type?: string; document?: { title?: string; visibility?: string } };
        if (payload.document_id !== currentDocument.id) {
          return;
        }
        if (payload.event_type === "document.content_updated") {
          setNotice(
            isEditing
              ? "文档已在其他地方更新。当前编辑内容不会被自动覆盖，保存前请确认是否需要刷新查看。"
              : "文档已在其他地方更新，可以刷新查看最新内容。",
          );
          return;
        }
        if (payload.event_type === "document.permission_changed") {
          setNotice("文档权限已发生变化，部分操作能力可能已更新。");
          return;
        }
        if (payload.document) {
          setCurrentDocument((current) => ({
            ...current,
            title: payload.document?.title ?? current.title,
            visibility: payload.document?.visibility ?? current.visibility,
          }));
        }
      } catch {
        // Ignore malformed stream payloads.
      }
    };
    const handleCommentEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { document_id?: string };
        if (payload.document_id === currentDocument.id) {
          reloadComments();
        }
      } catch {
        // Ignore malformed stream payloads.
      }
    };
    const documentEvents = ["document.updated", "document.content_updated", "document.permission_changed"];
    const commentEvents = ["comment.thread_created", "comment.created", "comment.updated", "comment.deleted", "comment.resolved", "comment.reopened"];
    for (const eventName of documentEvents) {
      source.addEventListener(eventName, handleDocumentEvent);
    }
    for (const eventName of commentEvents) {
      source.addEventListener(eventName, handleCommentEvent);
    }
    source.onerror = () => {
      source.close();
      setNotice("实时连接已断开，当前文档可能不是最新。刷新页面可重新连接。");
    };
    return () => {
      for (const eventName of documentEvents) {
        source.removeEventListener(eventName, handleDocumentEvent);
      }
      for (const eventName of commentEvents) {
        source.removeEventListener(eventName, handleCommentEvent);
      }
      source.close();
    };
  }, [
    canCommentDocument,
    canEditDocument,
    canManageDocument,
    currentDocument.id,
    currentDocument.isSharedView,
    isEditing,
    showCommentSidebar,
  ]);

  useEffect(() => {
    if (isPdfDocument || !canEditDocument) {
      setIsEditing(false);
      setModeLoadedForDocId(currentDocument.id);
      return;
    }

    try {
      const savedMode = window.localStorage.getItem(documentModeStorageKey(currentDocument.id));
      setIsEditing(savedMode ? savedMode === "edit" : true);
    } catch {
      setIsEditing(true);
    } finally {
      setModeLoadedForDocId(currentDocument.id);
    }
  }, [canEditDocument, currentDocument.id, isPdfDocument]);

  useEffect(() => {
    if (isPdfDocument || !canEditDocument || modeLoadedForDocId !== currentDocument.id) {
      return;
    }

    try {
      window.localStorage.setItem(documentModeStorageKey(currentDocument.id), isEditing ? "edit" : "read");
    } catch {
      // Ignore browser storage failures and keep in-memory mode state.
    }
  }, [canEditDocument, currentDocument.id, isEditing, isPdfDocument, modeLoadedForDocId]);

  useEffect(() => {
    return () => {
      if (modeMenuHideTimerRef.current) {
        window.clearTimeout(modeMenuHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const textarea = titleTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draftTitle, isEditing, currentDocument.title]);

  useEffect(() => {
    if (!isModeMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModeMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      if (modeMenuHideTimerRef.current) {
        window.clearTimeout(modeMenuHideTimerRef.current);
        modeMenuHideTimerRef.current = null;
      }
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isModeMenuOpen]);

  const keepModeMenuOpen = () => {
    if (modeMenuHideTimerRef.current) {
      window.clearTimeout(modeMenuHideTimerRef.current);
      modeMenuHideTimerRef.current = null;
    }
  };

  const hideModeMenuWithDelay = () => {
    keepModeMenuOpen();
    modeMenuHideTimerRef.current = window.setTimeout(() => {
      setIsModeMenuOpen(false);
      modeMenuHideTimerRef.current = null;
    }, 1500);
  };

  useEffect(() => {
    if (!isEditing || !canEditDocument || isPdfDocument || draftBlocks.length === 0) {
      return;
    }

    const lastBlock = draftBlocks[draftBlocks.length - 1];
    if (!lastBlock || !blockHasMeaningfulContent(lastBlock)) {
      return;
    }

    setDraftBlocks((current) => {
      const currentLastBlock = current[current.length - 1];
      if (!currentLastBlock || !blockHasMeaningfulContent(currentLastBlock)) {
        return current;
      }

      return [
        ...current,
        {
          id: blockId(),
          type: "paragraph",
          text: "",
        },
      ];
    });
  }, [canEditDocument, draftBlocks, isEditing, isPdfDocument]);

  const summaryLabel = useMemo(() => {
    return (
      currentDocument.summary
        ?.split("\n")
        .map((line) => line.replace(/\s*\|\s*$/, "").trim())
        .filter(Boolean)
        .join(" ") ?? ""
    );
  }, [currentDocument.summary]);

  const normalizedDraftBlocks = useMemo(
    () =>
      draftBlocks.map((block) => ({
        type: block.type,
        headingLevel: block.headingLevel ?? null,
        imageAlign: block.imageAlign ?? null,
        text: block.text.trim(),
        meta: block.meta ?? null,
      })),
    [draftBlocks],
  );
  const normalizedSavedBlocks = useMemo(
    () =>
      blocksFromDocument(currentDocument).map((block) => ({
        type: block.type,
        headingLevel: block.headingLevel ?? null,
        imageAlign: block.imageAlign ?? null,
        text: block.text.trim(),
        meta: block.meta ?? null,
      })),
    [currentDocument],
  );

  const draftSignature = useMemo(
    () => JSON.stringify({ title: draftTitle.trim(), blocks: normalizedDraftBlocks }),
    [draftTitle, normalizedDraftBlocks],
  );
  const savedSignature = useMemo(
    () => JSON.stringify({ title: currentDocument.title.trim(), blocks: normalizedSavedBlocks }),
    [currentDocument.title, normalizedSavedBlocks],
  );
  const isDirty = canEditDocument && draftSignature != savedSignature;

  const latestRef = useRef({
    draftTitle,
    draftBlocks,
    draftSignature,
    savedSignature,
    isDirty,
  });
  latestRef.current = {
    draftTitle,
    draftBlocks,
    draftSignature,
    savedSignature,
    isDirty,
  };

  const captureDraftSnapshot = () => ({
    title: latestRef.current.draftTitle,
    blocks: cloneDraftBlocks(latestRef.current.draftBlocks),
  });

  const pushDraftHistory = (snapshot: DraftHistorySnapshot) => {
    const signature = draftHistorySignature(snapshot);
    setDraftHistory((current) => {
      const lastSnapshot = current.past[current.past.length - 1];
      if (lastSnapshot && draftHistorySignature(lastSnapshot) === signature) {
        return { ...current, future: [] };
      }
      return {
        past: [...current.past, snapshot].slice(-DRAFT_HISTORY_LIMIT),
        future: [],
      };
    });
  };

  const applyDraftTitleChange = (nextTitle: string) => {
    const previous = captureDraftSnapshot();
    if (previous.title === nextTitle) {
      return;
    }
    pushDraftHistory(previous);
    setDraftTitle(nextTitle);
  };

  const applyDraftBlocksChange = (nextBlocks: EditableBlock[]) => {
    const previous = captureDraftSnapshot();
    const nextSnapshot = { title: previous.title, blocks: cloneDraftBlocks(nextBlocks) };
    if (draftHistorySignature(previous) === draftHistorySignature(nextSnapshot)) {
      return;
    }
    pushDraftHistory(previous);
    setDraftBlocks(nextBlocks);
  };

  const undoDraftChange = () => {
    const previous = draftHistory.past[draftHistory.past.length - 1];
    if (!previous) {
      return;
    }

    const currentSnapshot = captureDraftSnapshot();
    setDraftTitle(previous.title);
    setDraftBlocks(cloneDraftBlocks(previous.blocks));
    setDraftHistory({
      past: draftHistory.past.slice(0, -1),
      future: [currentSnapshot, ...draftHistory.future].slice(0, DRAFT_HISTORY_LIMIT),
    });
  };

  const redoDraftChange = () => {
    const next = draftHistory.future[0];
    if (!next) {
      return;
    }

    const currentSnapshot = captureDraftSnapshot();
    setDraftTitle(next.title);
    setDraftBlocks(cloneDraftBlocks(next.blocks));
    setDraftHistory({
      past: [...draftHistory.past, currentSnapshot].slice(-DRAFT_HISTORY_LIMIT),
      future: draftHistory.future.slice(1),
    });
  };

  useEffect(() => {
    const handleKeyboardHistory = (event: KeyboardEvent) => {
      if (!isEditing || !canEditDocument || isPdfDocument) {
        return;
      }

      const key = event.key.toLowerCase();
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed || event.altKey) {
        return;
      }

      if (key === "z" && !event.shiftKey && draftHistory.past.length > 0) {
        event.preventDefault();
        undoDraftChange();
        setNotice("已撤销");
        return;
      }

      if ((key === "z" && event.shiftKey) || key === "y") {
        if (draftHistory.future.length === 0) {
          return;
        }
        event.preventDefault();
        redoDraftChange();
        setNotice("已重做");
      }
    };

    window.addEventListener("keydown", handleKeyboardHistory);
    return () => window.removeEventListener("keydown", handleKeyboardHistory);
  }, [canEditDocument, draftHistory.future.length, draftHistory.past.length, isEditing, isPdfDocument]);

  const resolveLinkPreview = async (blockId: string, rawUrl: string) => {
    const normalizedHref = normalizeExternalHref(rawUrl);
    if (!normalizedHref) {
      setDraftBlocks((current) =>
        current.map((block) =>
          block.id === blockId
            ? {
                ...block,
                meta: {
                  ...block.meta,
                  href: "",
                  status: "error",
                },
              }
            : block,
        ),
      );
      return;
    }

    setDraftBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              meta: {
                ...block.meta,
                href: normalizedHref,
                title: block.meta?.title || block.text.trim() || inferSiteNameFromHref(normalizedHref),
                siteName: block.meta?.siteName || inferSiteNameFromHref(normalizedHref),
                view: block.meta?.view || "link",
                status: "loading",
              },
            }
          : block,
      ),
    );

    try {
      const preview = await fetchLinkPreview(normalizedHref);
      setDraftBlocks((current) =>
        current.map((block) =>
          block.id === blockId
            ? {
                ...block,
                meta: {
                  ...block.meta,
                  href: preview.normalizedUrl,
                  title: preview.title,
                  description: preview.description,
                  siteName: preview.siteName,
                  image: preview.image,
                  icon: preview.icon,
                  view: block.meta?.view || preview.view || "link",
                  status: preview.status,
                },
              }
            : block,
        ),
      );
    } catch {
      setDraftBlocks((current) =>
        current.map((block) =>
          block.id === blockId
            ? {
                ...block,
                meta: {
                  ...block.meta,
                  href: normalizedHref,
                  status: "error",
                },
              }
            : block,
        ),
      );
    }
  };

  const uploadImages = async (files: File[]) => {
    return Promise.all(files.map((file) => uploadImageAsset(file)));
  };

  const handleCreateCommentThread = async (body: string) => {
    if (!pendingCommentAnchor || !canCommentDocument) {
      return;
    }
    try {
      const thread = await createCommentThread(currentDocument.id, {
        anchor: pendingCommentAnchor,
        body,
      });
      setCommentThreads((current) => [...current, thread]);
      setPendingCommentAnchor(null);
      setActiveCommentThreadId(thread.id);
      setCommentsUnavailable(false);
      setNotice("评论已添加");
    } catch {
      setNotice("评论创建失败");
    }
  };

  const handleReplyCommentThread = async (threadId: string, body: string, parentCommentId?: string | null) => {
    if (!canCommentDocument) {
      return;
    }
    try {
      const nextThread = await replyCommentThread(threadId, body, parentCommentId);
      setCommentThreads((current) => current.map((thread) => (thread.id === threadId ? nextThread : thread)));
      setActiveCommentThreadId(threadId);
      setCommentsUnavailable(false);
      setNotice("回复已添加");
    } catch {
      setNotice("回复失败");
    }
  };

  const handleCommentStatusChange = async (threadId: string, status: "open" | "resolved") => {
    if (!canCommentDocument) {
      return;
    }
    try {
      const nextThread = await updateCommentThreadStatus(threadId, status);
      setCommentThreads((current) => current.map((thread) => (thread.id === threadId ? nextThread : thread)));
      setActiveCommentThreadId(threadId);
      setCommentsUnavailable(false);
      setNotice(status === "resolved" ? "评论已解决" : "评论已重新打开");
    } catch {
      setNotice("评论状态更新失败");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!canCommentDocument && !canManageDocument) {
      return;
    }
    try {
      const result = await deleteComment(commentId);
      setCommentThreads((current) => {
        if (result.threadDeleted || !result.thread) {
          return current.filter((thread) => thread.id !== result.threadId);
        }
        return current.map((thread) => (thread.id === result.threadId ? result.thread! : thread));
      });
      if (activeCommentThreadId === result.threadId && result.threadDeleted) {
        setActiveCommentThreadId(null);
      }
      setCommentsUnavailable(false);
      setNotice("评论已删除");
    } catch {
      setNotice("评论删除失败");
    }
  };

  const persistDraft = async (source: "auto" | "mode") => {
    if (isPdfDocument || !canEditDocument) {
      return true;
    }

    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }

    const snapshot = latestRef.current;
    if (!snapshot.isDirty) {
      return true;
    }

    setIsSaving(true);
    const promise = (async () => {
      try {
        const contentJson = contentFromBlocks(snapshot.draftTitle.trim(), snapshot.draftBlocks);
        const nextDocument = await updateDocumentContent({
          docId: currentDocument.id,
          contentJson,
          plainText: [
            snapshot.draftTitle,
            ...snapshot.draftBlocks.map((block) => block.text.trim()).filter(Boolean),
          ]
            .join("\n")
            .trim(),
        });

        setCurrentDocument(nextDocument);

        if (latestRef.current.draftSignature === snapshot.draftSignature) {
          // Keep the in-flight editor tree and stable block ids after autosave.
          // Replacing draft blocks from server response remounts textareas and drops focus.
          setDraftTitle((current) => current);
          setDraftBlocks((current) => current);
        }

        setNotice(source === "auto" ? "已自动保存" : "已保存到服务器");
        return true;
      } catch {
        setNotice("保存失败");
        return false;
      } finally {
        savePromiseRef.current = null;
        setIsSaving(false);
      }
    })();

    savePromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    if (!isEditing || !canEditDocument || isPdfDocument || !isDirty) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistDraft("auto");
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [canEditDocument, draftSignature, isDirty, isEditing, isPdfDocument]);

  const flushPendingChanges = async () => {
    while (true) {
      const latest = latestRef.current;
      if (!latest.isDirty) {
        return true;
      }

      const ok = savePromiseRef.current ? await savePromiseRef.current : await persistDraft("mode");
      if (!ok) {
        return false;
      }
    }
  };

  const handleModeChange = async (nextMode: "read" | "edit") => {
    setIsModeMenuOpen(false);
    if (!canEditDocument) {
      setIsEditing(false);
      return;
    }
    if (nextMode === "edit") {
      setIsEditing(true);
      setNotice("");
      return;
    }

    if (!isEditing) {
      return;
    }

    const ok = await flushPendingChanges();
    if (!ok) {
      return;
    }

    setIsEditing(false);
  };

  const confirmDelete = () => {
    if (!canDeleteDocument) {
      return;
    }
    const fallbackUrl =
      breadcrumbs && breadcrumbs.length > 0
        ? `/folders/${breadcrumbs[breadcrumbs.length - 1].id}`
        : `/documents${currentDocument.spaceId ? `?space=${currentDocument.spaceId}` : ""}`;
    startTransition(async () => {
      try {
        await softDeleteDocument(currentDocument.id);
        setShowDeleteConfirm(false);
        if (window.history.length > 1) {
          router.back();
          window.setTimeout(() => router.refresh(), 100);
          return;
        }
        router.replace(fallbackUrl);
        router.refresh();
      } catch {
        setNotice("删除失败");
      }
    });
  };

  const toggleFavorite = () => {
    if (currentDocument.isSharedView) {
      return;
    }
    startTransition(async () => {
      try {
        if (currentDocument.isFavorited) {
          await unfavoriteDocument(currentDocument.id);
          setCurrentDocument((value) => ({ ...value, isFavorited: false }));
          setNotice("已取消收藏");
        } else {
          await favoriteDocument(currentDocument.id);
          setCurrentDocument((value) => ({ ...value, isFavorited: true }));
          setNotice("已加入收藏");
        }
        router.refresh();
      } catch {
        setNotice("收藏操作失败");
      }
    });
  };

  const visibilityLabel = currentDocument.visibility === "public" ? "公开文档" : "私有文档";
  const visibilityHint =
    currentDocument.visibility === "public" ? "所有人可访问原文档链接" : "仅作者与授权用户可访问原文档链接";
  const scrollToOutlineTarget = (targetId: string) => {
    const target = window.document.getElementById(targetId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    window.history.replaceState(null, "", `#${targetId}`);
  };

  return (
    <div
      className={`grid min-h-screen grid-cols-1 ${
        showCommentSidebar ? "xl:grid-cols-[260px_minmax(0,1fr)_340px]" : "xl:grid-cols-[260px_minmax(0,1fr)]"
      }`}
    >
      <aside className="hidden border-r border-slate-200/80 bg-white/55 px-5 py-5 xl:block">
        <div className="sticky top-5 max-h-[calc(100vh-2.5rem)] overflow-y-auto pr-1">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">页面目录</div>
          <div className="mt-3 space-y-1">
            {currentDocument.outline.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToOutlineTarget(item.id);
                }}
                style={{
                  paddingLeft: `${0.625 + Math.max(0, Math.min(5, item.level - 1)) * 0.75}rem`,
                }}
                className={`block rounded-lg py-1.5 pr-2.5 transition hover:bg-slate-100 hover:text-slate-800 ${
                  item.level <= 1
                    ? "text-sm font-medium text-slate-600"
                    : item.level === 2
                      ? "text-sm text-slate-500"
                      : "text-xs text-slate-400"
                }`}
              >
                {item.title}
              </a>
            ))}
          </div>
        </div>
      </aside>

      <section className="min-w-0 bg-[#fcfbf8] px-3 py-4 md:px-4">
        <header className="mx-auto mb-4 max-w-[1240px]">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <nav className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                <Link href={`/documents${currentDocument.spaceId ? `?space=${currentDocument.spaceId}` : ""}`} className="transition hover:text-slate-700">
                  {spaceName ?? "空间"}
                </Link>
                {(breadcrumbs ?? []).map((item) => (
                  <div key={item.id} className="contents">
                    <span>/</span>
                    <Link href={`/folders/${item.id}`} className="transition hover:text-slate-700">
                      {item.title}
                    </Link>
                  </div>
                ))}
                <span>/</span>
                <Link href={`/docs/${currentDocument.id}`} className="transition hover:text-slate-700">
                  {currentDocument.title}
                </Link>
              </nav>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {!currentDocument.isSharedView ? (
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      currentDocument.isFavorited
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-white/80 text-slate-600"
                    }`}
                  >
                    {currentDocument.isFavorited ? "已收藏" : "收藏"}
                  </button>
                ) : null}
                {canOpenShareDialog ? (
                  <button
                    type="button"
                    onClick={() => setShowShareDialog(true)}
                    className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-600"
                  >
                    权限/分享
                  </button>
                ) : null}
                {canDeleteDocument ? (
                  <button
                    type="button"
                    disabled={isMutating || isSaving}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg border border-rose-200 bg-white/80 px-3 py-1.5 text-sm text-rose-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    删除
                  </button>
                ) : null}
                {canEditDocument ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!isEditing || draftHistory.past.length === 0 || isSaving}
                      onClick={() => {
                        undoDraftChange();
                        setNotice("已撤销");
                      }}
                      className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
                      title="撤销（⌘Z / Ctrl+Z）"
                    >
                      撤销
                    </button>
                    <button
                      type="button"
                      disabled={!isEditing || draftHistory.future.length === 0 || isSaving}
                      onClick={() => {
                        redoDraftChange();
                        setNotice("已重做");
                      }}
                      className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
                      title="重做（⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y）"
                    >
                      重做
                    </button>
                  </div>
                ) : null}
                {canEditDocument ? (
                  <div
                    ref={modeMenuRef}
                    className="relative"
                    onPointerEnter={keepModeMenuOpen}
                    onPointerLeave={hideModeMenuWithDelay}
                  >
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        if (isModeMenuOpen) {
                          keepModeMenuOpen();
                          setIsModeMenuOpen(false);
                          return;
                        }
                        keepModeMenuOpen();
                        setIsModeMenuOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/88 px-3.5 py-1.5 text-sm text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <currentModeOption.icon active />
                      <span className="font-medium">{currentModeOption.label}</span>
                      <ChevronIcon open={isModeMenuOpen} />
                    </button>
                    <div
                      onPointerEnter={keepModeMenuOpen}
                      onPointerLeave={hideModeMenuWithDelay}
                      className={`absolute right-0 top-[calc(100%+10px)] z-30 w-44 origin-top-right rounded-lg border border-slate-200 bg-white/96 p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-sm transition duration-180 ease-out ${
                        isModeMenuOpen
                          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                          : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                      }`}
                    >
                      {modeOptions.map((option) => {
                        const selected = currentMode === option.value;
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              void handleModeChange(option.value);
                            }}
                            className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                              selected ? "bg-slate-100/90" : "hover:bg-slate-50"
                            } disabled:cursor-not-allowed disabled:opacity-70`}
                          >
                            <div className="mt-0.5 shrink-0">
                              <Icon active={selected} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm font-medium ${selected ? "text-sky-600" : "text-slate-800"}`}>
                                {option.label}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400">{option.description}</div>
                            </div>
                            <div className="mt-0.5 shrink-0">{selected ? <CheckIcon /> : null}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : isPdfDocument ? (
                  <span className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-500">
                    PDF 暂不支持编辑
                  </span>
                ) : (
                  <span className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-500">
                    {currentDocument.isSharedView ? "分享只读视图" : "只读"}
                  </span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              {!isPdfDocument ? (
                <textarea
                  id="intro"
                  ref={titleTextareaRef}
                  value={draftTitle}
                  onChange={(event) => applyDraftTitleChange(event.target.value)}
                  readOnly={!isEditing || !canEditDocument}
                  rows={1}
                  spellCheck={isEditing && canEditDocument}
                  aria-readonly={!isEditing || !canEditDocument}
                  className={`block w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-[2.1rem] font-semibold leading-tight tracking-tight text-slate-950 outline-none ring-0 placeholder:text-slate-300 ${
                    !isEditing || !canEditDocument ? "cursor-text caret-transparent" : ""
                  }`}
                />
              ) : (
                <h1 id="intro" className="text-[2.1rem] font-semibold leading-tight tracking-tight text-slate-950">
                  {currentDocument.title}
                </h1>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{currentDocument.updatedAt}</span>
                <span>·</span>
                <span>{isSaving ? "保存中..." : currentDocument.saveStatus}</span>
                {notice ? (
                  <>
                    <span>·</span>
                    <span>{notice}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 ${isEditing ? "opacity-75" : ""}`}>
            <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">
              {currentDocument.documentType}
            </span>
            <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1" title={visibilityHint}>
              {visibilityLabel}
            </span>
            {currentDocument.isSharedView ? (
              <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">独立分享链接访问</span>
            ) : (
              <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">
                {canEditDocument ? "可编辑" : "只读"}
              </span>
            )}
            {currentShareSettings?.isEnabled ? (
              <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">
                已启用分享
              </span>
            ) : null}
            {summaryLabel ? (
              <span className="max-w-full truncate rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">
                {summaryLabel}
              </span>
            ) : null}
          </div>
        </header>

        <article className="mx-auto max-w-[1240px] bg-transparent px-0 py-4">
          {isPdfDocument ? (
            <PdfPreview
              fileUrl={currentDocument.fileUrl}
              fileName={currentDocument.fileName}
              fileSize={currentDocument.fileSize}
            />
          ) : (
            <BlockEditor
              blocks={draftBlocks}
              onChange={applyDraftBlocksChange}
              onResolveLinkPreview={resolveLinkPreview}
              onUploadImage={uploadImages}
              commentThreads={commentThreads}
              activeCommentThreadId={activeCommentThreadId}
              hoveredCommentThreadId={hoveredCommentThreadId}
              onActivateCommentThread={setActiveCommentThreadId}
              onHoverCommentThread={setHoveredCommentThreadId}
              onCreateCommentSelection={canCommentDocument ? setPendingCommentAnchor : undefined}
              readOnly={!isEditing || !canEditDocument}
            />
          )}
        </article>
        {canOpenShareDialog ? (
          <DocumentShareDialog
            open={showShareDialog}
            documentId={currentDocument.id}
            currentVisibility={(currentDocument.visibility === "public" ? "public" : "private")}
            canTransferOwner={currentDocument.canTransferOwner}
            mentionCandidates={mentionCandidates}
            onClose={() => setShowShareDialog(false)}
            onSaved={({ visibility, share }) => {
              setCurrentDocument((value) => ({ ...value, visibility }));
              setCurrentShareSettings(share);
            }}
          />
        ) : null}
        <ConfirmDialog
          open={showDeleteConfirm}
          title="确认删除文档"
          description="删除后文档会移入回收站，并返回上一页。若没有历史记录，则返回所属文件夹或文档列表。"
          confirmLabel="确认删除"
          cancelLabel="取消"
          danger
          pending={isMutating}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
        />
      </section>
      {showCommentSidebar ? (
        <CommentSidebar
          threads={commentThreads}
          blockOrder={draftBlocks.map((block) => block.id)}
          mentionCandidates={mentionCandidates}
          currentUserId={currentUserId}
          documentOwnerId={document.ownerId}
          activeThreadId={activeCommentThreadId}
          hoveredThreadId={hoveredCommentThreadId}
          pendingAnchor={pendingCommentAnchor}
          unavailable={commentsUnavailable}
          onActivate={setActiveCommentThreadId}
          onHoverThread={setHoveredCommentThreadId}
          onCreate={handleCreateCommentThread}
          onReply={handleReplyCommentThread}
          onStatusChange={handleCommentStatusChange}
          onDeleteComment={handleDeleteComment}
        />
      ) : null}
    </div>
  );
}
