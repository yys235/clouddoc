import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageFrame, DocumentListSection } from "@/components/dashboard/dashboard-sections";
import { fetchDocuments } from "@/lib/api";

export default async function DocumentsPage() {
  const documents = await fetchDocuments("active");

  return (
    <AppShell>
      <DashboardPageFrame
        title="我的文档"
        description="集中查看当前可用的活跃文档，并从这里进入文档详情页。"
      >
        <DocumentListSection
          title="文档列表"
          documents={documents}
          emptyText="当前还没有可用文档。"
        />
      </DashboardPageFrame>
    </AppShell>
  );
}
