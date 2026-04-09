"use client";

import type {
  ChangeEvent as ReactChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

import type { CheckListLine } from "@/components/editor/text-block-surface-utils";

export type TextCommentRange = {
  id: string;
  start: number;
  end: number;
  active: boolean;
};

export type UnifiedTextBlockType =
  | "paragraph"
  | "heading"
  | "bullet_list"
  | "ordered_list"
  | "check_list"
  | "quote"
  | "code_block"
  | "link";

function mergeCommentRanges(ranges: TextCommentRange[]) {
  const sorted = [...ranges]
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: TextCommentRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start >= previous.end) {
      merged.push({ ...range });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
    previous.active = previous.active || range.active;
    if (!previous.id && range.id) {
      previous.id = range.id;
    }
  }

  return merged;
}

function commentSegmentsForText(text: string, ranges: TextCommentRange[]) {
  const merged = mergeCommentRanges(ranges);
  const segments: Array<{ text: string; highlighted: boolean; active: boolean }> = [];
  let cursor = 0;

  for (const range of merged) {
    const start = Math.max(0, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    if (start > cursor) {
      segments.push({
        text: text.slice(cursor, start),
        highlighted: false,
        active: false,
      });
    }
    if (end > start) {
      segments.push({
        text: text.slice(start, end),
        highlighted: true,
        active: range.active,
      });
    }
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      highlighted: false,
      active: false,
    });
  }

  if (segments.length === 0) {
    segments.push({ text, highlighted: false, active: false });
  }

  return segments;
}

export function TextBlockSurface({
  blockId,
  blockType,
  text,
  readOnly,
  isActive,
  commentRanges,
  textClassName,
  contentPaddingClassName,
  contentPaddingLeft,
  checkListLines,
  minHeightStyle,
  rows,
  placeholder,
  textareaRef,
  onToggleCheckListLine,
  onChange,
  onPaste,
  onFocus,
  onBlur,
  onMouseUp,
  onKeyDown,
}: {
  blockId: string;
  blockType: UnifiedTextBlockType;
  text: string;
  readOnly: boolean;
  isActive: boolean;
  commentRanges: TextCommentRange[];
  textClassName: string;
  contentPaddingClassName: string;
  contentPaddingLeft?: number;
  checkListLines?: CheckListLine[];
  minHeightStyle: CSSProperties;
  rows: number;
  placeholder: string;
  textareaRef: (element: HTMLTextAreaElement | null) => void;
  onToggleCheckListLine?: (lineIndex: number) => void;
  onChange: (event: ReactChangeEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: (event: ReactFocusEvent<HTMLTextAreaElement>) => void;
  onMouseUp: (event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const lines = text.split("\n");
  const showsListDecorations = blockType === "bullet_list" || blockType === "ordered_list";
  const showsCheckListDecorations = blockType === "check_list";
  const contentStyle = contentPaddingLeft ? { paddingLeft: `${contentPaddingLeft}px`, ...minHeightStyle } : minHeightStyle;
  const gutterStyle = contentPaddingLeft ? { width: `${Math.max(24, contentPaddingLeft - 4)}px` } : undefined;

  return (
    <div className="relative">
      {showsListDecorations ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex flex-col text-right text-sm leading-8 text-slate-400"
          style={gutterStyle}
        >
          {lines.map((_, index) => (
            <span key={`${blockId}-marker-${index}`} className="block h-8">
              {blockType === "ordered_list" ? `${index + 1}.` : "•"}
            </span>
          ))}
        </div>
      ) : null}
      {showsCheckListDecorations ? (
        <div
          aria-hidden={readOnly ? undefined : false}
          className="absolute inset-y-0 left-0 flex flex-col"
          style={gutterStyle}
        >
          {(checkListLines ?? []).map((line, index) => (
            <button
              key={`${blockId}-check-${index}`}
              type="button"
              tabIndex={readOnly ? -1 : 0}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleCheckListLine?.(index);
              }}
              className={`flex h-8 items-center justify-center text-sm ${readOnly ? "cursor-default" : "cursor-pointer"}`}
              aria-label={line.checked ? "取消完成" : "标记完成"}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border text-[11px] leading-none ${
                  line.checked ? "border-sky-500 bg-sky-500 text-white" : "border-slate-300 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {commentRanges.length > 0 ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words ${contentPaddingClassName} ${textClassName} text-transparent`}
          style={contentStyle}
        >
          {commentSegmentsForText(text, commentRanges).map((segment, segmentIndex) => (
            <span
              key={`${blockId}-segment-${segmentIndex}`}
              className={segment.highlighted ? (segment.active ? "rounded-sm bg-amber-200/80" : "rounded-sm bg-amber-100/80") : ""}
            >
              {segment.text || (segmentIndex === 0 ? " " : "")}
            </span>
          ))}
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        data-block-id={blockId}
        value={text}
        onChange={onChange}
        onPaste={onPaste}
        onFocus={onFocus}
        onBlur={onBlur}
        onMouseUp={onMouseUp}
        onKeyDown={onKeyDown}
        rows={rows}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        spellCheck={!readOnly}
        aria-readonly={readOnly}
        className={`relative block w-full resize-none border-0 bg-transparent p-0 outline-none ${contentPaddingClassName} ${textClassName} ${
          readOnly ? "cursor-text caret-transparent" : ""
        } overflow-hidden`}
        style={contentPaddingLeft ? { paddingLeft: `${contentPaddingLeft}px` } : undefined}
        placeholder={readOnly || !isActive ? "" : placeholder}
      />
    </div>
  );
}
