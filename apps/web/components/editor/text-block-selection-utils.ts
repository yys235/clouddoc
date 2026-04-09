"use client";

import type { CommentAnchor } from "@/lib/api";
import type { TextCommentRange } from "@/components/editor/text-block-surface";

export type SelectionToolbarState = {
  anchor: CommentAnchor;
  top: number;
  left: number;
};

export function threadIdAtOffset(ranges: TextCommentRange[], offset: number) {
  const match = ranges.find((range) => offset >= range.start && offset <= range.end);
  return match?.id ?? null;
}

export function buildSelectionToolbarState(
  blockId: string,
  value: string,
  start: number,
  end: number,
  clientX: number,
  clientY: number,
): SelectionToolbarState | null {
  const quoteText = value.slice(start, end);
  if (!quoteText.trim()) {
    return null;
  }

  return {
    anchor: {
      blockId,
      startOffset: start,
      endOffset: end,
      quoteText,
      prefixText: value.slice(Math.max(0, start - 16), start),
      suffixText: value.slice(end, Math.min(value.length, end + 16)),
    },
    top: Math.max(12, clientY - 44),
    left: Math.min(clientX, window.innerWidth - 120),
  };
}
