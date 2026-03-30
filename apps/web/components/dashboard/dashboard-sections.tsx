import Link from "next/link";

import { DashboardDocument, SpaceSummary } from "@/lib/api";

function statusLabel(status: string) {
  return status === "published" ? "已发布" : "草稿";
}

export function DashboardPageFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5">
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
}: {
  title: string;
  documents: DashboardDocument[];
  emptyText: string;
  badge?: boolean;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {documents.length > 0 ? (
          documents.map((doc) => (
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
