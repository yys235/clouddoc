"use client";

import type { EditableBlock, EditableBlockType } from "@/components/editor/block-editor";

export type BlockCommand = {
  type: EditableBlockType;
  label: string;
  shortLabel: string;
  description: string;
  keywords: string[];
};

export type QuickCommand =
  | { kind: "type"; type: EditableBlockType; label: string; title: string }
  | { kind: "heading"; level: number; label: string; title: string };

export const BLOCK_COMMANDS: BlockCommand[] = [
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

export function commandQuery(text: string) {
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

export function filterCommands(query: string) {
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

export function quickCommandsForBlock(_block: EditableBlock): QuickCommand[] {
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
