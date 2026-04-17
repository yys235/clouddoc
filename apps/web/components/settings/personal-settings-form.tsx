"use client";

import { useState, useTransition } from "react";

import { type DocumentTreeOpenMode, type UserPreference, updateUserPreference } from "@/lib/api";

export function PersonalSettingsForm({
  preference,
}: {
  preference: UserPreference | null;
}) {
  const [documentTreeOpenMode, setDocumentTreeOpenMode] = useState<DocumentTreeOpenMode>(
    preference?.documentTreeOpenMode ?? "same-page",
  );
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  const savePreference = () => {
    startTransition(async () => {
      try {
        setNotice("");
        await updateUserPreference({ documentTreeOpenMode });
        setNotice("个人配置已保存");
      } catch {
        setNotice("保存失败，请确认后端服务可用并且当前已登录");
      }
    });
  };

  return (
    <section className="rounded-3xl bg-white p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Personal Settings</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">个人配置</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            这里保存个人使用习惯，配置会写入后端并跟随账号生效。
          </p>
        </div>
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-slate-100 p-4">
        <div className="text-base font-semibold text-slate-900">文件树打开方式</div>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          控制从左侧文档树点击文档时，是在当前页面打开，还是打开新的浏览器标签/窗口。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-lg border px-4 py-3 transition ${
              documentTreeOpenMode === "same-page" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="documentTreeOpenMode"
              value="same-page"
              checked={documentTreeOpenMode === "same-page"}
              onChange={() => setDocumentTreeOpenMode("same-page")}
              className="sr-only"
            />
            <div className="text-sm font-medium text-slate-900">本页打开</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">适合连续浏览同一目录下的文档。</div>
          </label>
          <label
            className={`cursor-pointer rounded-lg border px-4 py-3 transition ${
              documentTreeOpenMode === "new-window" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="documentTreeOpenMode"
              value="new-window"
              checked={documentTreeOpenMode === "new-window"}
              onChange={() => setDocumentTreeOpenMode("new-window")}
              className="sr-only"
            />
            <div className="text-sm font-medium text-slate-900">新窗口打开</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">适合保留目录页，同时并行查看多个文档。</div>
          </label>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={savePreference}
          disabled={isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "保存中..." : "保存配置"}
        </button>
        {notice ? <div className="text-sm text-slate-600">{notice}</div> : null}
      </div>
    </section>
  );
}
