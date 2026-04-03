import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageFrame } from "@/components/dashboard/dashboard-sections";
import { TrashList } from "@/components/dashboard/trash-list";
import { fetchDocuments } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const { data: trashDocuments, unavailable } = await fetchDocuments("trash");

  return (
    <AppShell>
      <DashboardPageFrame
        title="回收站"
        description="查看已软删除文档，并支持从这里恢复。"
        apiUnavailable={unavailable}
      >
        <TrashList documents={trashDocuments} />
      </DashboardPageFrame>
    </AppShell>
  );
}
