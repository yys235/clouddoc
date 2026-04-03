import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageFrame, DocumentListSection } from "@/components/dashboard/dashboard-sections";
import { fetchDocuments } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const { data: documents, unavailable } = await fetchDocuments("all");
  const favoriteDocuments = documents.filter((item) => item.isFavorited && !item.isDeleted);

  return (
    <AppShell>
      <DashboardPageFrame
        title="收藏"
        description="查看已收藏文档。收藏状态来自真实后端数据。"
        apiUnavailable={unavailable}
      >
        <DocumentListSection
          title="收藏文档"
          documents={favoriteDocuments}
          emptyText="当前还没有真实收藏文档。"
          badge
        />
      </DashboardPageFrame>
    </AppShell>
  );
}
