import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { fetchDocuments } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: documents, unavailable } = await fetchDocuments("active");
  return (
    <AppShell>
      <WorkspaceOverview documents={documents} apiUnavailable={unavailable} />
    </AppShell>
  );
}
