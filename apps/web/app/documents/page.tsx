import { AppShell } from "@/components/layout/app-shell";
import { FolderWorkspaceView } from "@/components/folders/folder-workspace-view";
import { fetchSpaceRootChildren, fetchSpaces, fetchSpaceTree } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const { space: requestedSpaceId } = await searchParams;
  const { data: spaces, unavailable: spacesUnavailable } = await fetchSpaces();
  const selectedSpace = spaces.find((space) => space.id === requestedSpaceId) ?? spaces[0] ?? null;
  const { data: rootChildren, unavailable: rootUnavailable } = selectedSpace
    ? await fetchSpaceRootChildren(selectedSpace.id)
    : { data: null, unavailable: false };
  const { data: tree, unavailable: treeUnavailable } = selectedSpace
    ? await fetchSpaceTree(selectedSpace.id)
    : { data: [], unavailable: false };

  return (
    <AppShell>
      <FolderWorkspaceView
        spaces={spaces}
        selectedSpace={selectedSpace}
        tree={tree}
        currentChildren={rootChildren}
        currentFolder={null}
        ancestors={[]}
        apiUnavailable={spacesUnavailable || rootUnavailable || treeUnavailable}
      />
    </AppShell>
  );
}
