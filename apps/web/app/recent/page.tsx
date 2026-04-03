import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageFrame, DocumentListSection } from "@/components/dashboard/dashboard-sections";
import { fetchDocuments } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function RecentPage() {
  const { data: documents, unavailable } = await fetchDocuments("active");

  return (
    <AppShell>
      <DashboardPageFrame
        title="最近访问"
        description="查看最近访问和继续编辑的文档。当前版本先复用活跃文档列表作为最近访问数据。"
        apiUnavailable={unavailable}
      >
        <DocumentListSection
          title="最近访问文档"
          documents={documents}
          emptyText="当前还没有最近访问记录。"
        />
      </DashboardPageFrame>
    </AppShell>
  );
}
