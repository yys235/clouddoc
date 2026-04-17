import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { fetchCurrentUser, fetchDocuments } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ data: documents, unavailable }, { data: currentUser }] = await Promise.all([
    fetchDocuments("active"),
    fetchCurrentUser(),
  ]);
  return (
    <AppShell>
      <WorkspaceOverview
        documents={documents}
        apiUnavailable={unavailable}
        enableLiveUpdates={Boolean(currentUser)}
      />
    </AppShell>
  );
}
