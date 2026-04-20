import { AppShell } from "@/components/layout/app-shell";
import { FolderWorkspaceView } from "@/components/folders/folder-workspace-view";
import {
  fetchCurrentOrganization,
  fetchOrganizationMembers,
  fetchSpaceRootChildren,
  fetchSpaces,
  fetchSpaceTree,
  fetchUserPreference,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const { space: requestedSpaceId } = await searchParams;
  const [
    { data: spaces, unavailable: spacesUnavailable },
    { data: userPreference, unavailable: preferenceUnavailable },
    { data: currentOrganization },
  ] = await Promise.all([fetchSpaces(), fetchUserPreference(), fetchCurrentOrganization()]);
  const { data: organizationMembers } = currentOrganization
    ? await fetchOrganizationMembers(currentOrganization.id)
    : { data: [] };
  const selectedSpace = spaces.find((space) => space.id === requestedSpaceId) ?? spaces[0] ?? null;
  const [{ data: rootChildren, unavailable: rootUnavailable }, { data: tree, unavailable: treeUnavailable }] =
    selectedSpace
      ? await Promise.all([fetchSpaceRootChildren(selectedSpace.id), fetchSpaceTree(selectedSpace.id)])
      : [
          { data: null, unavailable: false },
          { data: [], unavailable: false },
        ];

  return (
    <AppShell>
      <FolderWorkspaceView
        spaces={spaces}
        selectedSpace={selectedSpace}
        tree={tree}
        currentChildren={rootChildren}
        currentFolder={null}
        ancestors={[]}
        apiUnavailable={spacesUnavailable || rootUnavailable || treeUnavailable || preferenceUnavailable}
        initialDocumentTreeOpenMode={userPreference?.documentTreeOpenMode ?? "same-page"}
        mentionCandidates={organizationMembers}
      />
    </AppShell>
  );
}
