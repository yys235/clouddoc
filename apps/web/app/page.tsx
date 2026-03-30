import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { fetchDocuments } from "@/lib/api";

export default async function HomePage() {
  const documents = await fetchDocuments("active");
  return (
    <AppShell>
      <WorkspaceOverview documents={documents} />
    </AppShell>
  );
}
