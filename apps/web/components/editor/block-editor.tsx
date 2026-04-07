"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  meta?: LinkCardMeta;
  imageAlign?: "left" | "center" | "right";
};

type UploadedImageAsset = {
  file_url: string;
  file_name: string;
  mime_type: string;
  file_size: number;
};

type BlockCommand = {
  type: EditableBlockType;
  label: string;
  shortLabel: string;
  description: string;
  keywords: string[];
};

type QuickCommand =
  | { kind: "type"; type: EditableBlockType; label: string; title: string }
  | { kind: "heading"; level: number; label: string; title: string };

const BLOCK_COMMANDS: BlockCommand[] = [
  {
    type: "paragraph",
    label: "正文",
    shortLabel: "T",
    description: "普通正文段落",
    keywords: ["text", "paragraph", "body", "p"],
  },
  {
    type: "heading",
    label: "标题",
    shortLabel: "H1",
    description: "章节标题和大纲节点",
    keywords: ["heading", "title", "h1", "h2", "h3", "h4", "h5", "h6"],
  },
  {
    type: "bullet_list",
    label: "列表",
    shortLabel: "•",
    description: "无序列表，每行一个条目",
    keywords: ["list", "bullet", "ul"],
  },
  {
    type: "ordered_list",
    label: "有序列表",
    shortLabel: "1.",
    description: "有序列表，每行一个条目",
    keywords: ["ordered", "number", "list", "ol"],
  },
  {
    type: "check_list",
    label: "检查项",
    shortLabel: "[]",
    description: "任务清单，支持 [x] 和 [ ]",
    keywords: ["check", "todo", "task", "checkbox"],
  },
  {
    type: "quote",
    label: "引用",
    shortLabel: "❝",
    description: "强调引用内容",
    keywords: ["quote", "blockquote"],
  },
  {
    type: "divider",
    label: "分割线",
    shortLabel: "—",
    description: "插入一条分割线",
    keywords: ["divider", "line", "hr"],
  },
  {
    type: "link",
    label: "链接",
    shortLabel: "↗",
    description: "粘贴链接并生成链接卡片",
    keywords: ["link", "url", "href"],
  },
  {
    type: "image",
    label: "图片",
    shortLabel: "🖼",
    description: "图片地址和说明",
    keywords: ["image", "img", "picture"],
  },
  {
    type: "code_block",
    label: "代码",
    shortLabel: "{}",
    description: "多行代码片段",
    keywords: ["code", "snippet", "pre"],
  },
];

const LINK_VIEW_OPTIONS: Array<{ value: LinkCardView; label: string }> = [
  { value: "link", label: "链接视图" },
  { value: "title", label: "标题视图" },
  { value: "card", label: "卡片视图" },
  { value: "preview", label: "预览视图" },
];

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

function headingTextClassName(level: number | undefined) {
  const currentLevel = sanitizeHeadingLevel(level);
  if (currentLevel === 1) {
    return "text-3xl font-semibold leading-tight tracking-tight text-slate-900";
  }
  if (currentLevel === 2) {
    return "text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900";
  }
  if (currentLevel === 3) {
    return "text-[1.45rem] font-semibold leading-tight tracking-tight text-slate-900";
  }
  if (currentLevel === 4) {
    return "text-[1.2rem] font-semibold leading-8 tracking-tight text-slate-900";
  }
  if (currentLevel === 5) {
    return "text-[1.05rem] font-semibold leading-8 text-slate-800";
  }
  return "text-base font-semibold leading-8 text-slate-800";
}

function textAreaClassName(block: EditableBlock) {
  if (block.type === "heading") {
    return `min-h-0 ${headingTextClassName(block.headingLevel)}`;
  }

  if (block.type === "divider") {
    return "min-h-0 text-sm leading-6 text-slate-400";
  }

  if (block.type === "link") {
    return "min-h-0 px-0 py-0 text-sm leading-6 text-slate-500";
  }

  if (block.type === "image") {
    return "min-h-0 px-0 py-0 text-base leading-8 text-slate-700";
  }

  if (block.type === "code_block") {
    return "min-h-0 px-0 py-0 font-mono text-sm leading-7 text-slate-700";
  }

  if (block.type === "quote") {
    return "min-h-0 px-0 py-0 text-base leading-8 text-slate-600";
  }

  if (block.type === "check_list") {
    return "min-h-0 text-base leading-8 text-slate-700";
  }

  return "min-h-0 text-base leading-8 text-slate-700";
}

function placeholderByType(block: EditableBlock) {
  if (block.type === "heading") {
    return `输入 H${sanitizeHeadingLevel(block.headingLevel)} 标题块`;
  }

  if (block.type === "bullet_list") {
    return "每行一个列表项";
  }

  if (block.type === "ordered_list") {
    return "每行一个条目，自动按顺序渲染";
  }

  if (block.type === "check_list") {
    return "每行一个检查项，支持 [ ] 和 [x]";
  }

  if (block.type === "quote") {
    return "输入引用内容";
  }

  if (block.type === "divider") {
    return "输入 --- 或直接保留为空";
  }

  if (block.type === "link") {
    return "粘贴链接，或输入 标题 | URL";
  }

  if (block.type === "image") {
    return "图片说明 | https://example.com/image.png";
  }

  if (block.type === "code_block") {
    return "输入代码块";
  }

  return "输入正文，或输入 / 打开命令";
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

function commandQuery(text: string) {
  const normalized = text
    .trim()
    .replace(/^\[(x|X| )\]\s*/, "")
    .trim();
  if (!normalized.startsWith("/")) {
    return null;
  }

  if (normalized.includes(" ")) {
    return null;
  }

  return normalized.slice(1).toLowerCase();
}

function filterCommands(query: string) {
  if (!query) {
    return BLOCK_COMMANDS;
  }

  return BLOCK_COMMANDS.filter((command) => {
    const haystacks = [command.label, command.description, ...command.keywords]
      .join(" ")
      .toLowerCase();
    return haystacks.includes(query);
  });
}

function fallbackSplitText() {
  return "";
}

function rowsByType(type: EditableBlockType, text: string) {
  if (type === "divider") {
    return 1;
  }

  if (type === "link") {
    return 1;
  }

  return Math.max(text.split("\n").length, type === "code_block" ? 4 : 1);
}

function resizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
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
    id: crypto.randomUUID(),
    type,
    text,
    headingLevel: type === "heading" ? sanitizeHeadingLevel(options?.headingLevel ?? 1) : undefined,
    meta: type === "link" ? { ...(defaultMetaByType(type) ?? {}), ...(options?.meta ?? {}) } : options?.meta,
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
        return createBlock("ordered_list", orderedMatch[1]);
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

  const elementToBlock = (element: HTMLElement): EditableBlock | null => {
    const tag = element.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      return createBlock("heading", htmlNodeToText(element).trim(), {
        headingLevel: Number(tag.slice(1)),
      });
    }

    if (tag === "blockquote") {
      return createBlock("quote", htmlNodeToText(element).trim());
    }

    if (tag === "hr") {
      return createBlock("divider", "");
    }

    if (tag === "ol") {
      const lines = Array.from(element.querySelectorAll(":scope > li"))
        .map((item) => htmlNodeToText(item).trim())
        .filter((line) => line.length > 0);
      return createBlock("ordered_list", lines.join("\n"));
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
        return createBlock("check_list", lines.join("\n"));
      }

      return createBlock("bullet_list", lines.join("\n"));
    }

    if (tag === "pre") {
      const code = element.querySelector("code");
      return createBlock("code_block", (code?.textContent ?? element.textContent ?? "").replace(/\r\n/g, "\n"));
    }

    if (tag === "p" || tag === "div") {
      return createBlock("paragraph", htmlNodeToText(element).replace(/\u00a0/g, " "));
    }

    return null;
  };

  const topLevelElements = Array.from(body.children) as HTMLElement[];
  for (const element of topLevelElements) {
    pushBlock(elementToBlock(element));
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

function quickCommandsForBlock(block: EditableBlock): QuickCommand[] {
  const headingLevels = [1, 2, 3, 4, 5, 6];

  return [
    { kind: "type", type: "paragraph", label: "T", title: "正文" },
    ...headingLevels.map((level) => ({
      kind: "heading" as const,
      level,
      label: `H${level}`,
      title: `标题 ${level}`,
    })),
    { kind: "type", type: "ordered_list", label: "1.", title: "有序列表" },
    { kind: "type", type: "bullet_list", label: "≡", title: "列表" },
    { kind: "type", type: "check_list", label: "☑", title: "检查项" },
    { kind: "type", type: "code_block", label: "{}", title: "代码" },
    { kind: "type", type: "quote", label: "❝", title: "引用" },
    { kind: "type", type: "divider", label: "▭", title: "分割线" },
    { kind: "type", type: "link", label: "↗", title: "链接" },
    { kind: "type", type: "image", label: "⧉", title: "图片" },
  ];
}

function isEmptyBlock(block: EditableBlock) {
  return block.text.trim().length === 0;
}

function displayTextForBlock(block: EditableBlock, readOnly: boolean) {
  if (!readOnly) {
    return block.text;
  }

  if (block.type === "image") {
    return block.text.replace(/\s*\|\s*$/, "");
  }

  return block.text;
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

  const previewBody = (() => {
    if (preview.status === "loading") {
      return (
        <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-500">
          正在抓取链接信息...
        </div>
      );
    }

    if (preview.view === "link") {
      return (
        <a
          href={preview.href || undefined}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300"
        >
          <span className="text-base text-sky-600">🔗</span>
          <span className="truncate">{preview.href || preview.title}</span>
        </a>
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
    <div className={`${readOnly ? "" : "mb-2"}`}>
      {previewBody}
      {preview.status === "error" ? (
        <div className="mt-2 text-xs text-rose-500">链接信息抓取失败，可点击刷新重试。</div>
      ) : null}
    </div>
  );
}

function ImagePreviewBlock({
  block,
  readOnly,
  onAlign,
  onDelete,
}: {
  block: EditableBlock;
  readOnly: boolean;
  onAlign: (align: "left" | "center" | "right") => void;
  onDelete: () => void;
}) {
  const preview = imageBlockData(block);

  if (!preview.src) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-400">
        粘贴图片后会显示在这里
      </div>
    );
  }

  return (
    <div className={`mb-2 flex w-full ${imageAlignClassName(block.imageAlign)}`}>
      <figure className="group/image relative overflow-hidden rounded-lg bg-transparent">
        {preview.src ? (
          <div className="pointer-events-none absolute right-3 top-3 z-10 opacity-0 transition duration-150 group-hover/image:opacity-100">
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
              <a
                href={preview.src}
                target="_blank"
                rel="noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
                title="打开原图"
              >
                ↗
              </a>
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
        <img src={preview.src} alt={preview.alt} className="max-h-[520px] max-w-full rounded-lg object-contain bg-transparent" />
      </figure>
    </div>
  );
}

export function BlockEditor({
  blocks,
  onChange,
  readOnly = false,
  onResolveLinkPreview,
  onUploadImage,
}: {
  blocks: EditableBlock[];
  onChange: (blocks: EditableBlock[]) => void;
  readOnly?: boolean;
  onResolveLinkPreview?: (blockId: string, url: string) => void | Promise<void>;
  onUploadImage?: (files: File[]) => Promise<UploadedImageAsset[]>;
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
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const handleButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hideToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideCommandMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandMenuFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commandMenuRef = useRef<HTMLDivElement | null>(null);
  const linkViewMenuRef = useRef<HTMLDivElement | null>(null);

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
      id: crypto.randomUUID(),
      type,
      text: defaultTextByType(type),
      headingLevel: type === "heading" ? 1 : undefined,
      meta: defaultMetaByType(type),
    });
    onChange(nextBlocks);
  };

  const removeBlock = (blockId: string) => {
    const nextBlocks = blocks.filter((block) => block.id !== blockId);
    onChange(
      nextBlocks.length > 0
        ? nextBlocks
        : [{ id: crypto.randomUUID(), type: "paragraph", text: "" }],
    );
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
      id: crypto.randomUUID(),
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

  const splitBlock = (index: number, selectionStart: number, selectionEnd: number) => {
    const current = blocks[index];
    if (!current) {
      return;
    }

    const before = current.text.slice(0, selectionStart);
    const after = current.text.slice(selectionEnd);
    const nextBlockId = crypto.randomUUID();
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
      meta: current.type === "link" ? { ...(current.meta ?? {}), status: "idle" } : current.meta ? { ...current.meta } : undefined,
    });

    onChange(nextBlocks);
    focusBlock(nextBlockId, after ? 0 : nextText.length);
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

        return (
          <div
            key={block.id}
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
              <div className="pointer-events-none absolute left-[-42px] top-1/2 z-10 -translate-y-1/2">
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
                !readOnly && (activeBlockId === block.id || commandMenu?.blockId === block.id)
                  ? "bg-sky-50/70"
                  : !readOnly
                    ? "bg-transparent group-hover:bg-sky-50/50"
                    : "bg-transparent"
              }`}
            >
              {showLinkToolbar ? (
                <div
                  className="mb-2 flex items-center gap-1.5"
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
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-300"
                    >
                      <span>{LINK_VIEW_OPTIONS.find((option) => option.value === preview?.view)?.label ?? "链接视图"}</span>
                      <span className={`text-xs text-slate-400 transition ${linkViewMenuBlockId === block.id ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </button>
                    {linkViewMenuBlockId === block.id ? (
                      <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
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

              {block.type === "link" ? <LinkPreviewBlock block={block} readOnly={readOnly} /> : null}
              {block.type === "image" ? (
                <ImagePreviewBlock
                  block={block}
                  readOnly={readOnly}
                  onAlign={(align) => updateImageAlign(block.id, align)}
                  onDelete={() => removeBlock(block.id)}
                />
              ) : null}

              {block.type !== "image" && !(readOnly && block.type === "link") ? (
                <textarea
                  ref={(element) => {
                    textareaRefs.current[block.id] = element;
                    resizeTextarea(element);
                  }}
                  value={displayTextForBlock(block, readOnly)}
                  onChange={(event) => {
                    resizeTextarea(event.currentTarget);
                    if (readOnly) {
                      return;
                    }

                    const value = event.target.value;
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
                    } else {
                      updateBlock(block.id, { text: value });
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
                  }}
                  onPaste={(event) => {
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
                  }}
                  onFocus={() => {
                    if (readOnly) {
                      return;
                    }
                    setActiveBlockId(block.id);
                    const query = commandQuery(block.text);
                    if (query !== null) {
                      setCommandMenu({
                        blockId: block.id,
                        mode: "slash",
                        query,
                        selectedIndex: 0,
                      });
                    }
                  }}
                  onBlur={(event) => {
                    setActiveBlockId((current) => (current === block.id ? null : current));
                    if (readOnly || block.type !== "link") {
                      return;
                    }
                    const parsed = parseLinkSource(event.currentTarget.value);
                    const currentHref = parsed.href || block.meta?.href || "";
                    if (currentHref && (block.meta?.href !== currentHref || block.meta?.status !== "ready")) {
                      void onResolveLinkPreview?.(block.id, currentHref);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (readOnly) {
                      return;
                    }
                    const selectionStart = event.currentTarget.selectionStart;
                    const selectionEnd = event.currentTarget.selectionEnd;
                    const hasSelection = selectionStart !== selectionEnd;
                    const currentLength = event.currentTarget.value.length;

                    const directQuery = commandQuery(event.currentTarget.value);
                    if (event.key === "Enter" && !event.shiftKey && directQuery !== null) {
                      event.preventDefault();
                      event.stopPropagation();
                      const directCommands = filterCommands(directQuery);
                      const selectedIndex =
                        commandMenu?.blockId === block.id ? commandMenu.selectedIndex : 0;
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

                    if (
                      commandMenu?.blockId === block.id &&
                      commandMenu.mode === "slash" &&
                      filteredCommands.length > 0
                    ) {
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
                                  (value.selectedIndex - 1 + filteredCommands.length) %
                                  filteredCommands.length,
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

                    const liveQuery =
                      commandMenu?.blockId === block.id ? commandMenu.query : directQuery;
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
                                selectedIndex:
                                  (value.selectedIndex - 1 + liveCommands.length) % liveCommands.length,
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
                      event.preventDefault();
                      splitBlock(index, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
                    }
                  }}
                  rows={rowsByType(block.type, displayTextForBlock(block, readOnly))}
                  readOnly={readOnly}
                  tabIndex={readOnly ? -1 : undefined}
                  spellCheck={!readOnly}
                  aria-readonly={readOnly}
                  className={`block w-full resize-none border-0 bg-transparent p-0 outline-none ${textAreaClassName(block)} ${
                    readOnly ? "cursor-text caret-transparent" : ""
                  } overflow-hidden`}
                  placeholder={readOnly || activeBlockId !== block.id ? "" : placeholderByType(block)}
                />
              ) : null}

              {!readOnly && commandMenu?.blockId === block.id ? (
                <div
                  ref={commandMenuRef}
                  className={`fixed z-30 w-[228px] overflow-hidden rounded-lg border border-slate-200 bg-white p-0 shadow-[0_18px_45px_rgba(15,23,42,0.12)] transition duration-180 ease-out ${
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
                  <div className="border-b border-slate-200 px-2 py-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] leading-none">
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
                            className={`flex h-6 items-center justify-center border-0 bg-transparent p-0 transition ${
                              isSelected ? "text-sky-600" : "text-slate-700 hover:text-slate-900"
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
                            removeBlock(block.id);
                            closeCommandMenu();
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
    </div>
  );
}
