import { OrganizationManagementPanel } from "@/components/auth/organization-management-panel";
import { AppShell } from "@/components/layout/app-shell";
import {
  DashboardPageFrame,
  OrganizationSummarySection,
  SpacesDirectorySection,
  SpacesSection,
} from "@/components/dashboard/dashboard-sections";
import {
  fetchCurrentOrganization,
  fetchOrganizationMembers,
  fetchSessions,
  fetchSpaces,
  fetchSpaceTree,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SpacesPage() {
  const { data: spaces, unavailable } = await fetchSpaces();
  const { data: currentOrganization } = await fetchCurrentOrganization();
  const { data: sessions } = await fetchSessions();
  const { data: members } = currentOrganization
    ? await fetchOrganizationMembers(currentOrganization.id)
    : { data: [] };
  const spaceTrees = await Promise.all(
    spaces.map(async (space) => {
      const { data: tree } = await fetchSpaceTree(space.id);
      return { space, tree };
    }),
  );

  return (
    <AppShell>
      <DashboardPageFrame
        title="团队空间"
        description="查看当前组织、成员、会话，以及各空间下的文件夹和文档层级。"
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
          <SpacesDirectorySection items={spaceTrees} />
        </div>
      </DashboardPageFrame>
    </AppShell>
  );
}
