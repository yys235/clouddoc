import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageFrame, DocumentListSection, FolderListSection } from "@/components/dashboard/dashboard-sections";
import { fetchCurrentUser, fetchDocuments, fetchFavoriteFolders } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const [{ data: documents, unavailable }, { data: folders, unavailable: foldersUnavailable }, { data: currentUser }] = await Promise.all([
    fetchDocuments("all"),
    fetchFavoriteFolders(),
    fetchCurrentUser(),
  ]);
  const favoriteDocuments = documents.filter((item) => item.isFavorited && !item.isDeleted);

  return (
    <AppShell>
      <DashboardPageFrame
        title="收藏"
        description="查看已收藏文档和文件夹。收藏状态来自真实后端数据。"
        apiUnavailable={unavailable || foldersUnavailable}
      >
        <FolderListSection
          title="收藏文件夹"
          folders={folders}
          emptyText="当前还没有真实收藏文件夹。"
          badge
        />
        <DocumentListSection
          title="收藏文档"
          documents={favoriteDocuments}
          emptyText="当前还没有真实收藏文档。"
          badge
          enableLiveUpdates={Boolean(currentUser)}
        />
      </DashboardPageFrame>
    </AppShell>
  );
}
