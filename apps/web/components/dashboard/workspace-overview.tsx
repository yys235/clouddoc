import Link from "next/link";

import { DashboardDocument } from "@/lib/api";
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
}: {
  documents: DashboardDocument[];
}) {
  const cards = buildCards(documents);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5">
      <section id="workspace" className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="max-w-2xl">
          <div className="text-sm font-medium text-accent">V1 Workspace</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            飞书式连续文档体验，结构化内容底层
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            当前页面只展示真实后端返回的数据。后端不可用时，将显示空状态或错误提示，不再填充演示数据。
          </p>
          <SearchForm />
        </div>
      </section>

      <section id="recent-documents" className="grid gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className="rounded-2xl bg-white p-5 shadow-panel">
            <div className="text-sm text-slate-500">{card.title}</div>
            <div className="mt-2 text-2xl font-semibold">{card.value}</div>
            <div className="mt-1.5 text-sm text-slate-500">{card.note}</div>
          </article>
        ))}
      </section>

      <section id="my-documents" className="rounded-3xl bg-white p-5 shadow-panel">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近文档</h2>
          <Link className="text-sm font-medium text-accent" href="/documents">
            查看全部
          </Link>
        </div>
        <div className="space-y-2">
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
                <div className="rounded-lg bg-mist px-3 py-1 text-xs font-medium text-slate-600">
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
