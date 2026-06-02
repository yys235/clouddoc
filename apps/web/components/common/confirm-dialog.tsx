"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useState } from "react";

type DialogAnchor = {
  x: number;
  y: number;
};

let latestPointerAnchor: DialogAnchor | null = null;
let pointerTrackerInstalled = false;

function installPointerTracker() {
  if (pointerTrackerInstalled || typeof window === "undefined") {
    return;
  }
  pointerTrackerInstalled = true;
  window.addEventListener(
    "pointerdown",
    (event) => {
      latestPointerAnchor = {
        x: event.clientX,
        y: event.clientY,
      };
    },
    true,
  );
}

function positionedDialogStyle(anchor: DialogAnchor | null): CSSProperties | undefined {
  if (!anchor || typeof window === "undefined") {
    return undefined;
  }

  const dialogWidth = Math.min(448, window.innerWidth - 32);
  const estimatedHeight = 220;
  const gap = 12;
  const left = Math.max(16, Math.min(anchor.x - dialogWidth + 36, window.innerWidth - dialogWidth - 16));
  const shouldOpenAbove = anchor.y + estimatedHeight + gap > window.innerHeight;
  const top = shouldOpenAbove
    ? Math.max(16, anchor.y - estimatedHeight - gap)
    : Math.min(anchor.y + gap, window.innerHeight - estimatedHeight - 16);

  return {
    left,
    top,
    width: dialogWidth,
  };
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [anchor, setAnchor] = useState<DialogAnchor | null>(null);

  useEffect(() => {
    installPointerTracker();
  }, []);

  useEffect(() => {
    if (open) {
      setAnchor(latestPointerAnchor);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const dialogStyle = danger ? positionedDialogStyle(anchor) : undefined;

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/18 px-4 ${dialogStyle ? "" : "flex items-center justify-center"}`}>
      <div
        className={`rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] ${
          dialogStyle ? "fixed" : "w-full max-w-md"
        }`}
        style={dialogStyle}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          event.stopPropagation();
        }}
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70 ${
              danger ? "bg-rose-500" : "bg-slate-900"
            }`}
          >
            {pending ? "处理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
