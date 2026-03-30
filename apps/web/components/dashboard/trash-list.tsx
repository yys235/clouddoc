"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DashboardDocument, restoreDocument } from "@/lib/api";

export function TrashList({ documents }: { documents: DashboardDocument[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [restoreError, setRestoreError] = useState("");

  const handleRestore = (docId: string) => {
    startTransition(async () => {
      try {
        setRestoreError("");
        await restoreDocument(docId);
        router.refresh();
      } catch {
        setRestoreError("恢复失败");
      }
    });
  };

  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold">回收站</h2>
      {restoreError ? <p className="mt-2 text-sm text-rose-500">{restoreError}</p> : null}
      <div className="mt-3 space-y-2">
        {documents.length > 0 ? (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-3"
            >
              <div>
                <div className="text-sm font-medium">{doc.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{doc.updatedAt}</div>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRestore(doc.id)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                恢复
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-slate-600">回收站当前为空。</p>
        )}
      </div>
    </section>
  );
}
