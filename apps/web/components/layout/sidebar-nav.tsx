"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { GuestAuthLinks, UserMenu } from "@/components/auth/auth-actions";
import { createDocument, createFolder, fetchSpaces, fetchSpaceTree, importDocxDocument, uploadPdfDocument, type SpaceSummary, type TreeNode } from "@/lib/api";

const navItems = [
  { label: "工作台", href: "/" },
  { label: "最近访问", href: "/recent" },
  { label: "我的文档", href: "/documents" },
  { label: "团队空间", href: "/spaces" },
  { label: "通知", href: "/notifications" },
  { label: "收藏", href: "/favorites" },
  { label: "模板中心", href: "/templates" },
  { label: "个人配置", href: "/settings" },
  { label: "回收站", href: "/trash" },
];

function flattenFolders(nodes: TreeNode[]): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = [];
  const walk = (items: TreeNode[], prefix = "") => {
    for (const item of items) {
      if (item.nodeType === "folder") {
        const label = prefix ? `${prefix} / ${item.title}` : item.title;
        result.push({ id: item.id, label });
        if (item.children.length > 0) {
          walk(item.children, label);
        }
      }
    }
  };
  walk(nodes);
  return result;
}

export function SidebarNav({
  currentUser,
  currentOrganizationName,
  notificationUnreadCount = 0,
}: {
  currentUser?: { name: string; email: string } | null;
  currentOrganizationName?: string | null;
  notificationUnreadCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [availableSpaces, setAvailableSpaces] = useState<SpaceSummary[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentLocationMode, setDocumentLocationMode] = useState<"existing" | "new-folder">("existing");
  const [documentFolderId, setDocumentFolderId] = useState("__root__");
  const [newDocumentFolderTitle, setNewDocumentFolderTitle] = useState("");
  const [newDocumentFolderParentId, setNewDocumentFolderParentId] = useState("__root__");
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [docxTitle, setDocxTitle] = useState("");
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [liveUnreadCount, setLiveUnreadCount] = useState(notificationUnreadCount);
  const canCreate = Boolean(currentUser);

  useEffect(() => {
    setLiveUnreadCount(notificationUnreadCount);
  }, [notificationUnreadCount]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const source = new EventSource("/api/events/stream", { withCredentials: true });
    const handleCreated = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { notification?: { is_read?: boolean } };
        if (!payload.notification?.is_read) {
          setLiveUnreadCount((current) => current + 1);
        }
      } catch {
        setLiveUnreadCount((current) => current + 1);
      }
    };
    const handleRead = () => setLiveUnreadCount((current) => Math.max(0, current - 1));
    const handleReadAll = () => setLiveUnreadCount(0);

    source.addEventListener("notification.created", handleCreated);
    source.addEventListener("notification.read", handleRead);
    source.addEventListener("notification.read_all", handleReadAll);
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.removeEventListener("notification.created", handleCreated);
      source.removeEventListener("notification.read", handleRead);
      source.removeEventListener("notification.read_all", handleReadAll);
      source.close();
    };
  }, [currentUser]);

  const closeCreateModal = () => {
    setShowCreatePanel(false);
    setDocumentTitle("");
    setDocumentLocationMode("existing");
    setDocumentFolderId("__root__");
    setNewDocumentFolderTitle("");
    setNewDocumentFolderParentId("__root__");
    setPdfTitle("");
    setPdfFile(null);
    setDocxTitle("");
    setDocxFile(null);
  };

  const openCreateModal = () => {
    setShowCreatePanel(true);
    setError("");
    startTransition(async () => {
      try {
        const { data: spaces, unavailable } = await fetchSpaces();
        if (unavailable || spaces.length === 0) {
          throw new Error("No available space");
        }
        setAvailableSpaces(spaces);
        const nextSpaceId = selectedSpaceId || spaces[0].id;
        setSelectedSpaceId(nextSpaceId);
        const { data: tree } = await fetchSpaceTree(nextSpaceId);
        setFolderOptions(flattenFolders(tree));
      } catch {
        setError("加载创建位置失败，请确认后端服务和空间数据可用");
      }
    });
  };

  useEffect(() => {
    if (!showCreatePanel || !selectedSpaceId) {
      return;
    }

    let cancelled = false;
    fetchSpaceTree(selectedSpaceId)
      .then(({ data }) => {
        if (!cancelled) {
          setFolderOptions(flattenFolders(data));
          setDocumentFolderId("__root__");
          setNewDocumentFolderParentId("__root__");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFolderOptions([]);
          setError("加载文件夹树失败，请稍后重试");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSpaceId, showCreatePanel]);

  const handleCreateDocument = () => {
    startTransition(async () => {
      try {
        setError("");
        const spaceId = selectedSpaceId || availableSpaces[0]?.id;
        if (!spaceId) {
          throw new Error("No available space");
        }
        let targetFolderId = documentFolderId === "__root__" ? null : documentFolderId;
        if (documentLocationMode === "new-folder") {
          const folder = await createFolder({
            title: newDocumentFolderTitle.trim() || "未命名文件夹",
            spaceId,
            parentFolderId: newDocumentFolderParentId === "__root__" ? null : newDocumentFolderParentId,
          });
          targetFolderId = folder.id;
        }

        const document = await createDocument({
          title: documentTitle.trim() || "未命名文档",
          spaceId,
          folderId: targetFolderId,
          documentType: "doc",
        });
        closeCreateModal();
        router.push(`/docs/${document.id}`);
        router.refresh();
      } catch {
        setError("新建文档失败，请确认后端服务和空间数据可用");
      }
    });
  };

  const handleUploadPdf = () => {
    startTransition(async () => {
      try {
        setError("");
        if (!pdfFile) {
          throw new Error("No file selected");
        }

        const spaceId = selectedSpaceId || availableSpaces[0]?.id;
        if (!spaceId) {
          throw new Error("No available space");
        }
        let targetFolderId = documentFolderId === "__root__" ? null : documentFolderId;
        if (documentLocationMode === "new-folder") {
          const folder = await createFolder({
            title: newDocumentFolderTitle.trim() || "未命名文件夹",
            spaceId,
            parentFolderId: newDocumentFolderParentId === "__root__" ? null : newDocumentFolderParentId,
          });
          targetFolderId = folder.id;
        }

        const document = await uploadPdfDocument({
          title: pdfTitle.trim() || pdfFile.name.replace(/\.pdf$/i, ""),
          spaceId,
          folderId: targetFolderId,
          file: pdfFile,
        });
        closeCreateModal();
        router.push(`/docs/${document.id}`);
        router.refresh();
      } catch {
        setError("PDF 上传失败，请确认后端服务和空间数据可用");
      }
    });
  };

  const handleImportDocx = () => {
    startTransition(async () => {
      try {
        setError("");
        if (!docxFile) {
          throw new Error("No file selected");
        }

        const spaceId = selectedSpaceId || availableSpaces[0]?.id;
        if (!spaceId) {
          throw new Error("No available space");
        }
        let targetFolderId = documentFolderId === "__root__" ? null : documentFolderId;
        if (documentLocationMode === "new-folder") {
          const folder = await createFolder({
            title: newDocumentFolderTitle.trim() || "未命名文件夹",
            spaceId,
            parentFolderId: newDocumentFolderParentId === "__root__" ? null : newDocumentFolderParentId,
          });
          targetFolderId = folder.id;
        }

        const document = await importDocxDocument({
          title: docxTitle.trim() || docxFile.name.replace(/\.docx$/i, ""),
          spaceId,
          folderId: targetFolderId,
          file: docxFile,
        });
        closeCreateModal();
        router.push(`/docs/${document.id}`);
        router.refresh();
      } catch {
        setError("DOCX 导入失败，请确认后端服务和空间数据可用");
      }
    });
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-slate-300 bg-white px-2.5 py-3">
        <div className="mb-4 px-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            CloudDoc
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-950">云文档</div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={isPending || !canCreate}
          className="mb-2 bg-accent px-3 py-2 text-left text-sm font-medium text-white shadow-panel disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "处理中..." : "+ 新建文档"}
        </button>
        {!canCreate ? <div className="mb-3 text-xs text-slate-500">请先登录后再创建文档</div> : null}
        {error ? <div className="mb-3 text-xs text-rose-500">{error}</div> : null}

        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.label}
              className={`block px-2.5 py-1.5 text-sm transition hover:bg-slate-100 hover:text-ink ${
                pathname === item.href
                  ? "bg-slate-100 font-medium text-ink shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]"
                  : "text-slate-600"
              }`}
              href={item.href}
            >
              <span className="flex items-center justify-between gap-2">
                <span>{item.label}</span>
                {item.href === "/notifications" && liveUnreadCount > 0 ? (
                  <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                    {liveUnreadCount}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </nav>

        {currentUser ? (
          <UserMenu
            name={currentUser.name}
            email={currentUser.email}
            organizationName={currentOrganizationName}
          />
        ) : (
          <GuestAuthLinks />
        )}
      </aside>

      {showCreatePanel ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0"
            onClick={closeCreateModal}
            aria-hidden="true"
          />
          <div className="relative z-10 max-h-[88vh] w-full max-w-4xl overflow-y-auto border border-slate-300 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">新建文档</div>
                <div className="mt-1 text-xs text-slate-500">选择类型并确认创建位置</div>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="border border-slate-200 px-2.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <section className="border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">位置</div>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  空间
                  <select
                    value={selectedSpaceId}
                    onChange={(event) => setSelectedSpaceId(event.target.value)}
                    disabled={isPending || availableSpaces.length === 0}
                    className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 disabled:opacity-60"
                  >
                    {availableSpaces.map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block text-xs font-medium text-slate-600">
                  默认标题
                  <input
                    type="text"
                    value={documentTitle}
                    onChange={(event) => setDocumentTitle(event.target.value)}
                    placeholder="未命名文档"
                    className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
                  />
                </label>

                <div className="mt-3 space-y-2 border border-slate-200 bg-white p-2.5">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="global-document-location-mode"
                      checked={documentLocationMode === "existing"}
                      onChange={() => setDocumentLocationMode("existing")}
                      className="h-4 w-4 border-slate-300 text-accent"
                    />
                    选择已有位置
                  </label>
                  {documentLocationMode === "existing" ? (
                    <select
                      value={documentFolderId}
                      onChange={(event) => setDocumentFolderId(event.target.value)}
                      className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                      aria-label="选择文档创建位置"
                    >
                      <option value="__root__">根目录</option>
                      {folderOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="global-document-location-mode"
                      checked={documentLocationMode === "new-folder"}
                      onChange={() => setDocumentLocationMode("new-folder")}
                      className="h-4 w-4 border-slate-300 text-accent"
                    />
                    新建文件夹后创建
                  </label>
                  {documentLocationMode === "new-folder" ? (
                    <div className="grid gap-2">
                      <input
                        value={newDocumentFolderTitle}
                        onChange={(event) => setNewDocumentFolderTitle(event.target.value)}
                        placeholder="新文件夹名称"
                        className="w-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      />
                      <select
                        value={newDocumentFolderParentId}
                        onChange={(event) => setNewDocumentFolderParentId(event.target.value)}
                        className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                        aria-label="选择新文件夹父级位置"
                      >
                        <option value="__root__">根目录</option>
                        {folderOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={handleCreateDocument}
                  disabled={isPending || !selectedSpaceId}
                  className="flex min-h-[190px] flex-col border border-slate-300 bg-white p-4 text-left text-sm text-slate-700 hover:border-blue-400 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">DOC</div>
                  <div className="mt-2 text-base font-semibold text-slate-950">普通文档</div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">直接创建块文档，进入后可编辑正文、标题、列表、图片和评论。</p>
                  <span className="mt-auto inline-flex border border-slate-300 bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white">
                    {isPending ? "创建中..." : "创建文档"}
                  </span>
                </button>

                <div className="flex min-h-[190px] flex-col border border-slate-300 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">PDF</div>
                  <div className="mt-2 text-base font-semibold text-slate-950">PDF 文档</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">上传后只读预览，不支持编辑。</p>
                  <input
                    type="text"
                    value={pdfTitle}
                    onChange={(event) => setPdfTitle(event.target.value)}
                    placeholder="PDF 标题，可留空"
                    className="mt-3 w-full border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
                  />
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                    className="mt-2 block w-full text-xs text-slate-500 file:mr-2 file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleUploadPdf}
                    disabled={isPending || !pdfFile}
                    className="mt-auto w-full border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    上传 PDF
                  </button>
                </div>

                <div className="flex min-h-[190px] flex-col border border-slate-300 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">DOCX</div>
                  <div className="mt-2 text-base font-semibold text-slate-950">Word / DOCX</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">转换为普通文档，导入后可继续编辑。</p>
                  <input
                    type="text"
                    value={docxTitle}
                    onChange={(event) => setDocxTitle(event.target.value)}
                    placeholder="DOCX 标题，可留空"
                    className="mt-3 w-full border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
                  />
                  <input
                    type="file"
                    accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                    onChange={(event) => setDocxFile(event.target.files?.[0] ?? null)}
                    className="mt-2 block w-full text-xs text-slate-500 file:mr-2 file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleImportDocx}
                    disabled={isPending || !docxFile}
                    className="mt-auto w-full border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                  >
                    导入 DOCX
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
