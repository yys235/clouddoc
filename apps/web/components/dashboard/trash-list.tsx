"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { DashboardDocument, restoreDocument } from "@/lib/api";

export function TrashList({ documents, enableLiveUpdates = false }: { documents: DashboardDocument[]; enableLiveUpdates?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [liveDocuments, setLiveDocuments] = useState(documents);
  const [restoreError, setRestoreError] = useState("");
  const handledEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLiveDocuments(documents);
  }, [documents]);

  useEffect(() => {
    if (!enableLiveUpdates) {
      return;
    }

    const source = new EventSource("/api/events/stream", { withCredentials: true });
    const listener = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          event_id?: string;
          event_type?: string;
          document_id?: string;
          document?: {
            id: string;
            title?: string;
            status?: string;
            visibility?: string;
            folder_id?: string | null;
            updated_at?: string;
            is_deleted?: boolean;
          };
        };
        if (payload.event_id) {
          if (handledEventIdsRef.current.has(payload.event_id)) {
            return;
          }
          handledEventIdsRef.current.add(payload.event_id);
          if (handledEventIdsRef.current.size > 500) {
            handledEventIdsRef.current = new Set(Array.from(handledEventIdsRef.current).slice(-250));
          }
        }
        const docId = payload.document?.id ?? payload.document_id;
        if (!docId) {
          return;
        }
        if (payload.event_type === "document.deleted" || payload.document?.is_deleted) {
          const updatedAt = payload.document?.updated_at
            ? new Intl.DateTimeFormat("zh-CN", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(payload.document.updated_at))
            : "--";
          setLiveDocuments((current) => {
            const existing = current.find((item) => item.id === docId);
            if (existing) {
              return current.map((item) =>
                item.id === docId
                  ? {
                      ...item,
                      title: payload.document?.title ?? item.title,
                      status: payload.document?.status ?? item.status,
                      visibility: payload.document?.visibility ?? item.visibility,
                      folderId: payload.document?.folder_id ?? item.folderId,
                      updatedAt,
                      isDeleted: true,
                    }
                  : item,
              );
            }
            return [
              {
                id: docId,
                title: payload.document?.title ?? "已删除文档",
                status: payload.document?.status ?? "draft",
                updatedAt,
                isDeleted: true,
                isFavorited: false,
                visibility: payload.document?.visibility ?? "private",
                canManage: false,
                folderId: payload.document?.folder_id ?? undefined,
              },
              ...current,
            ];
          });
          return;
        }
        if (payload.event_type === "document.restored") {
          setLiveDocuments((current) => current.filter((item) => item.id !== docId));
        }
      } catch {
        // Ignore malformed stream payloads.
      }
    };
    source.addEventListener("document.deleted", listener);
    source.addEventListener("document.restored", listener);
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.removeEventListener("document.deleted", listener);
      source.removeEventListener("document.restored", listener);
      source.close();
    };
  }, [enableLiveUpdates]);

  const handleRestore = (docId: string) => {
    startTransition(async () => {
      try {
        setRestoreError("");
        await restoreDocument(docId);
        setLiveDocuments((current) => current.filter((item) => item.id !== docId));
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
        {liveDocuments.length > 0 ? (
          liveDocuments.map((doc) => (
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
