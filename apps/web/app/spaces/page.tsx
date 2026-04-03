import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageFrame, SpacesSection } from "@/components/dashboard/dashboard-sections";
import { fetchSpaces } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SpacesPage() {
  const { data: spaces, unavailable } = await fetchSpaces();

  return (
    <AppShell>
      <DashboardPageFrame
        title="团队空间"
        description="展示当前系统里的空间数据。后续这里会继续补目录树、权限与空间内文档关系。"
        apiUnavailable={unavailable}
      >
        <SpacesSection spaces={spaces} />
      </DashboardPageFrame>
    </AppShell>
  );
}
