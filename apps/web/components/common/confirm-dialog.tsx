"use client";

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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/18 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
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
