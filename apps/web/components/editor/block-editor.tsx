"use client";

import type {
  ChangeEvent as ReactChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { CommentAnchor, CommentThread } from "@/lib/api";
import {
  commandQuery,
  filterCommands,
  quickCommandsForBlock,
} from "@/components/editor/block-command-utils";
import {
  TextBlockSurface,
  type TextCommentRange,
  type UnifiedTextBlockType,
} from "@/components/editor/text-block-surface";
import {
  buildCheckListRawText,
  displayOffsetFromBlockRawOffset,
  displayTextForBlock,
  parseCheckListRawText,
  placeholderByType,
  readOnlyMinHeightStyle,
  rawOffsetFromBlockDisplayOffset,
  rowsByType,
  showsUnifiedTextSurface,
  textSurfacePaddingClassName,
  textSurfaceGutterWidth,
  textAreaClassName,
  toggleCheckListLine,
} from "@/components/editor/text-block-surface-utils";
import {
  buildSelectionToolbarState,
  type SelectionToolbarState,
  threadIdAtOffset,
} from "@/components/editor/text-block-selection-utils";
import { CommentSelectionToolbar } from "@/components/editor/comment-selection-toolbar";
import { createClientId } from "@/lib/client-id";

export type LinkCardView = "link" | "title" | "card" | "preview";

export type LinkCardMeta = {
  href?: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  icon?: string;
  view?: LinkCardView;
  status?: "idle" | "loading" | "ready" | "error";
};

export type EditableBlockType =
  | "paragraph"
  | "heading"
  | "bullet_list"
  | "ordered_list"
  | "check_list"
  | "quote"
  | "divider"
  | "link"
  | "image"
  | "code_block";

export type EditableBlock = {
  id: string;
  type: EditableBlockType;
  text: string;
  headingLevel?: number;
  indent?: number;
  orderedListStart?: number;
  orderedListStartOverrides?: Record<number, number>;
  meta?: LinkCardMeta;
  imageAlign?: "left" | "center" | "right";
  imageRotation?: number;
  codeLanguage?: string;
  codeWrap?: boolean;
  codeCollapsed?: boolean;
  codeHeight?: number;
};

type UploadedImageAsset = {
  file_url: string;
  file_name: string;
  mime_type: string;
  file_size: number;
};

const LINK_VIEW_OPTIONS: Array<{ value: LinkCardView; label: string }> = [
  { value: "link", label: "链接视图" },
  { value: "title", label: "标题视图" },
  { value: "card", label: "卡片视图" },
  { value: "preview", label: "预览视图" },
];

export const CODE_LANGUAGE_OPTIONS = [
  { value: "plain_text", label: "Plain Text" },
  { value: "http", label: "HTTP" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "dart", label: "Dart" },
  { value: "scala", label: "Scala" },
  { value: "shell", label: "Shell" },
  { value: "powershell", label: "PowerShell" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML" },
  { value: "markdown", label: "Markdown" },
  { value: "toml", label: "TOML" },
  { value: "csv", label: "CSV" },
  { value: "graphql", label: "GraphQL" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "makefile", label: "Makefile" },
  { value: "regex", label: "Regex" },
  { value: "latex", label: "LaTeX" },
  { value: "lua", label: "Lua" },
  { value: "julia", label: "Julia" },
  { value: "haskell", label: "Haskell" },
  { value: "lisp", label: "Lisp" },
  { value: "matlab", label: "MATLAB" },
] as const;

type ImagePreviewData = {
  blockId: string;
  src: string;
  alt: string;
};

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

function parseLinkSource(text: string) {
  const parts = text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      title: parts[0],
      href: normalizeExternalHref(parts[1]),
    };
  }

  const value = text.trim();
  const href = normalizeExternalHref(value);
  return {
    title: href ? "" : value,
    href,
  };
}

function inferSiteNameFromHref(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

function linkPreviewData(block: EditableBlock) {
  const parsed = parseLinkSource(block.text);
  const href = block.meta?.href?.trim() || parsed.href || "";
  const title = block.meta?.title?.trim() || parsed.title || href || "未命名链接";
  const description = block.meta?.description?.trim() || "";
  const siteName = block.meta?.siteName?.trim() || (href ? inferSiteNameFromHref(href) : "");
  const image = block.meta?.image?.trim() || "";
  const icon = block.meta?.icon?.trim() || "";
  const view = block.meta?.view || "link";
  const status = block.meta?.status || (href ? "ready" : "idle");
  return { href, title, description, siteName, image, icon, view, status };
}

function imageBlockData(block: EditableBlock) {
  const parts = block.text.split("|").map((part) => part.trim());
  if (parts.length >= 2) {
    return {
      alt: parts[0] || "图片",
      src: parts.slice(1).join(" | ").trim(),
    };
  }

  const single = block.text.trim();
  const normalizedHref = normalizeExternalHref(single);
  if (normalizedHref) {
    return {
      alt: "图片",
      src: normalizedHref,
    };
  }

  return {
    alt: single || "图片",
    src: "",
  };
}

function imageAlignClassName(align: EditableBlock["imageAlign"]) {
  if (align === "left") {
    return "justify-start";
  }
  if (align === "right") {
    return "justify-end";
  }
  return "justify-center";
}

function sanitizeHeadingLevel(level: number | undefined) {
  const value = Number(level ?? 1);
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(6, Math.trunc(value)));
}

function defaultTextByType(type: EditableBlockType) {
  if (type === "link") {
    return "";
  }
  return "";
}

function defaultMetaByType(type: EditableBlockType): LinkCardMeta | undefined {
  if (type === "link") {
    return {
      view: "link",
      status: "idle",
    };
  }
  return undefined;
}

function sanitizeIndent(indent: number | undefined) {
  const value = Number(indent ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(6, Math.trunc(value)));
}

function sanitizeOrderedListStart(start: number | undefined) {
  const value = Number(start ?? 1);
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(9999, Math.trunc(value)));
}

function sanitizeOrderedListStartOverrides(overrides: Record<number, number> | undefined, lineCount?: number) {
  const nextOverrides: Record<number, number> = {};
  Object.entries(overrides ?? {}).forEach(([rawIndex, rawStart]) => {
    const index = Number(rawIndex);
    const start = sanitizeOrderedListStart(rawStart);
    if (!Number.isInteger(index) || index <= 0) {
      return;
    }
    if (lineCount !== undefined && index >= lineCount) {
      return;
    }
    nextOverrides[index] = start;
  });
  return nextOverrides;
}

function sanitizeImageRotation(rotation: number | undefined) {
  const value = Number(rotation ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return ((Math.trunc(value) % 360) + 360) % 360;
}

export function sanitizeCodeHeight(height: number | undefined) {
  const value = Number(height ?? 240);
  if (!Number.isFinite(value)) {
    return 240;
  }
  return Math.max(120, Math.min(1200, Math.trunc(value)));
}

export function sanitizeCodeLanguage(language: string | undefined) {
  const normalized = String(language ?? "plain_text").trim().toLowerCase().replace(/\s+/g, "_");
  return CODE_LANGUAGE_OPTIONS.some((option) => option.value === normalized) ? normalized : "plain_text";
}

export function codeLanguageLabel(language: string | undefined) {
  const value = sanitizeCodeLanguage(language);
  return CODE_LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? "Plain Text";
}

function fallbackSplitText() {
  return "";
}

function resizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }
  if (textarea.dataset.codeBlockTextarea === "true") {
    return;
  }

  textarea.style.height = "0px";
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(computedStyle.lineHeight || "0");
  const minHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 0;
  textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
}

function createBlock(type: EditableBlockType, text = "", options?: { headingLevel?: number; meta?: LinkCardMeta }) {
  return {
    id: createClientId(),
    type,
    text,
    headingLevel: type === "heading" ? sanitizeHeadingLevel(options?.headingLevel ?? 1) : undefined,
    meta: type === "link" ? { ...(defaultMetaByType(type) ?? {}), ...(options?.meta ?? {}) } : options?.meta,
    codeLanguage: type === "code_block" ? "plain_text" : undefined,
    codeWrap: type === "code_block" ? true : undefined,
    codeCollapsed: type === "code_block" ? false : undefined,
    codeHeight: type === "code_block" ? 240 : undefined,
  } satisfies EditableBlock;
}

function parsePastedTextToBlocks(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((rawLine) => {
      const line = rawLine.replace(/\t/g, "    ");
      const trimmed = line.trim();

      if (!trimmed) {
        return createBlock("paragraph", "");
      }

      if (/^---+$/.test(trimmed) || /^___+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
        return createBlock("divider", "");
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        return createBlock("heading", headingMatch[2], {
          headingLevel: headingMatch[1].length,
        });
      }

      const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (orderedMatch) {
        const orderedStart = Number(trimmed.match(/^\d+/)?.[0] ?? 1);
        return {
          ...createBlock("ordered_list", orderedMatch[1]),
          orderedListStart: sanitizeOrderedListStart(orderedStart),
        };
      }

      const checkMatch = trimmed.match(/^(?:-\s*)?\[( |x|X)\]\s+(.+)$/);
      if (checkMatch) {
        const checked = checkMatch[1].toLowerCase() === "x";
        return createBlock("check_list", `${checked ? "[x]" : "[ ]"} ${checkMatch[2]}`);
      }

      const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) {
        return createBlock("bullet_list", bulletMatch[1]);
      }

      return createBlock("paragraph", line);
    });
}

function htmlNodeToText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  if (node.tagName === "BR") {
    return "\n";
  }

  return Array.from(node.childNodes)
    .map((child) => htmlNodeToText(child))
    .join("");
}

const PASTE_BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

function hasNestedPasteBlock(element: HTMLElement) {
  return Array.from(element.children).some((child) => PASTE_BLOCK_TAGS.has(child.tagName.toLowerCase()));
}

function parsePastedHtmlToBlocks(html: string) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const body = parsed.body;
  const blocks: EditableBlock[] = [];

  const pushBlock = (block: EditableBlock | null) => {
    if (!block) {
      return;
    }
    blocks.push(block);
  };

  const elementToBlocks = (element: HTMLElement): EditableBlock[] => {
    const tag = element.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      return [createBlock("heading", htmlNodeToText(element).trim(), {
        headingLevel: Number(tag.slice(1)),
      })];
    }

    if (tag === "blockquote") {
      return [createBlock("quote", htmlNodeToText(element).trim())];
    }

    if (tag === "hr") {
      return [createBlock("divider", "")];
    }

    if (tag === "ol") {
      const lines = Array.from(element.querySelectorAll(":scope > li"))
        .map((item) => htmlNodeToText(item).trim())
        .filter((line) => line.length > 0);
      return [createBlock("ordered_list", lines.join("\n"))];
    }

    if (tag === "ul") {
      const items = Array.from(element.querySelectorAll(":scope > li"));
      const lines = items
        .map((item) => {
          const text = htmlNodeToText(item).trim();
          const checkbox = item.querySelector('input[type="checkbox"]');
          if (checkbox) {
            const checked = checkbox.hasAttribute("checked");
            return `${checked ? "[x]" : "[ ]"} ${text}`.trim();
          }
          return text;
        })
        .filter((line) => line.length > 0);

      if (lines.some((line) => /^\[(x|X| )\]\s/.test(line))) {
        return [createBlock("check_list", lines.join("\n"))];
      }

      return [createBlock("bullet_list", lines.join("\n"))];
    }

    if (tag === "pre") {
      const code = element.querySelector("code");
      return [createBlock("code_block", (code?.textContent ?? element.textContent ?? "").replace(/\r\n/g, "\n"))];
    }

    if (tag === "p" || tag === "div") {
      if (hasNestedPasteBlock(element)) {
        return Array.from(element.children).flatMap((child) => elementToBlocks(child as HTMLElement));
      }
      const text = htmlNodeToText(element).replace(/\u00a0/g, " ");
      if (text.includes("\n")) {
        return parsePastedTextToBlocks(text);
      }
      return [createBlock("paragraph", text)];
    }

    if (hasNestedPasteBlock(element)) {
      return Array.from(element.children).flatMap((child) => elementToBlocks(child as HTMLElement));
    }

    const text = htmlNodeToText(element).replace(/\u00a0/g, " ").trim();
    return text ? [createBlock("paragraph", text)] : [];
  };

  const topLevelElements = Array.from(body.children) as HTMLElement[];
  for (const element of topLevelElements) {
    elementToBlocks(element).forEach(pushBlock);
  }

  if (blocks.length === 0) {
    const fallback = htmlNodeToText(body).trim();
    if (!fallback) {
      return null;
    }
    return parsePastedTextToBlocks(fallback);
  }

  return blocks;
}

function imageFilesFromClipboard(data: DataTransfer | null) {
  if (!data) {
    return [];
  }

  const files = Array.from(data.files ?? []).filter((file) => file.type.startsWith("image/"));
  if (files.length > 0) {
    return files;
  }

  return Array.from(data.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

function isEmptyBlock(block: EditableBlock) {
  return block.text.trim().length === 0;
}

function RefreshIcon() {
  return <span className="text-sm leading-none">↻</span>;
}

function GridIcon() {
  return <span className="text-sm leading-none">▦</span>;
}

function MoreIcon() {
  return <span className="text-sm leading-none">⋯</span>;
}

function CommentIcon() {
  return <span className="text-sm leading-none">◫</span>;
}

function actionGlyph(label: string) {
  if (label === "复制") {
    return "⧉";
  }
  if (label === "删除") {
    return "🗑";
  }
  if (label === "上移") {
    return "↑";
  }
  if (label === "下移") {
    return "↓";
  }
  if (label === "在下方添加") {
    return "+";
  }
  return "•";
}

function LinkPreviewBlock({ block, readOnly }: { block: EditableBlock; readOnly: boolean }) {
  const preview = linkPreviewData(block);

  if (!preview.href && !preview.title) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-400">
        粘贴链接后会自动生成链接块
      </div>
    );
  }

  if (preview.view === "link") {
    return (
      <div className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <a
          href={preview.href || undefined}
          target="_blank"
          rel="noreferrer"
          className="inline text-base leading-8 text-sky-600 underline underline-offset-2 transition hover:text-sky-700"
        >
          {preview.href || preview.title}
        </a>
        {preview.status === "error" ? (
          <span className="text-xs leading-5 text-rose-500">链接信息抓取失败，可点击刷新重试。</span>
        ) : null}
      </div>
    );
  }

  const previewBody = (() => {
    if (preview.status === "loading") {
      return (
        <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-500">
          正在抓取链接信息...
        </div>
      );
    }

    if (preview.view === "title") {
      return (
        <a
          href={preview.href || undefined}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-slate-200 bg-white/85 px-4 py-3 transition hover:border-slate-300"
        >
          <div className="text-lg font-medium text-slate-900">{preview.title}</div>
          <div className="mt-1 text-sm text-slate-400">{preview.href}</div>
        </a>
      );
    }

    const card = (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/92 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        {preview.view === "preview" ? (
          preview.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.image} alt={preview.title} className="h-48 w-full object-cover" />
          ) : (
            <div className="flex h-36 items-center justify-center bg-slate-50 text-sm text-slate-400">
              {preview.siteName || "网页预览"}
            </div>
          )
        ) : null}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {preview.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.icon} alt="icon" className="h-4 w-4 rounded-sm" />
            ) : null}
            <span>{preview.siteName || preview.href}</span>
          </div>
          <div className="mt-1 text-base font-medium text-slate-900">{preview.title}</div>
          {preview.description ? (
            <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{preview.description}</div>
          ) : null}
          {preview.href ? <div className="mt-2 text-xs text-slate-400">{preview.href}</div> : null}
        </div>
      </div>
    );

    if (!preview.href) {
      return card;
    }

    return (
      <a href={preview.href} target="_blank" rel="noreferrer" className="block">
        {card}
      </a>
    );
  })();

  return (
    <div>
      {previewBody}
      {preview.status === "error" ? (
        <div className="mt-2 text-xs text-rose-500">链接信息抓取失败，可点击刷新重试。</div>
      ) : null}
    </div>
  );
}

function CodeBlockSurface({
  block,
  readOnly,
  isActive,
  textareaRef,
  onChange,
  onPaste,
  onFocus,
  onBlur,
  onMouseUp,
  onKeyDown,
  onLanguageChange,
  onWrapChange,
  onCollapsedChange,
  onHeightChange,
}: {
  block: EditableBlock;
  readOnly: boolean;
  isActive: boolean;
  textareaRef: (element: HTMLTextAreaElement | null) => void;
  onChange: (event: ReactChangeEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: (event: ReactFocusEvent<HTMLTextAreaElement>) => void;
  onMouseUp: (event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onLanguageChange: (language: string) => void;
  onWrapChange: (wrap: boolean) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onHeightChange: (height: number) => void;
}) {
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languageQuery, setLanguageQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [draggingHeight, setDraggingHeight] = useState(false);
  const language = sanitizeCodeLanguage(block.codeLanguage);
  const wrap = block.codeWrap ?? true;
  const collapsed = block.codeCollapsed ?? false;
  const codeHeight = sanitizeCodeHeight(block.codeHeight);
  const lines = Math.max(1, block.text.split("\n").length);
  const codeContentHeight = Math.max(codeHeight, lines * 24 + 16);
  const filteredLanguages = CODE_LANGUAGE_OPTIONS.filter((option) => {
    const query = languageQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return option.label.toLowerCase().includes(query) || option.value.includes(query);
  });

  const copyCode = () => {
    if (!block.text) {
      return;
    }
    void navigator.clipboard?.writeText(block.text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (readOnly) {
      return;
    }
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = codeHeight;
    setDraggingHeight(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      onHeightChange(sanitizeCodeHeight(startHeight + moveEvent.clientY - startY));
    };
    const handlePointerUp = () => {
      setDraggingHeight(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      className={`overflow-visible rounded-lg border bg-slate-50/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${
        isActive ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"
      }`}
    >
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-1.5">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <span className={`text-xs text-slate-400 transition ${collapsed ? "-rotate-90" : ""}`}>▾</span>
          <span>代码块</span>
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <div className="relative">
            <button
              type="button"
              className="flex h-7 min-w-[112px] items-center justify-between gap-2 rounded-md border border-transparent px-2 text-left text-xs text-slate-600 transition hover:border-slate-200 hover:bg-white"
              onClick={() => setLanguageMenuOpen((current) => !current)}
              disabled={readOnly}
            >
              <span className="truncate">{codeLanguageLabel(language)}</span>
              <span className="text-[10px] text-slate-400">⌄</span>
            </button>
            {languageMenuOpen ? (
              <div
                data-editor-floating-window="true"
                className="absolute right-0 top-[calc(100%+8px)] z-40 w-[214px] rounded-lg border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
              >
                <div className="border-b border-slate-100 p-2">
                  <label className="flex h-8 items-center gap-2 rounded-md border border-slate-200 px-2 text-slate-400">
                    <span>⌕</span>
                    <input
                      value={languageQuery}
                      onChange={(event) => setLanguageQuery(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                      placeholder="搜索"
                    />
                  </label>
                </div>
                <div className="max-h-[292px] overflow-y-auto p-1">
                  {filteredLanguages.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      className={`flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs transition ${
                        option.value === language ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => {
                        onLanguageChange(option.value);
                        setLanguageMenuOpen(false);
                        setLanguageQuery("");
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <label className="flex h-7 items-center gap-1.5 rounded-md px-1.5 transition hover:bg-white">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
              checked={wrap}
              onChange={(event) => onWrapChange(event.target.checked)}
              disabled={readOnly}
            />
            <span>自动换行</span>
          </label>
          <button
            type="button"
            className="flex h-7 items-center gap-1 rounded-md px-1.5 transition hover:bg-white hover:text-slate-800"
            onClick={copyCode}
          >
            <span>□</span>
            <span>{copied ? "已复制" : "复制"}</span>
          </button>
        </div>
      </div>
      {!collapsed ? (
        <div className="relative">
          <div
            className={`grid grid-cols-[44px_minmax(0,1fr)] overflow-y-auto ${wrap ? "" : "overflow-x-auto"}`}
            style={{ height: `${codeHeight}px` }}
          >
            <div
              className="select-none border-r border-slate-200/80 bg-white/45 px-3 py-2 text-right font-mono text-xs leading-6 text-slate-400"
              style={{ minHeight: `${codeContentHeight}px` }}
            >
              {Array.from({ length: lines }, (_, index) => (
                <div key={index}>{index + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={block.text}
              data-code-block-textarea="true"
              readOnly={readOnly}
              spellCheck={false}
              rows={Math.max(lines, 3)}
              wrap={wrap ? "soft" : "off"}
              placeholder="在这里输入代码"
              style={{ height: `${codeContentHeight}px` }}
              className={`w-full resize-none border-0 bg-transparent px-3 py-2 font-mono text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 ${
                wrap ? "whitespace-pre-wrap break-words" : "min-w-[720px] whitespace-pre"
              }`}
              onChange={onChange}
              onPaste={onPaste}
              onFocus={onFocus}
              onBlur={onBlur}
              onMouseUp={onMouseUp}
              onKeyDown={onKeyDown}
            />
          </div>
          {!readOnly ? (
            <button
              type="button"
              aria-label="调整代码块高度"
              title="拖拽调整代码块高度"
              onPointerDown={startResize}
              className={`absolute bottom-[-7px] left-1/2 h-4 w-16 -translate-x-1/2 cursor-ns-resize rounded-full border border-slate-300 bg-white shadow-sm transition hover:border-sky-300 hover:bg-sky-50 ${
                draggingHeight ? "border-sky-400 bg-sky-50" : ""
              }`}
            >
              <span className="mx-auto block h-0.5 w-8 rounded-full bg-slate-300" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ImagePreviewBlock({
  block,
  readOnly,
  selected,
  onSelect,
  onPreview,
  onRotate,
  onAlign,
  onDelete,
}: {
  block: EditableBlock;
  readOnly: boolean;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onRotate: () => void;
  onAlign: (align: "left" | "center" | "right") => void;
  onDelete: () => void;
}) {
  const preview = imageBlockData(block);
  const imageRotation = sanitizeImageRotation(block.imageRotation);
  const isSideways = imageRotation === 90 || imageRotation === 270;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageBox, setImageBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const updateImageBox = () => {
      const image = imageRef.current;
      const container = containerRef.current;
      if (!image) {
        return;
      }
      const naturalWidth = image.naturalWidth || image.offsetWidth;
      const naturalHeight = image.naturalHeight || image.offsetHeight;
      const containerWidth = Math.max(1, Math.floor(container?.clientWidth ?? 0));
      if (naturalWidth <= 0 || naturalHeight <= 0 || containerWidth <= 0) {
        return;
      }
      const maxVisualHeight = 520;
      const widthBound = isSideways ? naturalHeight : naturalWidth;
      const heightBound = isSideways ? naturalWidth : naturalHeight;
      const scale = Math.min(1, containerWidth / widthBound, maxVisualHeight / heightBound);
      const nextBox = {
        width: Math.max(1, Math.floor(naturalWidth * scale)),
        height: Math.max(1, Math.floor(naturalHeight * scale)),
      };
      setImageBox((current) =>
        current?.width === nextBox.width && current.height === nextBox.height ? current : nextBox,
      );
    };

    updateImageBox();
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && containerRef.current
        ? new ResizeObserver(updateImageBox)
        : null;
    if (containerRef.current) {
      resizeObserver?.observe(containerRef.current);
    }
    window.addEventListener("resize", updateImageBox);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateImageBox);
    };
  }, [isSideways, preview.src]);

  const figureStyle: CSSProperties | undefined = imageBox
    ? {
        width: `${isSideways ? imageBox.height : imageBox.width}px`,
        height: `${isSideways ? imageBox.width : imageBox.height}px`,
      }
    : undefined;

  if (!preview.src) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-400">
        粘贴图片后会显示在这里
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`mb-2 flex w-full min-w-0 ${imageAlignClassName(block.imageAlign)}`}>
      <figure
        className={`group/image relative overflow-visible rounded-lg bg-transparent ring-offset-2 ring-offset-white transition ${
          selected ? "ring-2 ring-sky-400" : "ring-0"
        }`}
        style={figureStyle}
      >
        {preview.src ? (
          <div
            className={`pointer-events-none absolute right-3 top-3 z-10 transition duration-150 ${
              selected ? "opacity-100" : "opacity-0 group-hover/image:opacity-100"
            }`}
          >
            <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm">
              {!readOnly ? (
                <>
                  <button
                    type="button"
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs ${block.imageAlign === "left" ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50"}`}
                    onClick={() => onAlign("left")}
                    title="左对齐"
                  >
                    左
                  </button>
                  <button
                    type="button"
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs ${(!block.imageAlign || block.imageAlign === "center") ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50"}`}
                    onClick={() => onAlign("center")}
                    title="居中"
                  >
                    中
                  </button>
                  <button
                    type="button"
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs ${block.imageAlign === "right" ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50"}`}
                    onClick={() => onAlign("right")}
                    title="右对齐"
                  >
                    右
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
                title="预览图片"
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview();
                }}
              >
                ⛶
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
                title="旋转预览"
                onClick={(event) => {
                  event.stopPropagation();
                  onRotate();
                }}
              >
                ↻
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
                onClick={() => {
                  void navigator.clipboard.writeText(preview.src);
                }}
                title="复制图片链接"
              >
                ⧉
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                  onClick={onDelete}
                  title="删除图片"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={preview.src}
          alt={preview.alt}
          className={`cursor-zoom-in rounded-lg bg-transparent object-contain ${
            imageBox ? "absolute left-1/2 top-1/2 max-w-none" : "max-h-[520px] max-w-full"
          }`}
          style={
            imageBox
              ? {
                  width: `${imageBox.width}px`,
                  height: `${imageBox.height}px`,
                  transform: `translate(-50%, -50%) rotate(${imageRotation}deg)`,
                }
              : { transform: `rotate(${imageRotation}deg)` }
          }
          onLoad={() => {
            const image = imageRef.current;
            const container = containerRef.current;
            if (!image) {
              return;
            }
            const naturalWidth = image.naturalWidth || image.offsetWidth;
            const naturalHeight = image.naturalHeight || image.offsetHeight;
            const containerWidth = Math.max(1, Math.floor(container?.clientWidth ?? 0));
            const widthBound = isSideways ? naturalHeight : naturalWidth;
            const heightBound = isSideways ? naturalWidth : naturalHeight;
            const scale = Math.min(1, containerWidth / widthBound, 520 / heightBound);
            const nextBox = {
              width: Math.max(1, Math.floor(naturalWidth * scale)),
              height: Math.max(1, Math.floor(naturalHeight * scale)),
            };
            if (nextBox.width > 0 && nextBox.height > 0) {
              setImageBox(nextBox);
            }
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (selected) {
              onPreview();
              return;
            }
            onSelect();
          }}
        />
      </figure>
    </div>
  );
}

function ImageLightbox({
  images,
  index,
  initialRotation = 0,
  onIndexChange,
  onClose,
}: {
  images: ImagePreviewData[];
  index: number;
  initialRotation?: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(initialRotation);
  const image = images[index];
  const canGoPrevious = index > 0;
  const canGoNext = index < images.length - 1;

  useEffect(() => {
    setScale(1);
    setRotation(initialRotation);
  }, [index, initialRotation]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && canGoPrevious) {
        event.preventDefault();
        onIndexChange(index - 1);
        return;
      }
      if (event.key === "ArrowRight" && canGoNext) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGoNext, canGoPrevious, index, onClose, onIndexChange]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  if (!image) {
    return null;
  }

  const boundedScale = Math.round(scale * 100);

  return (
    <div
      className="fixed inset-0 z-[160] overscroll-contain bg-[#030712]/94 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onTouchMove={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        aria-label="关闭图片预览"
        onClick={onClose}
      />
      <button
        type="button"
        className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl text-white backdrop-blur transition hover:bg-black/75"
        onClick={onClose}
        aria-label="关闭"
      >
        ×
      </button>
      {canGoPrevious ? (
        <button
          type="button"
          className="absolute left-5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur transition hover:bg-black/75"
          onClick={() => onIndexChange(index - 1)}
          aria-label="上一张"
        >
          ‹
        </button>
      ) : null}
      {canGoNext ? (
        <button
          type="button"
          className="absolute right-5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur transition hover:bg-black/75"
          onClick={() => onIndexChange(index + 1)}
          aria-label="下一张"
        >
          ›
        </button>
      ) : null}
      <div
        className="relative z-10 flex h-full w-full cursor-zoom-out items-center justify-center px-5 py-20"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          className="max-h-full max-w-full cursor-default rounded-lg object-contain shadow-[0_32px_110px_rgba(0,0,0,0.72)] transition-transform duration-150"
          style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
      <div
        className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/70 px-2 py-1 text-sm text-white shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="px-3 text-white/80">{index + 1}/{images.length}</span>
        <button
          type="button"
          className="h-8 rounded-full px-3 text-white/85 transition hover:bg-white/12 hover:text-white"
          onClick={() => setScale((value) => Math.max(0.25, Number((value - 0.25).toFixed(2))))}
        >
          -
        </button>
        <span className="min-w-14 text-center text-white/80">{boundedScale}%</span>
        <button
          type="button"
          className="h-8 rounded-full px-3 text-white/85 transition hover:bg-white/12 hover:text-white"
          onClick={() => setScale((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
        >
          +
        </button>
        <button
          type="button"
          className="h-8 rounded-full px-3 text-white/85 transition hover:bg-white/12 hover:text-white"
          onClick={() => setScale(1)}
        >
          适配
        </button>
        <button
          type="button"
          className="h-8 rounded-full px-3 text-white/85 transition hover:bg-white/12 hover:text-white"
          onClick={() => setRotation((value) => (value + 90) % 360)}
        >
          旋转
        </button>
        <a
          href={image.src}
          target="_blank"
          rel="noreferrer"
          className="h-8 rounded-full px-3 leading-8 text-white/85 transition hover:bg-white/12 hover:text-white"
        >
          原图
        </a>
        <a
          href={image.src}
          download
          className="h-8 rounded-full px-3 leading-8 text-white/85 transition hover:bg-white/12 hover:text-white"
        >
          下载
        </a>
      </div>
    </div>
  );
}

export function BlockEditor({
  blocks,
  onChange,
  readOnly = false,
  onResolveLinkPreview,
  onUploadImage,
  commentThreads = [],
  activeCommentThreadId = null,
  hoveredCommentThreadId = null,
  onActivateCommentThread,
  onHoverCommentThread,
  onCreateCommentSelection,
}: {
  blocks: EditableBlock[];
  onChange: (blocks: EditableBlock[]) => void;
  readOnly?: boolean;
  onResolveLinkPreview?: (blockId: string, url: string) => void | Promise<void>;
  onUploadImage?: (files: File[]) => Promise<UploadedImageAsset[]>;
  commentThreads?: CommentThread[];
  activeCommentThreadId?: string | null;
  hoveredCommentThreadId?: string | null;
  onActivateCommentThread?: (threadId: string) => void;
  onHoverCommentThread?: (threadId: string | null) => void;
  onCreateCommentSelection?: (anchor: CommentAnchor) => void;
}) {
  const [commandMenu, setCommandMenu] = useState<{
    blockId: string;
    mode: "slash" | "actions";
    query: string;
    selectedIndex: number;
  } | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{
    blockId: string;
    caret: number;
  } | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [visibleToolbarBlockId, setVisibleToolbarBlockId] = useState<string | null>(null);
  const [linkViewMenuBlockId, setLinkViewMenuBlockId] = useState<string | null>(null);
  const [closingCommandMenuBlockId, setClosingCommandMenuBlockId] = useState<string | null>(null);
  const [pinnedCommandMenuBlockId, setPinnedCommandMenuBlockId] = useState<string | null>(null);
  const [commandMenuPosition, setCommandMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbarState | null>(null);
  const [listMarkerToolbar, setListMarkerToolbar] = useState<{
    blockId: string;
    lineIndex: number;
    left: number;
    top: number;
  } | null>(null);
  const [selectedImageBlockId, setSelectedImageBlockId] = useState<string | null>(null);
  const [lightboxImageIndex, setLightboxImageIndex] = useState<number | null>(null);
  const [lightboxInitialRotation, setLightboxInitialRotation] = useState(0);
  const [pendingDeleteBlock, setPendingDeleteBlock] = useState<{
    blockId: string;
    kind: "block" | "image";
  } | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const handleButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hideToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideCommandMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandMenuFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandMenuRef = useRef<HTMLDivElement | null>(null);
  const linkViewMenuRef = useRef<HTMLDivElement | null>(null);

  const imagePreviews = useMemo<ImagePreviewData[]>(() => {
    return blocks
      .filter((block) => block.type === "image")
      .map((block) => {
        const preview = imageBlockData(block);
        return {
          blockId: block.id,
          src: preview.src,
          alt: preview.alt,
        };
      })
      .filter((image) => Boolean(image.src));
  }, [blocks]);

  const openImageLightbox = (blockId: string, initialRotation = 0) => {
    const imageIndex = imagePreviews.findIndex((image) => image.blockId === blockId);
    if (imageIndex < 0) {
      return;
    }
    setSelectedImageBlockId(blockId);
    setLightboxInitialRotation(initialRotation);
    setLightboxImageIndex(imageIndex);
  };

  useEffect(() => {
    return () => {
      if (hideToolbarTimerRef.current) {
        clearTimeout(hideToolbarTimerRef.current);
      }
      if (hideCommandMenuTimerRef.current) {
        clearTimeout(hideCommandMenuTimerRef.current);
      }
      if (commandMenuFadeTimerRef.current) {
        clearTimeout(commandMenuFadeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingFocus) {
      return;
    }

    const textarea = textareaRefs.current[pendingFocus.blockId];
    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(pendingFocus.caret, pendingFocus.caret);
    resizeTextarea(textarea);
    setPendingFocus(null);
  }, [blocks, pendingFocus]);

  useEffect(() => {
    Object.values(textareaRefs.current).forEach((textarea) => {
      resizeTextarea(textarea);
    });
  }, [blocks, readOnly]);

  useEffect(() => {
    if (selectedImageBlockId && !imagePreviews.some((image) => image.blockId === selectedImageBlockId)) {
      setSelectedImageBlockId(null);
    }
    if (lightboxImageIndex !== null && !imagePreviews[lightboxImageIndex]) {
      setLightboxImageIndex(null);
    }
  }, [imagePreviews, lightboxImageIndex, selectedImageBlockId]);

  useEffect(() => {
    const dismissSelection = () => setSelectionToolbar(null);
    window.addEventListener("scroll", dismissSelection, true);
    return () => {
      window.removeEventListener("scroll", dismissSelection, true);
    };
  }, []);

  useEffect(() => {
    if (!activeCommentThreadId) {
      return;
    }

    const thread = commentThreads.find((item) => item.id === activeCommentThreadId);
    if (!thread) {
      return;
    }

    const textarea = textareaRefs.current[thread.anchorBlockId];
    if (!textarea) {
      return;
    }

    const targetBlock = blocks.find((block) => block.id === thread.anchorBlockId);
    const blockForOffset = targetBlock ?? {
      id: thread.anchorBlockId,
      type: "paragraph" as const,
      text: textarea.value,
    };
    const start = Math.max(
      0,
      Math.min(displayOffsetFromBlockRawOffset(blockForOffset, thread.anchorStartOffset), textarea.value.length),
    );
    const end = Math.max(
      start,
      Math.min(displayOffsetFromBlockRawOffset(blockForOffset, thread.anchorEndOffset), textarea.value.length),
    );
    if (!readOnly) {
      setActiveBlockId(thread.anchorBlockId);
    }
    textarea.focus();
    textarea.scrollIntoView({ block: "center", behavior: "smooth" });
    textarea.setSelectionRange(start, end);
  }, [activeCommentThreadId, blocks, commentThreads, readOnly]);

  useEffect(() => {
    if (!linkViewMenuBlockId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (linkViewMenuRef.current && !linkViewMenuRef.current.contains(event.target as Node)) {
        setLinkViewMenuBlockId(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [linkViewMenuBlockId]);

  useEffect(() => {
    if (!commandMenu || commandMenu.mode !== "actions") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (commandMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      closeCommandMenuWithFade(commandMenu.blockId);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCommandMenuWithFade(commandMenu.blockId);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [commandMenu]);

  useEffect(() => {
    if (!commandMenu && !linkViewMenuBlockId && !visibleToolbarBlockId && !selectionToolbar && !listMarkerToolbar) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('[data-editor-floating-window="true"]')) {
        return;
      }

      const isBlockHandleClick = Object.values(handleButtonRefs.current).some((element) =>
        element?.contains(target),
      );
      if (isBlockHandleClick) {
        return;
      }

      if (commandMenu) {
        closeCommandMenuWithFade(commandMenu.blockId);
      }
      if (linkViewMenuBlockId) {
        setLinkViewMenuBlockId(null);
      }
      if (visibleToolbarBlockId) {
        setVisibleToolbarBlockId(null);
      }
      if (selectionToolbar) {
        setSelectionToolbar(null);
      }
      if (listMarkerToolbar) {
        setListMarkerToolbar(null);
      }
      setPinnedCommandMenuBlockId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [commandMenu, linkViewMenuBlockId, listMarkerToolbar, selectionToolbar, visibleToolbarBlockId]);

  useEffect(() => {
    if (!commandMenu || commandMenu.mode !== "actions") {
      setCommandMenuPosition(null);
      return;
    }

    const updateCommandMenuPosition = () => {
      const anchor = handleButtonRefs.current[commandMenu.blockId];
      const menu = commandMenuRef.current;
      if (!anchor || !menu) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 8;
      const menuWidth = menuRect.width || 300;
      const menuHeight = menuRect.height || 360;
      const fitsLeft = anchorRect.left - gap - menuWidth >= viewportPadding;

      let left = fitsLeft
        ? anchorRect.left - gap - menuWidth
        : anchorRect.right + gap;
      left = Math.min(
        Math.max(viewportPadding, left),
        Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
      );

      let top = anchorRect.top + anchorRect.height / 2 - 28;
      top = Math.min(
        Math.max(viewportPadding, top),
        Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding),
      );

      setCommandMenuPosition({ left, top });
    };

    updateCommandMenuPosition();
    window.addEventListener("resize", updateCommandMenuPosition);
    window.addEventListener("scroll", updateCommandMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateCommandMenuPosition);
      window.removeEventListener("scroll", updateCommandMenuPosition, true);
    };
  }, [commandMenu, blocks]);

  const updateBlock = (blockId: string, patch: Partial<EditableBlock>) => {
    onChange(blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  };

  const updateOrderedListBlockAndResetFollowing = (index: number, patch: Partial<EditableBlock>) => {
    const nextBlocks = blocks.map((block, blockIndex) => {
      if (blockIndex === index) {
        return { ...block, ...patch };
      }
      if (blockIndex > index && block.type === "ordered_list" && blocks[blockIndex - 1]?.type === "ordered_list") {
        return {
          ...block,
          orderedListStart: undefined,
          orderedListStartOverrides: undefined,
        };
      }
      return block;
    });
    onChange(nextBlocks);
  };

  const changeBlockIndent = (blockId: string, direction: 1 | -1) => {
    onChange(
      blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              indent: sanitizeIndent(sanitizeIndent(block.indent) + direction),
            }
          : block,
      ),
    );
  };

  const updateLinkMeta = (blockId: string, patch: Partial<LinkCardMeta>) => {
    onChange(
      blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              meta: {
                ...block.meta,
                ...patch,
              },
            }
          : block,
      ),
    );
  };

  const updateImageAlign = (blockId: string, align: "left" | "center" | "right") => {
    onChange(blocks.map((block) => (block.id === blockId ? { ...block, imageAlign: align } : block)));
  };

  const rotateImageBlock = (blockId: string) => {
    onChange(
      blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              imageRotation: sanitizeImageRotation(sanitizeImageRotation(block.imageRotation) + 90),
            }
          : block,
      ),
    );
  };

  const showToolbar = (blockId: string) => {
    if (hideToolbarTimerRef.current) {
      clearTimeout(hideToolbarTimerRef.current);
      hideToolbarTimerRef.current = null;
    }
    setVisibleToolbarBlockId(blockId);
  };

  const hideToolbarWithDelay = (blockId: string) => {
    if (hideToolbarTimerRef.current) {
      clearTimeout(hideToolbarTimerRef.current);
    }
    hideToolbarTimerRef.current = setTimeout(() => {
      setVisibleToolbarBlockId((current) => (current === blockId ? null : current));
      hideToolbarTimerRef.current = null;
    }, 1500);
  };

  const cancelCommandMenuHide = () => {
    if (hideCommandMenuTimerRef.current) {
      clearTimeout(hideCommandMenuTimerRef.current);
      hideCommandMenuTimerRef.current = null;
    }
    if (commandMenuFadeTimerRef.current) {
      clearTimeout(commandMenuFadeTimerRef.current);
      commandMenuFadeTimerRef.current = null;
    }
    setClosingCommandMenuBlockId(null);
  };

  const openActionsMenu = (blockId: string) => {
    cancelCommandMenuHide();
    setCommandMenu((value) =>
      value?.blockId === blockId && value.mode === "slash"
        ? value
        : {
            blockId,
            mode: "actions",
            query: "",
            selectedIndex: 0,
        },
    );
  };

  const closeCommandMenuWithFade = (blockId: string) => {
    cancelCommandMenuHide();
    setPinnedCommandMenuBlockId((current) => (current === blockId ? null : current));
    setClosingCommandMenuBlockId(blockId);
    commandMenuFadeTimerRef.current = setTimeout(() => {
      setCommandMenu((current) => (current?.blockId === blockId ? null : current));
      setClosingCommandMenuBlockId((current) => (current === blockId ? null : current));
      commandMenuFadeTimerRef.current = null;
    }, 180);
  };

  const hideCommandMenuWithDelay = (blockId: string) => {
    cancelCommandMenuHide();
    hideCommandMenuTimerRef.current = setTimeout(() => {
      hideCommandMenuTimerRef.current = null;
      closeCommandMenuWithFade(blockId);
    }, 1000);
  };

  const focusBlock = (blockId: string, caret: number) => {
    setPendingFocus({ blockId, caret });
  };

  const insertBlock = (index: number, type: EditableBlockType = "paragraph") => {
    const nextBlocks = [...blocks];
    nextBlocks.splice(index, 0, {
      id: createClientId(),
      type,
      text: defaultTextByType(type),
      headingLevel: type === "heading" ? 1 : undefined,
      meta: defaultMetaByType(type),
    });
    onChange(nextBlocks);
  };

  const insertParagraphAfterBlock = (index: number) => {
    const nextBlockId = createClientId();
    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, {
      id: nextBlockId,
      type: "paragraph",
      text: "",
    });
    onChange(nextBlocks);
    focusBlock(nextBlockId, 0);
  };

  const removeBlock = (blockId: string) => {
    const nextBlocks = blocks.filter((block) => block.id !== blockId);
    onChange(
      nextBlocks.length > 0
        ? nextBlocks
        : [{ id: createClientId(), type: "paragraph", text: "" }],
    );
  };

  const removeBlockAndFocusNeighbor = (index: number) => {
    const current = blocks[index];
    if (!current) {
      return;
    }

    const previous = blocks[index - 1];
    const next = blocks[index + 1];
    if (!previous && !next) {
      updateBlock(current.id, { text: "", type: "paragraph", indent: 0 });
      focusBlock(current.id, 0);
      return;
    }

    const nextBlocks = blocks.filter((block) => block.id !== current.id);
    onChange(nextBlocks);
    if (previous) {
      focusBlock(previous.id, previous.text.length);
      return;
    }
    if (next) {
      focusBlock(next.id, 0);
    }
  };

  const requestDeleteBlock = (blockId: string, kind: "block" | "image" = "block") => {
    setPendingDeleteBlock({ blockId, kind });
  };

  const confirmDeleteBlock = () => {
    if (!pendingDeleteBlock) {
      return;
    }
    removeBlock(pendingDeleteBlock.blockId);
    closeCommandMenu();
    setPendingDeleteBlock(null);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) {
      return;
    }

    const nextBlocks = [...blocks];
    const [current] = nextBlocks.splice(index, 1);
    nextBlocks.splice(nextIndex, 0, current);
    onChange(nextBlocks);
  };

  const duplicateBlock = (index: number) => {
    const target = blocks[index];
    if (!target) {
      return;
    }

    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, {
      ...target,
      id: createClientId(),
      meta: target.meta ? { ...target.meta } : undefined,
    });
    onChange(nextBlocks);
  };

  const moveBlockToIndex = (blockId: string, targetIndex: number) => {
    const currentIndex = blocks.findIndex((block) => block.id === blockId);
    if (currentIndex < 0) {
      return;
    }

    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, blocks.length - 1));
    if (currentIndex === boundedTargetIndex) {
      return;
    }

    const nextBlocks = [...blocks];
    const [movingBlock] = nextBlocks.splice(currentIndex, 1);
    nextBlocks.splice(boundedTargetIndex, 0, movingBlock);
    onChange(nextBlocks);
  };

  const orderedNumberForBlockIndex = (targetIndex: number) => {
    let currentNumber = 1;
    for (let index = 0; index <= targetIndex; index += 1) {
      const item = blocks[index];
      if (!item || item.type !== "ordered_list") {
        currentNumber = 1;
        continue;
      }
      currentNumber =
        item.orderedListStart !== undefined
          ? sanitizeOrderedListStart(item.orderedListStart)
          : index > 0 && blocks[index - 1]?.type === "ordered_list"
            ? currentNumber
            : 1;
      if (index === targetIndex) {
        return currentNumber;
      }
      currentNumber += 1;
    }
    return 1;
  };

  const splitBlock = (index: number, selectionStart: number, selectionEnd: number) => {
    const current = blocks[index];
    if (!current) {
      return;
    }

    const before = current.text.slice(0, selectionStart);
    const after = current.text.slice(selectionEnd);
    const nextBlockId = createClientId();
    const currentText = before || fallbackSplitText();
    const nextText = after || fallbackSplitText();

    const nextBlocks = [...blocks];
    nextBlocks.splice(index, 1, {
      ...current,
      text: currentText,
      meta: current.meta ? { ...current.meta } : undefined,
    });
    nextBlocks.splice(index + 1, 0, {
      id: nextBlockId,
      type: current.type,
      text: nextText,
      headingLevel: current.headingLevel,
      orderedListStart: undefined,
      meta: current.type === "link" ? { ...(current.meta ?? {}), status: "idle" } : current.meta ? { ...current.meta } : undefined,
    });

    onChange(nextBlocks);
    focusBlock(nextBlockId, after ? 0 : nextText.length);
  };

  const listLineAtCaret = (value: string, caret: number) => {
    const safeCaret = Math.max(0, Math.min(caret, value.length));
    const lineStart = value.lastIndexOf("\n", Math.max(0, safeCaret - 1)) + 1;
    const nextLineBreak = value.indexOf("\n", safeCaret);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const linesBefore = value.slice(0, lineStart).split("\n").length - 1;
    const totalLines = value.split("\n").length;
    return {
      lineStart,
      lineEnd,
      nextLineBreak,
      line: value.slice(lineStart, lineEnd),
      lineIndex: linesBefore,
      totalLines,
    };
  };

  const splitListAroundLine = (block: EditableBlock, value: string, lineStart: number, nextLineBreak: number) => {
    return {
      beforeText: value.slice(0, lineStart).replace(/\n$/, ""),
      afterText: nextLineBreak === -1 ? "" : value.slice(nextLineBreak + 1),
    };
  };

  const replaceListLineWithParagraph = (
    block: EditableBlock,
    index: number,
    paragraphText: string,
    beforeText: string,
    afterText: string,
    focusCaret: number,
  ) => {
    const paragraphId = createClientId();
    const replacementBlocks: EditableBlock[] = [];

    if (beforeText) {
      replacementBlocks.push({
        ...block,
        text: beforeText,
        meta: block.meta ? { ...block.meta } : undefined,
      });
    }

    replacementBlocks.push({
      id: paragraphId,
      type: "paragraph",
      text: paragraphText,
      indent: block.indent,
    });

    if (afterText) {
      replacementBlocks.push({
        ...block,
        id: createClientId(),
        text: afterText,
        meta: block.meta ? { ...block.meta } : undefined,
      });
    }

    const nextBlocks = [...blocks];
    nextBlocks.splice(index, 1, ...replacementBlocks);
    onChange(nextBlocks);
    focusBlock(paragraphId, focusCaret);
  };

  const exitEmptyListLine = (block: EditableBlock, index: number, value: string, caret: number) => {
    if (block.type !== "ordered_list" && block.type !== "bullet_list") {
      return false;
    }

    const lineInfo = listLineAtCaret(value, caret);
    if (caret !== lineInfo.lineStart || lineInfo.line.trim()) {
      return false;
    }

    const { beforeText, afterText } = splitListAroundLine(block, value, lineInfo.lineStart, lineInfo.nextLineBreak);
    replaceListLineWithParagraph(block, index, "", beforeText, afterText, 0);
    return true;
  };

  const deleteEmptyListLine = (block: EditableBlock, index: number, value: string, caret: number) => {
    if (block.type !== "ordered_list" && block.type !== "bullet_list") {
      return false;
    }

    const lineInfo = listLineAtCaret(value, caret);
    if (caret !== lineInfo.lineStart || lineInfo.line.trim()) {
      return false;
    }

    const { beforeText, afterText } = splitListAroundLine(block, value, lineInfo.lineStart, lineInfo.nextLineBreak);
    const nextText = [beforeText, afterText].filter((part) => part.length > 0).join("\n");
    if (!nextText) {
      updateBlock(block.id, { type: "paragraph", text: "" });
      focusBlock(block.id, 0);
      return true;
    }

    updateBlock(block.id, { text: nextText });
    focusBlock(block.id, beforeText.length);
    return true;
  };

  const mergeListLineBackward = (block: EditableBlock, index: number, value: string, caret: number) => {
    if (block.type !== "ordered_list" && block.type !== "bullet_list") {
      return false;
    }

    const lineInfo = listLineAtCaret(value, caret);
    if (caret !== lineInfo.lineStart || !lineInfo.line.trim()) {
      return false;
    }

    if (lineInfo.lineIndex === 0) {
      const { afterText } = splitListAroundLine(block, value, lineInfo.lineStart, lineInfo.nextLineBreak);
      replaceListLineWithParagraph(block, index, lineInfo.line, "", afterText, 0);
      return true;
    }

    const previousLineEnd = lineInfo.lineStart - 1;
    const nextText = `${value.slice(0, previousLineEnd)}${lineInfo.line}${value.slice(lineInfo.lineEnd)}`;
    updateBlock(block.id, { text: nextText });
    focusBlock(block.id, previousLineEnd);
    return true;
  };

  const caretStartForListLine = (value: string, lineIndex: number) => {
    const lines = value.split("\n");
    const boundedIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
    return lines.slice(0, boundedIndex).join("\n").length + (boundedIndex > 0 ? 1 : 0);
  };

  const openListMarkerToolbar = (
    block: EditableBlock,
    lineIndex: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (readOnly || (block.type !== "ordered_list" && block.type !== "bullet_list")) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const toolbarWidth = 174;
    const left = Math.min(
      Math.max(8, rect.left - 6),
      Math.max(8, window.innerWidth - toolbarWidth - 8),
    );
    const top = Math.min(
      Math.max(8, rect.bottom + 6),
      Math.max(8, window.innerHeight - 56),
    );
    setListMarkerToolbar({ blockId: block.id, lineIndex, left, top });
    setActiveBlockId(block.id);
    focusBlock(block.id, caretStartForListLine(block.text, lineIndex));
  };

  const startNewOrderedList = (block: EditableBlock, index: number, lineIndex: number) => {
    if (block.type !== "ordered_list") {
      return;
    }

    const lines = block.text.split("\n");
    const boundedLineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
    const overrides = sanitizeOrderedListStartOverrides(block.orderedListStartOverrides, lines.length);
    if (boundedLineIndex === 0) {
      updateOrderedListBlockAndResetFollowing(index, {
        orderedListStart: 1,
        orderedListStartOverrides: sanitizeOrderedListStartOverrides(overrides, lines.length),
      });
    } else {
      updateOrderedListBlockAndResetFollowing(index, {
        orderedListStartOverrides: {
          ...overrides,
          [boundedLineIndex]: 1,
        },
      });
    }
    setListMarkerToolbar(null);
    focusBlock(block.id, caretStartForListLine(block.text, boundedLineIndex));
  };

  const changeOrderedListValue = (block: EditableBlock, index: number, lineIndex: number) => {
    if (!block || block.type !== "ordered_list") {
      return;
    }

    const currentValue = orderedNumberForBlockIndex(index);
    const nextValue = window.prompt("修改编号值", String(currentValue));
    if (nextValue === null) {
      return;
    }

    const parsedValue = Number(nextValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return;
    }

    const nextStart = sanitizeOrderedListStart(parsedValue);
    const lines = block.text.split("\n");
    const boundedLineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
    const overrides = sanitizeOrderedListStartOverrides(block.orderedListStartOverrides, lines.length);
    if (boundedLineIndex === 0) {
      updateOrderedListBlockAndResetFollowing(index, {
        orderedListStart: nextStart,
        orderedListStartOverrides: sanitizeOrderedListStartOverrides(overrides, lines.length),
      });
      setListMarkerToolbar(null);
      return;
    }

    updateOrderedListBlockAndResetFollowing(index, {
      orderedListStartOverrides: {
        ...overrides,
        [boundedLineIndex]: nextStart,
      },
    });
    setListMarkerToolbar(null);
    focusBlock(block.id, caretStartForListLine(block.text, boundedLineIndex));
  };

  const continuePreviousOrderedList = (block: EditableBlock, index: number) => {
    if (block.type !== "ordered_list") {
      return;
    }

    const previousOrderedBlock = blocks[index - 1];
    if (previousOrderedBlock?.type !== "ordered_list") {
      return;
    }
    if (!previousOrderedBlock) {
      return;
    }

    updateOrderedListBlockAndResetFollowing(index, {
      orderedListStart: undefined,
      orderedListStartOverrides: sanitizeOrderedListStartOverrides(
        block.orderedListStartOverrides,
        block.text.split("\n").length,
      ),
    });
    setListMarkerToolbar(null);
    focusBlock(block.id, 0);
  };

  const insertStructuredBlocksFromPaste = (
    index: number,
    selectionStart: number,
    selectionEnd: number,
    pastedText: string,
    pastedHtml?: string,
  ) => {
    const current = blocks[index];
    if (!current) {
      return false;
    }

    const parsedBlocks = (pastedHtml ? parsePastedHtmlToBlocks(pastedHtml) : null) ?? parsePastedTextToBlocks(pastedText);
    if (parsedBlocks.length <= 1) {
      return false;
    }

    const before = current.text.slice(0, selectionStart);
    const after = current.text.slice(selectionEnd);
    const firstBlock = parsedBlocks[0];
    const lastBlock = parsedBlocks[parsedBlocks.length - 1];
    const mergedFirstText = `${before}${firstBlock.text}`;
    const mergedLastText = `${lastBlock.text}${after}`;

    const nextBlocks = [...blocks];
    nextBlocks.splice(
      index,
      1,
      {
        ...firstBlock,
        text: mergedFirstText,
      },
      ...parsedBlocks.slice(1, -1),
      {
        ...lastBlock,
        text: mergedLastText,
      },
    );

    onChange(nextBlocks);
    const lastInsertedBlock = nextBlocks[index + parsedBlocks.length - 1];
    focusBlock(lastInsertedBlock.id, mergedLastText.length);
    return true;
  };

  const insertUploadedImages = async (index: number, files: File[]) => {
    if (!onUploadImage || files.length === 0) {
      return;
    }

    const uploadedAssets = await onUploadImage(files);
    if (uploadedAssets.length === 0) {
      return;
    }

    const current = blocks[index];
    if (!current) {
      return;
    }

    const imageBlocks = uploadedAssets.map((asset) =>
      createBlock("image", `${asset.file_name} | ${asset.file_url}`),
    );

    const shouldReplaceCurrent = !current.text.trim() && current.type === "paragraph";
    const nextBlocks = [...blocks];
    const focusTarget =
      imageBlocks.length > 0
        ? createBlock("paragraph", "")
        : null;

    if (shouldReplaceCurrent) {
      nextBlocks.splice(index, 1, ...imageBlocks);
      if (focusTarget) {
        nextBlocks.splice(index + imageBlocks.length, 0, focusTarget);
      }
    } else {
      nextBlocks.splice(index + 1, 0, ...imageBlocks);
      if (focusTarget) {
        nextBlocks.splice(index + 1 + imageBlocks.length, 0, focusTarget);
      }
    }

    onChange(nextBlocks);
    if (focusTarget) {
      focusBlock(focusTarget.id, 0);
    }
  };

  const moveCaretToNeighbor = (
    index: number,
    direction: "previous" | "next",
    caret: "start" | "end",
  ) => {
    const targetIndex = direction === "previous" ? index - 1 : index + 1;
    const target = blocks[targetIndex];
    if (!target) {
      return;
    }

    focusBlock(target.id, caret === "start" ? 0 : target.text.length);
  };

  const applyCommand = (
    blockId: string,
    type: EditableBlockType,
    options?: {
      preserveContent?: boolean;
      headingLevel?: number;
    },
  ) => {
    onChange(
      blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              type,
              text: options?.preserveContent ? block.text : defaultTextByType(type),
              headingLevel:
                type === "heading"
                  ? sanitizeHeadingLevel(options?.headingLevel ?? block.headingLevel ?? 1)
                  : undefined,
              orderedListStart: type === "ordered_list" ? sanitizeOrderedListStart(block.orderedListStart) : undefined,
              meta: type === "link" ? { ...(block.meta ?? {}), ...(defaultMetaByType(type) ?? {}) } : undefined,
            }
          : block,
      ),
    );
    setCommandMenu(null);
  };

  const filteredCommands = useMemo(() => {
    if (!commandMenu) {
      return [];
    }

    return filterCommands(commandMenu.query);
  }, [commandMenu]);

  const closeCommandMenu = () => {
    cancelCommandMenuHide();
    setPinnedCommandMenuBlockId(null);
    if (commandMenu?.blockId) {
      hideToolbarWithDelay(commandMenu.blockId);
    }
    setCommandMenu(null);
  };

  const commentsByBlockId = useMemo(() => {
    return commentThreads.reduce<Record<string, CommentThread[]>>((accumulator, thread) => {
      accumulator[thread.anchorBlockId] = [...(accumulator[thread.anchorBlockId] ?? []), thread];
      return accumulator;
    }, {});
  }, [commentThreads]);

  const openSelectionToolbar = (
    blockId: string,
    value: string,
    start: number,
    end: number,
    clientX: number,
    clientY: number,
  ) => {
    const nextToolbar = buildSelectionToolbarState(blockId, value, start, end, clientX, clientY);
    if (!nextToolbar) {
      setSelectionToolbar(null);
      return;
    }
    setSelectionToolbar(nextToolbar);
  };

  const handleTextSurfaceChange = (block: EditableBlock) => (event: ReactChangeEvent<HTMLTextAreaElement>) => {
    if (block.type !== "code_block") {
      resizeTextarea(event.currentTarget);
    }
    if (readOnly) {
      return;
    }

    const value =
      block.type === "ordered_list" || block.type === "bullet_list"
        ? event.target.value.replace(/\r?\n/g, " ")
        : event.target.value;
    if (block.type === "link") {
      const parsed = parseLinkSource(value);
      onChange(
        blocks.map((item) =>
          item.id === block.id
            ? {
                ...item,
                text: value,
                meta: {
                  ...item.meta,
                  href: parsed.href || item.meta?.href,
                  title: parsed.title || item.meta?.title,
                  siteName:
                    item.meta?.siteName ||
                    (parsed.href ? inferSiteNameFromHref(parsed.href) : undefined),
                  view: item.meta?.view || "link",
                  status: item.meta?.status || (parsed.href ? "idle" : "idle"),
                },
              }
            : item,
        ),
      );
    } else if (block.type === "check_list") {
      updateBlock(block.id, {
        text: buildCheckListRawText(block.text, value),
      });
    } else {
      updateBlock(block.id, { text: value });
    }

    if (block.type === "code_block") {
      if (commandMenu?.blockId === block.id) {
        setCommandMenu(null);
      }
      return;
    }

    const query = commandQuery(value);
    if (query !== null) {
      setCommandMenu({
        blockId: block.id,
        mode: "slash",
        query,
        selectedIndex: 0,
      });
      return;
    }

    if (commandMenu?.blockId === block.id) {
      setCommandMenu(null);
    }
  };

  const handleTextSurfacePaste =
    (block: EditableBlock, index: number) =>
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) {
        return;
      }

      const imageFiles = imageFilesFromClipboard(event.clipboardData);
      if (imageFiles.length > 0) {
        event.preventDefault();
        void insertUploadedImages(index, imageFiles);
        return;
      }

      const pastedText = event.clipboardData.getData("text/plain").trim();
      const rawPastedText = event.clipboardData.getData("text/plain");
      const pastedHtml = event.clipboardData.getData("text/html");
      const normalizedHref = normalizeExternalHref(pastedText);
      if (block.type === "code_block") {
        return;
      }
      if (!normalizedHref || event.currentTarget.value.trim()) {
        const handled = insertStructuredBlocksFromPaste(
          index,
          event.currentTarget.selectionStart,
          event.currentTarget.selectionEnd,
          rawPastedText,
          pastedHtml,
        );
        if (handled) {
          event.preventDefault();
        }
        return;
      }

      event.preventDefault();
      onChange(
        blocks.map((item) =>
          item.id === block.id
            ? {
                ...item,
                type: "link",
                text: normalizedHref,
                meta: {
                  href: normalizedHref,
                  title: inferSiteNameFromHref(normalizedHref),
                  siteName: inferSiteNameFromHref(normalizedHref),
                  view: "link",
                  status: "loading",
                },
              }
            : item,
        ),
      );
      void onResolveLinkPreview?.(block.id, normalizedHref);
    };

  const handleTextSurfaceFocus = (block: EditableBlock) => () => {
    if (readOnly) {
      return;
    }
    setSelectedImageBlockId(null);
    setActiveBlockId(block.id);
    if (block.type === "code_block") {
      setCommandMenu(null);
      return;
    }
    const query = commandQuery(block.text);
    if (query !== null) {
      setCommandMenu({
        blockId: block.id,
        mode: "slash",
        query,
        selectedIndex: 0,
      });
    }
  };

  const handleTextSurfaceBlur = (block: EditableBlock) => (event: ReactFocusEvent<HTMLTextAreaElement>) => {
    setActiveBlockId((current) => (current === block.id ? null : current));
    if (readOnly || block.type !== "link") {
      return;
    }
    const parsed = parseLinkSource(event.currentTarget.value);
    const currentHref = parsed.href || block.meta?.href || "";
    if (currentHref && (block.meta?.href !== currentHref || block.meta?.status !== "ready")) {
      void onResolveLinkPreview?.(block.id, currentHref);
    }
  };

  const handleToggleCheckListLine = (block: EditableBlock, lineIndex: number) => {
    if (readOnly) {
      return;
    }
    updateBlock(block.id, {
      text: toggleCheckListLine(block.text, lineIndex),
    });
  };

  const handleTextSurfaceMouseUp =
    (block: EditableBlock, blockCommentRanges: TextCommentRange[]) =>
    (event: ReactMouseEvent<HTMLTextAreaElement>) => {
      if (!onCreateCommentSelection) {
        return;
      }
      const target = event.currentTarget;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      if (start === end) {
        setSelectionToolbar(null);
        const threadId = threadIdAtOffset(blockCommentRanges, start);
        if (threadId) {
          onActivateCommentThread?.(threadId);
        }
        return;
      }
      const rawStart = rawOffsetFromBlockDisplayOffset(block, start);
      const rawEnd = rawOffsetFromBlockDisplayOffset(block, end);
      openSelectionToolbar(block.id, block.text, rawStart, rawEnd, event.clientX, event.clientY);
    };

  const handleTextSurfaceKeyDown =
    (block: EditableBlock, index: number) =>
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) {
        return;
      }
      const selectionStart = event.currentTarget.selectionStart;
      const selectionEnd = event.currentTarget.selectionEnd;
      const hasSelection = selectionStart !== selectionEnd;
      const currentLength = event.currentTarget.value.length;

      if (block.type === "code_block") {
        if (event.key === "Tab") {
          event.preventDefault();
          const indent = "  ";
          const value = event.currentTarget.value;
          const nextValue = `${value.slice(0, selectionStart)}${indent}${value.slice(selectionEnd)}`;
          updateBlock(block.id, { text: nextValue });
          focusBlock(block.id, selectionStart + indent.length);
          return;
        }
        return;
      }

      if (
        event.key === "Backspace" &&
        !hasSelection &&
        selectionStart === 0 &&
        sanitizeIndent(block.indent) > 0
      ) {
        event.preventDefault();
        changeBlockIndent(block.id, -1);
        return;
      }

      if (
        event.key === "Backspace" &&
        !hasSelection &&
        deleteEmptyListLine(block, index, event.currentTarget.value, selectionStart)
      ) {
        event.preventDefault();
        return;
      }

      if (
        event.key === "Backspace" &&
        !hasSelection &&
        mergeListLineBackward(block, index, event.currentTarget.value, selectionStart)
      ) {
        event.preventDefault();
        return;
      }

      if (
        event.key === "Backspace" &&
        !hasSelection &&
        selectionStart === 0 &&
        !event.currentTarget.value.trim()
      ) {
        event.preventDefault();
        removeBlockAndFocusNeighbor(index);
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        changeBlockIndent(block.id, event.shiftKey ? -1 : 1);
        return;
      }

      const directQuery = commandQuery(event.currentTarget.value);
      if (event.key === "Enter" && !event.shiftKey && directQuery !== null) {
        event.preventDefault();
        event.stopPropagation();
        const directCommands = filterCommands(directQuery);
        const selectedIndex = commandMenu?.blockId === block.id ? commandMenu.selectedIndex : 0;
        const command = directCommands[selectedIndex] ?? directCommands[0];
        if (command) {
          applyCommand(block.id, command.type);
        }
        return;
      }

      if (!hasSelection) {
        if (event.key === "ArrowUp" && selectionStart === 0) {
          event.preventDefault();
          moveCaretToNeighbor(index, "previous", "end");
          return;
        }

        if (event.key === "ArrowLeft" && selectionStart === 0) {
          event.preventDefault();
          moveCaretToNeighbor(index, "previous", "end");
          return;
        }

        if (event.key === "ArrowDown" && selectionStart === currentLength) {
          event.preventDefault();
          moveCaretToNeighbor(index, "next", "start");
          return;
        }

        if (event.key === "ArrowRight" && selectionStart === currentLength) {
          event.preventDefault();
          moveCaretToNeighbor(index, "next", "start");
          return;
        }
      }

      if (commandMenu?.blockId === block.id && commandMenu.mode === "slash" && filteredCommands.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setCommandMenu((value) =>
            value
              ? {
                  ...value,
                  selectedIndex: (value.selectedIndex + 1) % filteredCommands.length,
                }
              : value,
          );
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setCommandMenu((value) =>
            value
              ? {
                  ...value,
                  selectedIndex:
                    (value.selectedIndex - 1 + filteredCommands.length) % filteredCommands.length,
                }
              : value,
          );
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          const command = filteredCommands[commandMenu.selectedIndex] ?? filteredCommands[0];
          if (command) {
            applyCommand(block.id, command.type);
          }
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setCommandMenu(null);
          return;
        }
      }

      const liveQuery = commandMenu?.blockId === block.id ? commandMenu.query : directQuery;
      const liveCommands = liveQuery === null ? [] : filterCommands(liveQuery);

      if (liveQuery !== null && liveCommands.length > 0) {
        if (!commandMenu || commandMenu.blockId !== block.id) {
          setCommandMenu({
            blockId: block.id,
            mode: "slash",
            query: liveQuery,
            selectedIndex: 0,
          });
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setCommandMenu((value) =>
            value
              ? {
                  ...value,
                  selectedIndex: (value.selectedIndex + 1) % liveCommands.length,
                }
              : value,
          );
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setCommandMenu((value) =>
            value
              ? {
                  ...value,
                  selectedIndex: (value.selectedIndex - 1 + liveCommands.length) % liveCommands.length,
                }
              : value,
          );
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          const command = liveCommands[0];
          if (command) {
            applyCommand(block.id, command.type);
          }
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setCommandMenu(null);
          return;
        }
      } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        if (block.type === "ordered_list" || block.type === "bullet_list" || block.type === "check_list") {
          event.preventDefault();
          if (!event.currentTarget.value.trim()) {
            updateBlock(block.id, {
              type: "paragraph",
              text: "",
              orderedListStart: undefined,
              orderedListStartOverrides: undefined,
            });
            focusBlock(block.id, 0);
            return;
          }
          splitBlock(index, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
          return;
        }
        event.preventDefault();
        splitBlock(index, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
      }
    };

  const handleNonTextBlockKeyDown =
    (block: EditableBlock, index: number) =>
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (readOnly || event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
        return;
      }
      if (event.target !== event.currentTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      insertParagraphAfterBlock(index);
      setActiveBlockId(null);
      setSelectedImageBlockId(null);
    };

  return (
    <div className="space-y-1">
      {blocks.map((block, index) => {
        const preview = block.type === "link" ? linkPreviewData(block) : null;
        const showLinkToolbar =
          !readOnly &&
          block.type === "link" &&
          (activeBlockId === block.id ||
            visibleToolbarBlockId === block.id ||
            linkViewMenuBlockId === block.id ||
            commandMenu?.blockId === block.id);
        const blockThreads = commentsByBlockId[block.id] ?? [];
        const hasActiveThread = blockThreads.some((thread) => thread.id === activeCommentThreadId);
        const hasHoveredThread = blockThreads.some((thread) => thread.id === hoveredCommentThreadId);
        const displayText = displayTextForBlock(block);
        const orderedListStart =
          block.type === "ordered_list" ? orderedNumberForBlockIndex(index) : undefined;
        const showsTextSurface = showsUnifiedTextSurface(block, readOnly);
        const usesCodeSurface = block.type === "code_block";
        const canFocusWrapper = !readOnly && !showsTextSurface && !usesCodeSurface;
        const blockCommentRanges = blockThreads.map((thread) => ({
          id: thread.id,
          start: displayOffsetFromBlockRawOffset(block, thread.anchorStartOffset),
          end: displayOffsetFromBlockRawOffset(block, thread.anchorEndOffset),
          active: thread.id === activeCommentThreadId || thread.id === hoveredCommentThreadId,
        }));
        return (
          <div
            id={block.id}
            key={block.id}
            data-block-id={block.id}
            className={`group relative ${
              dropTargetId === block.id
                ? "before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-sky-400"
                : ""
            }`}
            onPointerEnter={() => {
              if (readOnly) {
                return;
              }
              showToolbar(block.id);
            }}
            onPointerLeave={() => {
              if (readOnly) {
                return;
              }
              if (pinnedCommandMenuBlockId === block.id) {
                return;
              }
              if (commandMenu?.blockId === block.id) {
                hideCommandMenuWithDelay(block.id);
              }
              if (linkViewMenuBlockId === block.id) {
                return;
              }
              hideToolbarWithDelay(block.id);
            }}
            onDragOver={(event) => {
              if (!draggingBlockId || draggingBlockId === block.id) {
                return;
              }
              event.preventDefault();
              setDropTargetId(block.id);
            }}
            onDrop={(event) => {
              if (!draggingBlockId || draggingBlockId === block.id) {
                return;
              }
              event.preventDefault();
              moveBlockToIndex(draggingBlockId, index);
              setDraggingBlockId(null);
              setDropTargetId(null);
            }}
          >
            {!readOnly ? (
              <div className="pointer-events-none absolute left-[-54px] top-1 z-[320]">
                <button
                  ref={(element) => {
                    handleButtonRefs.current[block.id] = element;
                  }}
                  type="button"
                  draggable
                  onPointerEnter={() => {
                    showToolbar(block.id);
                    openActionsMenu(block.id);
                  }}
                  onPointerLeave={() => {
                    if (pinnedCommandMenuBlockId === block.id) {
                      return;
                    }
                    if (commandMenu?.blockId === block.id) {
                      hideCommandMenuWithDelay(block.id);
                    }
                    if (linkViewMenuBlockId === block.id) {
                      return;
                    }
                    hideToolbarWithDelay(block.id);
                  }}
                  onDragStart={(event) => {
                    setDraggingBlockId(block.id);
                    showToolbar(block.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", block.id);
                  }}
                  onDragEnd={() => {
                    setDraggingBlockId(null);
                    setDropTargetId(null);
                  }}
                  onClick={() => {
                    setPinnedCommandMenuBlockId(block.id);
                    cancelCommandMenuHide();
                    openActionsMenu(block.id);
                  }}
                  className={`pointer-events-auto flex h-8 min-w-[42px] items-center justify-center rounded-lg border bg-white text-slate-500 shadow-sm transition ${
                    draggingBlockId === block.id
                      ? "border-sky-300 text-sky-600"
                      : visibleToolbarBlockId === block.id || commandMenu?.blockId === block.id
                        ? "border-slate-200 opacity-100 hover:border-slate-300 hover:text-slate-700"
                        : "border-slate-200 opacity-0 hover:border-slate-300 hover:text-slate-700"
                  }`}
                  aria-label="块操作与拖拽"
                >
                  {isEmptyBlock(block) ? (
                    <span className="text-[16px] leading-none">+</span>
                  ) : (
                    <div className="flex items-center gap-1.5 px-1.5">
                      <span className="text-[13px] font-medium leading-none text-sky-600">
                        {block.type === "link" ? "↗" : block.type === "heading" ? `H${sanitizeHeadingLevel(block.headingLevel)}` : "T"}
                      </span>
                      <span className="text-[12px] leading-none text-slate-300">⋮</span>
                    </div>
                  )}
                </button>
              </div>
            ) : null}

            <div
              className={`relative -mx-3 rounded-lg px-3 transition ${
                hasActiveThread
                  ? "bg-amber-50/70"
                  : hasHoveredThread
                  ? "bg-amber-50/45"
                  : !readOnly && (activeBlockId === block.id || commandMenu?.blockId === block.id)
                  ? "bg-sky-50/70"
                  : !readOnly
                    ? "bg-transparent group-hover:bg-sky-50/50"
                    : "bg-transparent"
              }`}
            >
              {blockThreads.length > 0 ? (
                <button
                  type="button"
                  className={`absolute -right-3 top-3 z-10 rounded-md border px-1.5 py-0.5 text-[11px] ${
                    hasActiveThread
                      ? "border-amber-300 bg-amber-100 text-amber-800"
                      : hasHoveredThread
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white/90 text-slate-500"
                  }`}
                  onClick={() => onActivateCommentThread?.(blockThreads[0].id)}
                  onMouseEnter={() => onHoverCommentThread?.(blockThreads[0].id)}
                  onMouseLeave={() => onHoverCommentThread?.(null)}
                >
                  {blockThreads.length}评
                </button>
              ) : null}
              {showLinkToolbar ? (
                <div
                  data-editor-floating-window="true"
                  className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm"
                  onPointerEnter={() => showToolbar(block.id)}
                  onPointerLeave={() => hideToolbarWithDelay(block.id)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (preview?.href) {
                        void onResolveLinkPreview?.(block.id, preview.href);
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    aria-label="刷新链接预览"
                  >
                    <RefreshIcon />
                  </button>
                  <div ref={linkViewMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setLinkViewMenuBlockId((current) => (current === block.id ? null : block.id))
                      }
                      className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 transition hover:border-slate-300"
                    >
                      <span>{LINK_VIEW_OPTIONS.find((option) => option.value === preview?.view)?.label ?? "链接视图"}</span>
                      <span className={`text-xs text-slate-400 transition ${linkViewMenuBlockId === block.id ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </button>
                    {linkViewMenuBlockId === block.id ? (
                      <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                        {LINK_VIEW_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              updateLinkMeta(block.id, { view: option.value });
                              setLinkViewMenuBlockId(null);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                              preview?.view === option.value
                                ? "bg-sky-50 text-sky-700"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span>{option.label}</span>
                            {preview?.view === option.value ? <span>✓</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                    aria-label="布局"
                  >
                    <GridIcon />
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                    aria-label="更多操作"
                  >
                    <MoreIcon />
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                    aria-label="评论"
                  >
                    <CommentIcon />
                  </button>
                </div>
              ) : null}

              <div
                tabIndex={canFocusWrapper ? 0 : undefined}
                onFocus={() => {
                  if (canFocusWrapper) {
                    setActiveBlockId(block.id);
                  }
                }}
                onKeyDown={handleNonTextBlockKeyDown(block, index)}
                className={canFocusWrapper ? "rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-300" : undefined}
                style={sanitizeIndent(block.indent) > 0 ? { paddingLeft: `${sanitizeIndent(block.indent) * 28}px` } : undefined}
              >
                {block.type === "link" ? <LinkPreviewBlock block={block} readOnly={readOnly} /> : null}

                {block.type === "image" ? (
                  <ImagePreviewBlock
                    block={block}
                    readOnly={readOnly}
                    selected={selectedImageBlockId === block.id}
                    onSelect={() => {
                      setSelectedImageBlockId(block.id);
                      setActiveBlockId(null);
                    }}
                    onPreview={() => openImageLightbox(block.id, sanitizeImageRotation(block.imageRotation))}
                    onRotate={() => rotateImageBlock(block.id)}
                    onAlign={(align) => updateImageAlign(block.id, align)}
                    onDelete={() => requestDeleteBlock(block.id, "image")}
                  />
                ) : null}

                {block.type === "divider" ? (
                  <div className="py-3">
                    <div className="border-t border-slate-200" />
                  </div>
                ) : null}

                {usesCodeSurface ? (
                  <CodeBlockSurface
                    block={block}
                    readOnly={readOnly}
                    isActive={activeBlockId === block.id}
                    textareaRef={(element) => {
                      textareaRefs.current[block.id] = element;
                    }}
                    onChange={handleTextSurfaceChange(block)}
                    onPaste={handleTextSurfacePaste(block, index)}
                    onFocus={handleTextSurfaceFocus(block)}
                    onBlur={handleTextSurfaceBlur(block)}
                    onMouseUp={handleTextSurfaceMouseUp(block, blockCommentRanges)}
                    onKeyDown={handleTextSurfaceKeyDown(block, index)}
                    onLanguageChange={(language) => updateBlock(block.id, { codeLanguage: language })}
                    onWrapChange={(wrap) => updateBlock(block.id, { codeWrap: wrap })}
                    onCollapsedChange={(collapsed) => updateBlock(block.id, { codeCollapsed: collapsed })}
                    onHeightChange={(height) => updateBlock(block.id, { codeHeight: height })}
                  />
                ) : null}

                {showsTextSurface ? (
                  <TextBlockSurface
                    blockId={block.id}
                    blockType={block.type as UnifiedTextBlockType}
                    text={displayText}
                    readOnly={readOnly}
                    isActive={activeBlockId === block.id}
                    commentRanges={blockCommentRanges}
                    textClassName={textAreaClassName(block)}
                    contentPaddingClassName={textSurfacePaddingClassName(block)}
                    contentPaddingLeft={textSurfaceGutterWidth({ ...block, orderedListStart }, displayText)}
                    orderedListStart={orderedListStart}
                    orderedListStartOverrides={
                      block.type === "ordered_list"
                        ? sanitizeOrderedListStartOverrides(
                            block.orderedListStartOverrides,
                            displayText.split("\n").length,
                          )
                        : undefined
                    }
                    checkListLines={block.type === "check_list" ? parseCheckListRawText(block.text) : undefined}
                    minHeightStyle={readOnlyMinHeightStyle(block, block.text)}
                    rows={rowsByType(block.type, displayText)}
                    textareaRef={(element) => {
                      textareaRefs.current[block.id] = element;
                      resizeTextarea(element);
                    }}
                    placeholder={placeholderByType(block)}
                    onToggleCheckListLine={(lineIndex) => handleToggleCheckListLine(block, lineIndex)}
                    onListMarkerClick={(lineIndex, event) => openListMarkerToolbar(block, lineIndex, event)}
                    onChange={handleTextSurfaceChange(block)}
                    onPaste={handleTextSurfacePaste(block, index)}
                    onFocus={handleTextSurfaceFocus(block)}
                    onBlur={handleTextSurfaceBlur(block)}
                    onMouseUp={handleTextSurfaceMouseUp(block, blockCommentRanges)}
                    onKeyDown={handleTextSurfaceKeyDown(block, index)}
                  />
                ) : null}
              </div>

              {!readOnly && commandMenu?.blockId === block.id ? (
                <div
                  ref={commandMenuRef}
                  data-editor-floating-window="true"
                  className={`fixed z-[300] w-[212px] rounded-lg border border-slate-200 bg-white p-0 shadow-[0_18px_45px_rgba(15,23,42,0.12)] transition duration-180 ease-out ${
                    closingCommandMenuBlockId === block.id
                      ? "pointer-events-none -translate-y-1 opacity-0"
                      : "translate-y-0 opacity-100"
                  }`}
                  style={
                    commandMenuPosition
                      ? {
                          left: `${commandMenuPosition.left}px`,
                          top: `${commandMenuPosition.top}px`,
                        }
                      : undefined
                  }
                  onPointerEnter={() => {
                    showToolbar(block.id);
                    cancelCommandMenuHide();
                  }}
                  onPointerLeave={() => {
                    setPinnedCommandMenuBlockId((current) => (current === block.id ? null : current));
                    hideToolbarWithDelay(block.id);
                    hideCommandMenuWithDelay(block.id);
                  }}
                >
                  <div className="border-b border-slate-200 px-2 py-1.5">
                    <div className="grid grid-cols-8 gap-1 text-[13px] leading-none">
                      {quickCommandsForBlock(block).map((command) => {
                        const isSelected =
                          command.kind === "heading"
                            ? block.type === "heading" && sanitizeHeadingLevel(block.headingLevel) === command.level
                            : block.type === command.type;
                        return (
                          <button
                            key={command.kind === "heading" ? `heading-${command.level}` : command.type}
                            type="button"
                            title={command.title}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              if (command.kind === "heading") {
                                applyCommand(block.id, "heading", {
                                  preserveContent: commandMenu.mode === "actions",
                                  headingLevel: command.level,
                                });
                                return;
                              }
                              applyCommand(block.id, command.type, {
                                preserveContent: commandMenu.mode === "actions",
                              });
                            }}
                            className={`flex h-6 min-w-0 items-center justify-center rounded-md border-0 p-0 transition ${
                              isSelected
                                ? "bg-sky-50 text-sky-600"
                                : "bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <span className={command.kind === "heading" ? "font-medium" : "font-semibold"}>
                              {command.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {commandMenu.mode === "slash" ? (
                    <div className="border-b border-slate-200 px-3 py-1.5 text-[11px] leading-4 text-slate-400">
                      输入命令中：<span className="font-medium text-slate-600">/{commandMenu.query}</span>
                    </div>
                  ) : null}

                  {commandMenu.mode === "slash" ? (
                    <div className="border-b border-slate-200 px-1.5 py-1.5">
                      {filteredCommands.length > 0 ? (
                        <div className="space-y-0.5">
                          {filteredCommands.map((command, commandIndex) => (
                            <button
                              key={command.type}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                applyCommand(block.id, command.type, {
                                  preserveContent: true,
                                });
                              }}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                                commandIndex === commandMenu.selectedIndex
                                  ? "bg-sky-50 text-slate-900"
                                  : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 text-[12px] font-semibold text-slate-500">
                                {command.shortLabel}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-medium leading-4">{command.label}</div>
                                <div className="truncate text-[11px] leading-4 text-slate-400">{command.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-slate-400">没有匹配的块命令</div>
                      )}
                    </div>
                  ) : null}

                  <div className="px-1.5 py-1.5">
                    <div className="space-y-0.5">
                      {[
                        {
                          label: "复制",
                          onClick: () => {
                            duplicateBlock(index);
                            closeCommandMenu();
                          },
                        },
                        {
                          label: "删除",
                          danger: true,
                          onClick: () => {
                            requestDeleteBlock(block.id, "block");
                          },
                        },
                        {
                          label: "上移",
                          onClick: () => {
                            moveBlock(index, -1);
                            closeCommandMenu();
                          },
                        },
                        {
                          label: "下移",
                          onClick: () => {
                            moveBlock(index, 1);
                            closeCommandMenu();
                          },
                        },
                        {
                          label: "在下方添加",
                          onClick: () => {
                            insertBlock(index + 1, "paragraph");
                            closeCommandMenu();
                          },
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          title={item.label}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            item.onClick();
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-4 transition ${
                            item.danger
                              ? "text-rose-500 hover:bg-rose-50"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center text-[13px] leading-none text-slate-400">
                              {actionGlyph(item.label)}
                            </span>
                            <span>{item.label}</span>
                          </span>
                          <span className="text-[11px] text-slate-300">›</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {listMarkerToolbar ? (() => {
        const toolbarBlockIndex = blocks.findIndex((block) => block.id === listMarkerToolbar.blockId);
        const toolbarBlock = toolbarBlockIndex >= 0 ? blocks[toolbarBlockIndex] : null;
        if (!toolbarBlock || (toolbarBlock.type !== "ordered_list" && toolbarBlock.type !== "bullet_list")) {
          return null;
        }
        const canContinuePreviousNumber =
          toolbarBlock.type === "ordered_list" &&
          blocks[toolbarBlockIndex - 1]?.type === "ordered_list";

        return (
          <div
            data-editor-floating-window="true"
            className="fixed z-40 w-[174px] rounded-md border border-red-400 bg-white py-1 shadow-[0_12px_28px_rgba(15,23,42,0.14)]"
            style={{ left: `${listMarkerToolbar.left}px`, top: `${listMarkerToolbar.top}px` }}
          >
            {[
              {
                label: "继续之前的编号",
                icon: "1↩",
                disabled: !canContinuePreviousNumber,
                onClick: () => continuePreviousOrderedList(toolbarBlock, toolbarBlockIndex),
              },
              {
                label: "开始新列表",
                icon: "1↧",
                disabled: toolbarBlock.type !== "ordered_list",
                onClick: () => startNewOrderedList(toolbarBlock, toolbarBlockIndex, listMarkerToolbar.lineIndex),
              },
              {
                label: "修改编号值",
                icon: "1↙",
                disabled: toolbarBlock.type !== "ordered_list",
                onClick: () => changeOrderedListValue(toolbarBlock, toolbarBlockIndex, listMarkerToolbar.lineIndex),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (!item.disabled) {
                    item.onClick();
                  }
                }}
                className={`flex h-8 w-full items-center gap-2 px-3 text-left text-[13px] transition ${
                  item.disabled
                    ? "cursor-not-allowed text-slate-300"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[11px] font-medium text-slate-400">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        );
      })() : null}
      <CommentSelectionToolbar
        selection={selectionToolbar}
        onCreate={(selection) => {
          onCreateCommentSelection?.(selection.anchor);
          setSelectionToolbar(null);
        }}
        onCancel={() => setSelectionToolbar(null)}
      />
      {lightboxImageIndex !== null ? (
        <ImageLightbox
          images={imagePreviews}
          index={lightboxImageIndex}
          initialRotation={lightboxInitialRotation}
          onIndexChange={setLightboxImageIndex}
          onClose={() => setLightboxImageIndex(null)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingDeleteBlock)}
        title={pendingDeleteBlock?.kind === "image" ? "确认删除图片" : "确认删除文档块"}
        description={
          pendingDeleteBlock?.kind === "image"
            ? "删除后该图片块会从当前文档移除。"
            : "删除后该文档块会从当前文档移除。"
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        danger
        onCancel={() => setPendingDeleteBlock(null)}
        onConfirm={confirmDeleteBlock}
      />
    </div>
  );
}
