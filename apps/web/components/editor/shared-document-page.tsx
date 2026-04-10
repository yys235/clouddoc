"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { DocumentPage } from "@/components/editor/document-page";
import { verifySharedDocumentPassword, type ShareLinkSettings } from "@/lib/api";
import type { DocumentViewModel } from "@/lib/mock-document";

export function SharedDocumentPage({
  token,
  initialStatus,
  initialDocument,
  initialShare,
}: {
  token: string;
  initialStatus: string;
  initialDocument: DocumentViewModel | null;
  initialShare: ShareLinkSettings | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [document, setDocument] = useState<DocumentViewModel | null>(initialDocument);
  const [share, setShare] = useState<ShareLinkSettings | null>(initialShare);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const copyRestricted = useMemo(() => Boolean(share && !share.allowCopy), [share]);

  if (status === "ok" && document) {
    return (
      <div
        onCopy={
          copyRestricted
            ? (event) => {
                event.preventDefault();
              }
            : undefined
        }
        onCut={
          copyRestricted
            ? (event) => {
                event.preventDefault();
              }
            : undefined
        }
      >
        <DocumentPage document={document} mentionCandidates={[]} shareSettings={share} />
      </div>
    );
  }

  if (status === "password_required") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfbf8] px-4">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <h1 className="text-xl font-semibold text-slate-900">输入分享密码</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">该文档需要密码后才可访问。</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入分享密码"
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none"
          />
          {notice ? <div className="mt-3 text-sm text-rose-600">{notice}</div> : null}
          <div className="mt-5 flex items-center justify-between gap-2">
            <Link href="/" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">
              返回首页
            </Link>
            <button
              type="button"
              disabled={!password.trim() || submitting}
              onClick={async () => {
                setSubmitting(true);
                setNotice("");
                try {
                  const response = await verifySharedDocumentPassword(token, password.trim());
                  setStatus(response.status);
                  setDocument(response.document);
                  setShare(response.share);
                } catch {
                  setNotice("密码错误或验证失败");
                } finally {
                  setSubmitting(false);
                }
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
            >
              {submitting ? "验证中..." : "继续访问"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const titleMap: Record<string, string> = {
    not_found: "分享链接不存在",
    disabled: "分享已关闭",
    expired: "分享链接已过期",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfbf8] px-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <h1 className="text-xl font-semibold text-slate-900">{titleMap[status] ?? "分享当前不可用"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          当前分享链接无法打开，请确认链接是否正确，或联系文档作者重新提供有效链接。
        </p>
        <div className="mt-5">
          <Link href="/" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
