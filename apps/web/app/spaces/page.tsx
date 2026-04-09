import { OrganizationManagementPanel } from "@/components/auth/organization-management-panel";
import { AppShell } from "@/components/layout/app-shell";
import {
  DashboardPageFrame,
  OrganizationSummarySection,
  SpacesSection,
} from "@/components/dashboard/dashboard-sections";
import {
  fetchCurrentOrganization,
  fetchOrganizationMembers,
  fetchSessions,
  fetchSpaces,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SpacesPage() {
  const { data: spaces, unavailable } = await fetchSpaces();
  const { data: currentOrganization } = await fetchCurrentOrganization();
  const { data: sessions } = await fetchSessions();
  const { data: members } = currentOrganization
    ? await fetchOrganizationMembers(currentOrganization.id)
    : { data: [] };

  return (
    <AppShell>
      <DashboardPageFrame
        title="团队空间"
        description="展示当前系统里的空间数据。后续这里会继续补目录树、权限与空间内文档关系。"
        apiUnavailable={unavailable}
      >
        <div className="space-y-5">
          <OrganizationManagementPanel
            currentOrganization={currentOrganization}
            members={members}
            sessions={sessions}
          />
          <OrganizationSummarySection organization={currentOrganization} members={members} />
          <SpacesSection spaces={spaces} />
        </div>
      </DashboardPageFrame>
    </AppShell>
  );
}
