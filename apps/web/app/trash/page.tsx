import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageFrame } from "@/components/dashboard/dashboard-sections";
import { TrashList } from "@/components/dashboard/trash-list";
import { fetchDocuments } from "@/lib/api";

export default async function TrashPage() {
  const trashDocuments = await fetchDocuments("trash");

  return (
    <AppShell>
      <DashboardPageFrame
        title="回收站"
        description="查看已软删除文档，并支持从这里恢复。"
      >
        <TrashList documents={trashDocuments} />
      </DashboardPageFrame>
    </AppShell>
  );
}
