"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DocumentViewModel } from "@/lib/mock-document";
import { BlockEditor, EditableBlock } from "@/components/editor/block-editor";
import {
  favoriteDocument,
  fetchLinkPreview,
  softDeleteDocument,
  unfavoriteDocument,
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

function blocksFromDocument(document: DocumentViewModel): EditableBlock[] {
  const blocks = document.content.slice(1).map((node, index) => {
    if (node.type === "heading") {
      const level = sanitizeHeadingLevel(Number(node.attrs?.level ?? 2));
      return {
        id: `${document.id}-heading-${index}`,
        type: "heading" as const,
        headingLevel: level,
        text: flattenText(node.content),
      };
    }

    if (node.type === "bullet_list") {
      return {
        id: `${document.id}-list-${index}`,
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
        id: `${document.id}-ordered-list-${index}`,
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
        id: `${document.id}-check-${index}`,
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
        id: `${document.id}-quote-${index}`,
        type: "quote" as const,
        text: flattenText(node.content),
      };
    }

    if (node.type === "horizontal_rule") {
      return {
        id: `${document.id}-divider-${index}`,
        type: "divider" as const,
        text: "",
      };
    }

    if (node.type === "link_card") {
      const title = String(node.attrs?.title ?? "").trim();
      const href = String(node.attrs?.href ?? "").trim();
      if (!normalizeExternalHref(href)) {
        return {
          id: `${document.id}-paragraph-${index}`,
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
        id: `${document.id}-link-${index}`,
        type: "link" as const,
        text: composeLinkSource(meta, title || href),
        meta,
      };
    }

    if (node.type === "image_block") {
      const alt = String(node.attrs?.alt ?? "").trim();
      const src = String(node.attrs?.src ?? "").trim();
      return {
        id: `${document.id}-image-${index}`,
        type: "image" as const,
        text: alt && src ? `${alt} | ${src}` : alt || src,
      };
    }

    if (node.type === "code_block") {
      return {
        id: `${document.id}-code-${index}`,
        type: "code_block" as const,
        text: node.content?.[0]?.text ?? "",
      };
    }

    return {
      id: `${document.id}-paragraph-${index}`,
      type: "paragraph" as const,
      text: flattenText(node.content),
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

    if (block.type === "heading") {
      const level = sanitizeHeadingLevel(block.headingLevel ?? 2);
      if (!text) {
        contentNodes.push({
          type: "heading",
          attrs: {
            level,
            anchor: `empty-heading-${block.id}`,
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
          anchor: text
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-"),
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
          attrs: { preservedEmpty: true },
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
          attrs: { preservedEmpty: true },
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
        attrs: lines.length === 0 ? { preservedEmpty: true } : undefined,
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
          attrs: { preservedEmpty: true },
          content: emptyTextNode(),
        });
        continue;
      }

      contentNodes.push({
        type: "blockquote",
        content: [{ type: "text", text: text.replace(/\n/g, " ") }],
      });
      continue;
    }

    if (block.type === "divider") {
      contentNodes.push({
        type: "horizontal_rule",
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
          alt: altPart || "图片",
          src: srcPart || altPart || "",
          preservedEmpty: !text,
        },
      });
      continue;
    }

    if (block.type === "code_block") {
      if (!text) {
        contentNodes.push({
          type: "code_block",
          attrs: { language: "plain", preservedEmpty: true },
          content: emptyTextNode(),
        });
        continue;
      }

      contentNodes.push({
        type: "code_block",
        attrs: { language: "plain" },
        content: [{ type: "text", text }],
      });
      continue;
    }

    if (!text) {
      contentNodes.push({
        type: "paragraph",
        attrs: { preservedEmpty: true },
        content: emptyTextNode(),
      });
      continue;
    }

    contentNodes.push({
      type: "paragraph",
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

export function DocumentPage({ document }: { document: DocumentViewModel }) {
  const router = useRouter();
  const [currentDocument, setCurrentDocument] = useState(document);
  const [isEditing, setIsEditing] = useState(true);
  const [modeLoadedForDocId, setModeLoadedForDocId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const modeMenuHideTimerRef = useRef<number | null>(null);
  const [isMutating, startTransition] = useTransition();
  const [draftTitle, setDraftTitle] = useState(document.title);
  const [draftBlocks, setDraftBlocks] = useState(() => blocksFromDocument(document));
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const isPdfDocument = currentDocument.documentType === "pdf";

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
    setModeLoadedForDocId(null);
    setNotice("");
    setShowDeleteConfirm(false);
    setIsModeMenuOpen(false);
  }, [document]);

  useEffect(() => {
    if (isPdfDocument) {
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
  }, [currentDocument.id, isPdfDocument]);

  useEffect(() => {
    if (isPdfDocument || modeLoadedForDocId !== currentDocument.id) {
      return;
    }

    try {
      window.localStorage.setItem(documentModeStorageKey(currentDocument.id), isEditing ? "edit" : "read");
    } catch {
      // Ignore browser storage failures and keep in-memory mode state.
    }
  }, [currentDocument.id, isEditing, isPdfDocument, modeLoadedForDocId]);

  useEffect(() => {
    return () => {
      if (modeMenuHideTimerRef.current) {
        window.clearTimeout(modeMenuHideTimerRef.current);
      }
    };
  }, []);

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
    if (!isEditing || isPdfDocument || draftBlocks.length === 0) {
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
  }, [draftBlocks, isEditing, isPdfDocument]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}/docs/${currentDocument.id}`;
  }, [currentDocument.id]);

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
  const isDirty = !isPdfDocument && draftSignature != savedSignature;

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

  const persistDraft = async (source: "auto" | "mode") => {
    if (isPdfDocument) {
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
          setDraftTitle(nextDocument.title);
          setDraftBlocks(blocksFromDocument(nextDocument));
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
    if (!isEditing || isPdfDocument || !isDirty) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistDraft("auto");
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [draftSignature, isDirty, isEditing, isPdfDocument]);

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
    startTransition(async () => {
      try {
        await softDeleteDocument(currentDocument.id);
        setShowDeleteConfirm(false);
        router.push("/");
        router.refresh();
      } catch {
        setNotice("删除失败");
      }
    });
  };

  const toggleFavorite = () => {
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

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("链接已复制");
    } catch {
      setNotice("复制失败");
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200/80 bg-white/55 px-3 py-5 xl:block">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">页面目录</div>
        <div className="mt-3 space-y-1">
          {currentDocument.outline.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="block rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              {item.title}
            </a>
          ))}
        </div>
      </aside>

      <section className="min-w-0 bg-[#fcfbf8] px-5 py-4 md:px-8">
        <header className="mx-auto mb-4 max-w-[980px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <nav className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                <Link href="/" className="transition hover:text-slate-700">
                  产品空间
                </Link>
                <span>/</span>
                <Link href={`/docs/${currentDocument.id}`} className="transition hover:text-slate-700">
                  云文档
                </Link>
              </nav>
              {!isPdfDocument ? (
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  readOnly={!isEditing}
                  spellCheck={isEditing}
                  aria-readonly={!isEditing}
                  className={`mt-2 w-full border-0 bg-transparent px-0 py-0 text-[2.1rem] font-semibold tracking-tight text-slate-950 outline-none ring-0 placeholder:text-slate-300 ${
                    !isEditing ? "cursor-text caret-transparent" : ""
                  }`}
                />
              ) : (
                <h1 className="mt-2 text-[2.1rem] font-semibold tracking-tight text-slate-950">
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

            <div className="flex flex-wrap items-center justify-end gap-1.5">
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
              <button
                type="button"
                onClick={copyShareLink}
                className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-600"
              >
                分享
              </button>
              <button
                type="button"
                disabled={isMutating || isSaving}
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg border border-rose-200 bg-white/80 px-3 py-1.5 text-sm text-rose-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                删除
              </button>
              {!isPdfDocument ? (
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
              ) : (
                <span className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-500">
                  PDF 暂不支持编辑
                </span>
              )}
            </div>
          </div>

          <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 ${isEditing ? "opacity-75" : ""}`}>
            <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">
              {currentDocument.documentType}
            </span>
            <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">仅团队成员可编辑</span>
            <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">当前为草稿头版本</span>
            {summaryLabel ? (
              <span className="max-w-full truncate rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1">
                {summaryLabel}
              </span>
            ) : null}
          </div>
        </header>

        <article className="mx-auto max-w-[980px] bg-transparent px-0 py-4">
          {isPdfDocument ? (
            <PdfPreview
              fileUrl={currentDocument.fileUrl}
              fileName={currentDocument.fileName}
              fileSize={currentDocument.fileSize}
            />
          ) : (
            <BlockEditor
              blocks={draftBlocks}
              onChange={setDraftBlocks}
              onResolveLinkPreview={resolveLinkPreview}
              readOnly={!isEditing}
            />
          )}
        </article>

        {showDeleteConfirm ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/18 px-4">
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <h2 className="text-lg font-semibold text-slate-900">确认删除文档</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                删除后文档会移入回收站。此操作会关闭当前页面。
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={confirmDelete}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isMutating ? "删除中..." : "确认删除"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
