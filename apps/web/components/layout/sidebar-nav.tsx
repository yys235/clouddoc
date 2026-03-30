"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createDocument, fetchSpaces, uploadPdfDocument } from "@/lib/api";

const navItems = [
  { label: "工作台", href: "/" },
  { label: "最近访问", href: "/recent" },
  { label: "我的文档", href: "/documents" },
  { label: "团队空间", href: "/spaces" },
  { label: "收藏", href: "/favorites" },
  { label: "模板中心", href: "/templates" },
  { label: "回收站", href: "/trash" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const closeCreateModal = () => {
    setShowCreatePanel(false);
    setPdfTitle("");
    setPdfFile(null);
  };

  const handleCreateDocument = () => {
    startTransition(async () => {
      try {
        setError("");
        const spaces = await fetchSpaces();
        const defaultSpace = spaces[0];
        if (!defaultSpace) {
          throw new Error("No available space");
        }

        const document = await createDocument({
          title: "未命名文档",
          spaceId: defaultSpace.id,
          documentType: "doc",
        });
        closeCreateModal();
        router.push(`/docs/${document.id}`);
        router.refresh();
      } catch {
        setError("新建文档失败");
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

        const spaces = await fetchSpaces();
        const defaultSpace = spaces[0];
        if (!defaultSpace) {
          throw new Error("No available space");
        }

        const document = await uploadPdfDocument({
          title: pdfTitle.trim() || pdfFile.name.replace(/\.pdf$/i, ""),
          spaceId: defaultSpace.id,
          file: pdfFile,
        });
        closeCreateModal();
        router.push(`/docs/${document.id}`);
        router.refresh();
      } catch {
        setError("PDF 上传失败");
      }
    });
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-slate-200 bg-white/95 px-3 py-4 backdrop-blur">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            CloudDoc
          </div>
          <div className="mt-1.5 text-xl font-semibold">云文档</div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreatePanel(true)}
          disabled={isPending}
          className="mb-2 rounded-lg bg-accent px-3 py-2.5 text-left text-sm font-medium text-white shadow-panel disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "处理中..." : "+ 新建文档"}
        </button>
        {error ? <div className="mb-3 text-xs text-rose-500">{error}</div> : null}

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              className={`block rounded-lg px-3 py-1.5 text-sm transition hover:bg-slate-100 hover:text-ink ${
                pathname === item.href
                  ? "bg-slate-100 font-medium text-ink shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]"
                  : "text-slate-600"
              }`}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {showCreatePanel ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0"
            onClick={closeCreateModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">新建文档</div>
                <div className="mt-1 text-sm text-slate-500">选择文档类型</div>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={handleCreateDocument}
                disabled={isPending}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 hover:border-slate-300"
              >
                <div className="font-medium text-slate-900">普通文档</div>
                <div className="mt-1 text-xs text-slate-500">可直接进入编辑页面</div>
              </button>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="font-medium text-slate-900">PDF 文档</div>
                <div className="mt-1 text-xs text-slate-500">上传后仅支持预览，暂不支持编辑</div>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={(event) => setPdfTitle(event.target.value)}
                  placeholder="PDF 标题，可留空"
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400"
                />
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  className="mt-3 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:text-slate-700"
                />
                <button
                  type="button"
                  onClick={handleUploadPdf}
                  disabled={isPending || !pdfFile}
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  上传 PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
