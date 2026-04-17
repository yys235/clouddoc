"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { CurrentOrganization, DashboardDocument, OrganizationMember, SpaceSummary, TreeNode } from "@/lib/api";

function statusLabel(status: string) {
  return status === "published" ? "已发布" : "草稿";
}

export function DashboardPageFrame({
  title,
  description,
  actions,
  apiUnavailable = false,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  apiUnavailable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5">
      {apiUnavailable ? <ApiUnavailableNotice /> : null}
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-sm font-medium text-accent">Workspace Page</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </section>
      {children}
    </div>
  );
}

export function DocumentListSection({
  title,
  documents,
  emptyText,
  badge = false,
  enableLiveUpdates = false,
}: {
  title: string;
  documents: DashboardDocument[];
  emptyText: string;
  badge?: boolean;
  enableLiveUpdates?: boolean;
}) {
  const [liveDocuments, setLiveDocuments] = useState(documents);
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
        // Ignore malformed events and keep the current rendered list.
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
  }, [enableLiveUpdates]);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {liveDocuments.length > 0 ? (
          liveDocuments.map((doc) => (
            <Link
              key={doc.id}
              href={`/docs/${doc.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-3 transition hover:border-slate-200 hover:bg-slate-50"
            >
              <div>
                <div className="text-sm font-medium">{doc.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{doc.updatedAt}</div>
              </div>
              <div
                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                  badge
                    ? "bg-amber-50 text-amber-700"
                    : "bg-mist text-slate-600"
                }`}
              >
                {badge ? "已收藏" : statusLabel(doc.status)}
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm leading-6 text-slate-600">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

export function SpacesSection({ spaces }: { spaces: SpaceSummary[] }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold">团队空间</h2>
      <div className="mt-3 space-y-2">
        {spaces.length > 0 ? (
          spaces.map((space) => (
            <div
              key={space.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-3"
            >
              <div>
                <div className="text-sm font-medium">{space.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {space.spaceType === "team" ? "团队空间" : "个人空间"} · {space.visibility}
                </div>
              </div>
              <div className="rounded-lg bg-mist px-3 py-1 text-xs font-medium text-slate-600">
                {space.updatedAt}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-slate-600">当前还没有可用空间。</p>
        )}
      </div>
    </section>
  );
}

function SpaceTreeNodes({ nodes, level = 0 }: { nodes: TreeNode[]; level?: number }) {
  if (nodes.length === 0) {
    return <p className="text-xs leading-5 text-slate-500">当前空间暂无目录内容。</p>;
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <div key={`${node.nodeType}-${node.id}`} style={{ paddingLeft: level * 14 }}>
          <Link
            href={node.nodeType === "folder" ? `/folders/${node.id}` : `/docs/${node.id}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-accent"
          >
            <span className="text-slate-400">{node.nodeType === "folder" ? "📁" : "📄"}</span>
            <span className="min-w-0 flex-1 truncate">{node.title}</span>
            <span className="shrink-0 text-xs text-slate-400">
              {node.nodeType === "folder" ? "文件夹" : node.documentType || "文档"}
            </span>
          </Link>
          {node.children.length > 0 ? <SpaceTreeNodes nodes={node.children} level={level + 1} /> : null}
        </div>
      ))}
    </div>
  );
}

export function SpacesDirectorySection({
  items,
}: {
  items: Array<{ space: SpaceSummary; tree: TreeNode[] }>;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">空间目录</h2>
          <p className="mt-1 text-sm text-slate-500">按空间查看当前文件夹和文档层级。</p>
        </div>
        <Link href="/documents" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          打开我的文档
        </Link>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.space.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{item.space.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {item.space.spaceType === "team" ? "团队空间" : "个人空间"} · {item.space.visibility}
                  </div>
                </div>
                <Link
                  href={`/documents?space=${item.space.id}`}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  进入
                </Link>
              </div>
              <SpaceTreeNodes nodes={item.tree} />
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-slate-600">当前还没有可用空间。</p>
        )}
      </div>
    </section>
  );
}

export function OrganizationSummarySection({
  organization,
  members,
}: {
  organization: CurrentOrganization | null;
  members: OrganizationMember[];
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold">当前组织</h2>
      {organization ? (
        <>
          <div className="mt-3 rounded-lg border border-slate-100 px-3.5 py-3">
            <div className="text-sm font-medium">{organization.name}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              角色：{organization.role} · 成员 {organization.memberCount} 人
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-sm font-medium text-slate-800">成员</div>
            <div className="space-y-2">
              {members.length > 0 ? (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-medium">{member.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{member.email}</div>
                    </div>
                    <div className="rounded-lg bg-mist px-3 py-1 text-xs font-medium text-slate-600">
                      {member.role}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-600">当前组织还没有成员数据。</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-600">当前没有可用的组织上下文。</p>
      )}
    </section>
  );
}
