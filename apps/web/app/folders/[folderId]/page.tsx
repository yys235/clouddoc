import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { FolderWorkspaceView } from "@/components/folders/folder-workspace-view";
import {
  fetchCurrentOrganization,
  fetchFolder,
  fetchFolderAncestors,
  fetchFolderChildren,
  fetchOrganizationMembers,
  fetchSpaces,
  fetchSpaceTree,
  fetchUserPreference,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const { data: folder, unavailable } = await fetchFolder(folderId);

  if (!folder) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl p-5">
          <section className="rounded-3xl bg-white p-6 shadow-panel">
            <div className="text-sm font-medium text-accent">Folder</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {unavailable ? "文件夹暂时不可用" : "文件夹不存在、已删除或无权限访问"}
            </h1>
            <div className="mt-5 flex gap-3">
              <Link href="/documents" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
                返回文档树
              </Link>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  const [
    { data: spaces },
    { data: tree, unavailable: treeUnavailable },
    { data: children, unavailable: childrenUnavailable },
    { data: ancestors, unavailable: ancestorsUnavailable },
    { data: userPreference, unavailable: preferenceUnavailable },
    { data: currentOrganization },
  ] =
    await Promise.all([
      fetchSpaces(),
      fetchSpaceTree(folder.spaceId),
      fetchFolderChildren(folder.id),
      fetchFolderAncestors(folder.id),
      fetchUserPreference(),
      fetchCurrentOrganization(),
    ]);

  const selectedSpace = spaces.find((space) => space.id === folder.spaceId) ?? null;
  const { data: organizationMembers } = currentOrganization
    ? await fetchOrganizationMembers(currentOrganization.id)
    : { data: [] };

  return (
    <AppShell>
      <FolderWorkspaceView
        spaces={spaces}
        selectedSpace={selectedSpace}
        tree={tree}
        currentChildren={children}
        currentFolder={folder}
        ancestors={ancestors}
        apiUnavailable={unavailable || treeUnavailable || childrenUnavailable || ancestorsUnavailable || preferenceUnavailable}
        initialDocumentTreeOpenMode={userPreference?.documentTreeOpenMode ?? "same-page"}
        mentionCandidates={organizationMembers}
      />
    </AppShell>
  );
}
