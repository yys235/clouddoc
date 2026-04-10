import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { DocumentPage } from "@/components/editor/document-page";
import { fetchCurrentOrganization, fetchDocument, fetchOrganizationMembers } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ docId: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { docId } = await params;
  const { thread } = await searchParams;
  const { data: document, unavailable } = await fetchDocument(docId);
  const { data: currentOrganization } = await fetchCurrentOrganization();
  const { data: organizationMembers } = currentOrganization
    ? await fetchOrganizationMembers(currentOrganization.id)
    : { data: [] };

  if (!document) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl p-5">
          <section className="rounded-3xl bg-white p-6 shadow-panel">
            <div className="text-sm font-medium text-accent">Document</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {unavailable ? "文档暂时不可用" : "文档不存在、已删除或无权限访问"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {unavailable
                ? "当前无法从后端读取文档数据。请先确认后端服务和数据库连接正常，再重新打开此页面。"
                : "当前文档未找到。请确认链接是否正确，或者返回文档列表重新选择。"}
            </p>
            <div className="mt-5 flex gap-3">
              <Link
                href="/documents"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                返回文档列表
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                返回工作台
              </Link>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <DocumentPage
      document={document}
      mentionCandidates={organizationMembers}
      initialActiveThreadId={thread ?? null}
    />
  );
}
