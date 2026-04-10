"use client";

import { useEffect, useMemo, useState } from "react";

import {
  disableDocumentShare,
  fetchDocumentShareSettings,
  rotateDocumentShare,
  type ShareLinkSettings,
  updateDocumentVisibility,
  upsertDocumentShare,
} from "@/lib/api";

function toLocalDateTimeValue(value?: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function absoluteShareUrl(shareUrl?: string) {
  if (!shareUrl) {
    return "";
  }
  if (typeof window === "undefined") {
    return shareUrl;
  }
  if (/^https?:\/\//i.test(shareUrl)) {
    return shareUrl;
  }
  return `${window.location.origin}${shareUrl}`;
}

export function DocumentShareDialog({
  open,
  documentId,
  currentVisibility,
  onClose,
  onSaved,
}: {
  open: boolean;
  documentId: string;
  currentVisibility: "private" | "public";
  onClose: () => void;
  onSaved: (next: { visibility: "private" | "public"; share: ShareLinkSettings | null }) => void;
}) {
  const [visibility, setVisibility] = useState<"private" | "public">(currentVisibility);
  const [enabled, setEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [allowCopy, setAllowCopy] = useState(false);
  const [allowExport, setAllowExport] = useState(false);
  const [share, setShare] = useState<ShareLinkSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setVisibility(currentVisibility);
    setPassword("");
    setNotice("");
    setLoading(true);
    void fetchDocumentShareSettings(documentId)
      .then((result) => {
        const nextShare = result.data;
        setShare(nextShare);
        setEnabled(Boolean(nextShare?.isEnabled));
        setExpiresAt(toLocalDateTimeValue(nextShare?.expiresAt));
        setAllowCopy(Boolean(nextShare?.allowCopy));
        setAllowExport(Boolean(nextShare?.allowExport));
      })
      .finally(() => setLoading(false));
  }, [currentVisibility, documentId, open]);

  const resolvedShareUrl = useMemo(() => absoluteShareUrl(share?.shareUrl), [share?.shareUrl]);

  if (!open) {
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    setNotice("");
    try {
      await updateDocumentVisibility(documentId, visibility);
      let nextShare: ShareLinkSettings | null = share;
      if (enabled) {
        nextShare = await upsertDocumentShare(documentId, {
          enabled: true,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          password: password || null,
          allowCopy,
          allowExport,
        });
      } else if (share?.id || share?.token) {
        nextShare = await disableDocumentShare(documentId);
      } else {
        nextShare = null;
      }
      setShare(nextShare);
      setPassword("");
      onSaved({ visibility, share: enabled ? nextShare : null });
      setNotice("权限与分享设置已保存");
    } catch {
      setNotice("权限与分享设置保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    setSaving(true);
    setNotice("");
    try {
      const nextShare = await rotateDocumentShare(documentId);
      setShare(nextShare);
      setEnabled(Boolean(nextShare.isEnabled));
      setNotice("分享链接已重新生成");
    } catch {
      setNotice("重新生成链接失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDisableShare = async () => {
    setSaving(true);
    setNotice("");
    try {
      const nextShare = await disableDocumentShare(documentId);
      setShare(nextShare);
      setEnabled(false);
      setPassword("");
      setNotice("分享已关闭");
      onSaved({ visibility, share: null });
    } catch {
      setNotice("关闭分享失败");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!resolvedShareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(resolvedShareUrl);
      setNotice("分享链接已复制");
    } catch {
      setNotice("复制分享链接失败");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/18 px-4">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">权限与分享</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              配置文档可见性，以及独立的只读分享访问方式。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
          >
            关闭
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <section className="space-y-2.5">
            <div className="text-sm font-medium text-slate-900">文档可见性</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "private" as const, label: "私有文档", desc: "只有作者和授权用户可访问原文档链接" },
                { value: "public" as const, label: "公开文档", desc: "任何人都可以访问原文档链接" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setVisibility(item.value)}
                  className={`rounded-lg border px-3 py-3 text-left ${
                    visibility === item.value
                      ? "border-sky-300 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">独立分享链接</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  分享页复用同一套阅读组件，但强制只读，不允许编辑。
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                启用分享
              </label>
            </div>

            <div className={`space-y-3 rounded-lg border border-slate-200 p-4 ${enabled ? "bg-slate-50/60" : "bg-slate-50/30 opacity-65"}`}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">过期时间</div>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    disabled={!enabled}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">分享密码</div>
                  <input
                    type="text"
                    value={password}
                    disabled={!enabled}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={share?.requiresPassword ? "保持为空表示沿用当前密码" : "可选，留空则不设密码"}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowCopy}
                    disabled={!enabled}
                    onChange={(event) => setAllowCopy(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  允许复制内容
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowExport}
                    disabled={!enabled}
                    onChange={(event) => setAllowExport(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  允许导出
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                {loading ? (
                  "正在加载分享设置..."
                ) : resolvedShareUrl ? (
                  <div className="space-y-2">
                    <div className="break-all font-medium text-slate-800">{resolvedShareUrl}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>访问次数 {share?.accessCount ?? 0}</span>
                      {share?.lastAccessedAt ? <span>最近访问 {new Date(share.lastAccessedAt).toLocaleString("zh-CN")}</span> : null}
                      {share?.requiresPassword ? <span>已启用密码</span> : <span>未设密码</span>}
                    </div>
                  </div>
                ) : (
                  "保存后会生成独立分享链接。"
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!resolvedShareUrl || saving}
                  onClick={handleCopyShareLink}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
                >
                  复制分享链接
                </button>
                <button
                  type="button"
                  disabled={!share?.token || !enabled || saving}
                  onClick={handleRotate}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
                >
                  重新生成链接
                </button>
                <button
                  type="button"
                  disabled={!share?.token || saving}
                  onClick={handleDisableShare}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-600 disabled:opacity-60"
                >
                  关闭分享
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{notice}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-70"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
            >
              {saving ? "保存中..." : "保存设置"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
