"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { DashboardDocument, subscribeDocumentLibraryBrowserEvents } from "@/lib/api";
import { SearchForm } from "@/components/search/search-form";

function buildCards(documents: DashboardDocument[]) {
  const activeDocuments = documents.filter((item) => !item.isDeleted);
  const draftDocuments = activeDocuments.filter((item) => item.status !== "published");
  const publishedDocuments = activeDocuments.filter((item) => item.status === "published");

  return [
    { title: "活跃文档", value: `${activeDocuments.length} 篇`, note: "当前从真实后端返回的可用文档数量" },
    { title: "草稿文档", value: `${draftDocuments.length} 篇`, note: "状态为草稿的文档数量" },
    { title: "已发布文档", value: `${publishedDocuments.length} 篇`, note: "状态为已发布的文档数量" },
  ];
}

export function WorkspaceOverview({
  documents,
  apiUnavailable = false,
  enableLiveUpdates = false,
}: {
  documents: DashboardDocument[];
  apiUnavailable?: boolean;
  enableLiveUpdates?: boolean;
}) {
  const [liveDocuments, setLiveDocuments] = useState(documents);
  const handledEventIdsRef = useRef<Set<string>>(new Set());
  const cards = buildCards(liveDocuments);

  useEffect(() => {
    setLiveDocuments(documents);
  }, [documents]);

  useEffect(() => {
    return subscribeDocumentLibraryBrowserEvents((event) => {
      if (event.event_type === "document.deleted") {
        setLiveDocuments((current) => current.filter((item) => item.id !== event.document_id));
      }
    });
  }, []);

  useEffect(() => {
    if (apiUnavailable || !enableLiveUpdates) {
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
          setLiveDocuments((current) => current.filter((item) => item.id !== docId));
          return;
        }
        if (!payload.document) {
          return;
        }
        setLiveDocuments((current) =>
          current.map((item) =>
            item.id === docId
              ? {
                  ...item,
                  title: payload.document?.title ?? item.title,
                  status: payload.document?.status ?? item.status,
                  visibility: payload.document?.visibility ?? item.visibility,
                  folderId: payload.document?.folder_id ?? item.folderId,
                  updatedAt: payload.document?.updated_at
                    ? new Intl.DateTimeFormat("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(payload.document.updated_at))
                    : item.updatedAt,
                }
              : item,
          ),
        );
      } catch {
        // Keep the current list if a transient SSE payload cannot be parsed.
      }
    };
    const eventNames = [
      "document.updated",
      "document.renamed",
      "document.deleted",
      "document.restored",
      "document.content_updated",
      "document.permission_changed",
    ];
    for (const eventName of eventNames) {
      source.addEventListener(eventName, listener);
    }
    source.onerror = () => {
      source.close();
    };
    return () => {
      for (const eventName of eventNames) {
        source.removeEventListener(eventName, listener);
      }
      source.close();
    };
  }, [apiUnavailable, enableLiveUpdates]);

  return (
    <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-3">
      {apiUnavailable ? <ApiUnavailableNotice /> : null}
      <section id="workspace" className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <div className="max-w-2xl">
          <div className="text-sm font-medium text-accent">V1 Workspace</div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">
            飞书式连续文档体验，结构化内容底层
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            当前页面只展示真实后端返回的数据。后端不可用时，将显示空状态或错误提示，不再填充演示数据。
          </p>
          <SearchForm />
        </div>
      </section>

      <section id="recent-documents" className="grid gap-2.5 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className="border border-slate-200 bg-white px-4 py-3 shadow-panel">
            <div className="text-sm text-slate-500">{card.title}</div>
            <div className="mt-2 text-2xl font-semibold">{card.value}</div>
            <div className="mt-1.5 text-sm text-slate-500">{card.note}</div>
          </article>
        ))}
      </section>

      <section id="my-documents" className="border border-slate-200 bg-white px-4 py-3 shadow-panel">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近文档</h2>
          <Link className="text-sm font-medium text-accent" href="/documents">
            查看全部
          </Link>
        </div>
        <div className="space-y-1.5">
          {liveDocuments.length > 0 ? (
            liveDocuments.map((doc) => (
              <Link
                key={doc.id}
                href={`/docs/${doc.id}`}
                className="flex items-center justify-between border border-slate-200 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-medium">{doc.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{doc.updatedAt}</div>
                </div>
                <div className="bg-mist px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {doc.status === "published" ? "已发布" : "草稿"}
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              当前没有可显示的文档。请确认后端服务是否可用。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
