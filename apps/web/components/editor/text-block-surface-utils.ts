"use client";

import type { EditableBlock, EditableBlockType } from "@/components/editor/block-editor";

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
    return "text-[2rem] font-bold leading-[2.55rem] tracking-tight text-slate-950";
  }
  if (currentLevel === 2) {
    return "text-[1.65rem] font-bold leading-[2.25rem] tracking-tight text-slate-900";
  }
  if (currentLevel === 3) {
    return "text-[1.35rem] font-semibold leading-[2rem] tracking-tight text-slate-900";
  }
  if (currentLevel === 4) {
    return "text-[1.12rem] font-semibold leading-8 tracking-tight text-slate-800";
  }
  if (currentLevel === 5) {
    return "text-[0.98rem] font-semibold leading-7 text-slate-700";
  }
  return "text-[0.9rem] font-semibold uppercase leading-7 tracking-[0.12em] text-slate-500";
}

export function textAreaClassName(block: EditableBlock) {
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

export function textSurfacePaddingClassName(block: EditableBlock) {
  if (block.type === "heading") {
    const level = sanitizeHeadingLevel(block.headingLevel);
    if (level === 1) {
      return "pt-5 pb-2";
    }
    if (level === 2) {
      return "pt-4 pb-1.5";
    }
    if (level === 3) {
      return "pt-3 pb-1";
    }
    return "pt-2 pb-0.5";
  }
  return "";
}

export function placeholderByType(block: EditableBlock) {
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

export function rowsByType(type: EditableBlockType, text: string) {
  if (type === "divider") {
    return 1;
  }

  if (type === "link") {
    return 1;
  }

  return Math.max(text.split("\n").length, type === "code_block" ? 4 : 1);
}

export function displayTextForBlock(block: EditableBlock) {
  if (block.type === "image") {
    return block.text.replace(/\s*\|\s*$/, "");
  }

  if (block.type === "check_list") {
    return parseCheckListRawText(block.text)
      .map((line) => line.text)
      .join("\n");
  }

  return block.text;
}

export function showsUnifiedTextSurface(block: EditableBlock, readOnly: boolean) {
  if (block.type === "image" || block.type === "divider") {
    return false;
  }
  if (block.type === "link") {
    return !block.text.trim() && !block.meta?.href && !block.meta?.title;
  }
  return true;
}

function readOnlyLineHeightRem(block: EditableBlock) {
  if (block.type === "code_block") {
    return 1.75;
  }
  if (block.type === "heading") {
    const level = sanitizeHeadingLevel(block.headingLevel);
    if (level === 1) {
      return 2.5;
    }
    if (level === 2) {
      return 2.25;
    }
    return 2;
  }
  return 2;
}

export function readOnlyMinHeightStyle(block: EditableBlock, text: string) {
  const lineCount = Math.max(1, text.split("\n").length);
  return {
    minHeight: `${lineCount * readOnlyLineHeightRem(block)}rem`,
  };
}

export type CheckListLine = {
  checked: boolean;
  text: string;
};

export function parseCheckListRawText(rawText: string): CheckListLine[] {
  return rawText.split("\n").map((line) => {
    const match = line.match(/^\[( |x|X)\]\s?(.*)$/);
    if (!match) {
      return {
        checked: false,
        text: line,
      };
    }

    return {
      checked: match[1].toLowerCase() === "x",
      text: match[2] ?? "",
    };
  });
}

export function buildCheckListRawText(previousRawText: string, displayText: string) {
  const previousLines = parseCheckListRawText(previousRawText);
  const nextLines = displayText.split("\n");
  return nextLines
    .map((line, index) => {
      const checked = previousLines[index]?.checked ?? false;
      return `${checked ? "[x]" : "[ ]"} ${line}`.trimEnd();
    })
    .join("\n");
}

export function toggleCheckListLine(previousRawText: string, lineIndex: number) {
  const lines = parseCheckListRawText(previousRawText);
  if (!lines[lineIndex]) {
    return previousRawText;
  }
  lines[lineIndex] = {
    ...lines[lineIndex],
    checked: !lines[lineIndex].checked,
  };
  return lines
    .map((line) => `${line.checked ? "[x]" : "[ ]"} ${line.text}`.trimEnd())
    .join("\n");
}

function checkListPrefixLength(rawLine: string) {
  const match = rawLine.match(/^\[( |x|X)\]\s?/);
  return match ? match[0].length : 0;
}

export function displayOffsetFromBlockRawOffset(block: EditableBlock, rawOffset: number) {
  if (block.type !== "check_list") {
    return rawOffset;
  }

  const rawLines = block.text.split("\n");
  let rawCursor = 0;
  let displayCursor = 0;

  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index];
    const prefixLength = checkListPrefixLength(rawLine);
    const displayLine = rawLine.slice(prefixLength);
    const rawLineLength = rawLine.length;
    const displayLineLength = displayLine.length;
    const rawLineStart = rawCursor;
    const rawLineEnd = rawCursor + rawLineLength;

    if (rawOffset <= rawLineEnd) {
      if (rawOffset <= rawLineStart + prefixLength) {
        return displayCursor;
      }
      return Math.min(displayCursor + displayLineLength, displayCursor + (rawOffset - rawLineStart - prefixLength));
    }

    rawCursor = rawLineEnd + 1;
    displayCursor += displayLineLength + 1;
  }

  return displayCursor;
}

export function rawOffsetFromBlockDisplayOffset(block: EditableBlock, displayOffset: number) {
  if (block.type !== "check_list") {
    return displayOffset;
  }

  const rawLines = block.text.split("\n");
  let rawCursor = 0;
  let displayCursor = 0;

  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index];
    const prefixLength = checkListPrefixLength(rawLine);
    const displayLine = rawLine.slice(prefixLength);
    const displayLineLength = displayLine.length;
    const displayLineStart = displayCursor;
    const displayLineEnd = displayCursor + displayLineLength;

    if (displayOffset <= displayLineEnd) {
      return Math.min(rawCursor + rawLine.length, rawCursor + prefixLength + Math.max(0, displayOffset - displayLineStart));
    }

    rawCursor += rawLine.length + 1;
    displayCursor = displayLineEnd + 1;
  }

  return rawCursor;
}

export function textSurfaceGutterWidth(block: EditableBlock, displayText: string) {
  if (block.type === "bullet_list" || block.type === "check_list") {
    return 28;
  }

  if (block.type === "ordered_list") {
    const lineCount = Math.max(1, displayText.split("\n").length);
    const digits = String(lineCount).length;
    return 18 + digits * 8;
  }

  return 0;
}
