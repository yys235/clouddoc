"use client";

import type { SelectionToolbarState } from "@/components/editor/text-block-selection-utils";

export function CommentSelectionToolbar({
  selection,
  onCreate,
  onCancel,
}: {
  selection: SelectionToolbarState | null;
  onCreate: (selection: SelectionToolbarState) => void;
  onCancel: () => void;
}) {
  if (!selection) {
    return null;
  }

  return (
    <div
      data-editor-floating-window="true"
      className="fixed z-40"
      style={{
        top: selection.top,
        left: selection.left,
      }}
    >
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-[0_14px_32px_rgba(15,23,42,0.14)]">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={(event) => {
            event.stopPropagation();
            onCreate(selection);
          }}
        >
          评论
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-50"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
}
