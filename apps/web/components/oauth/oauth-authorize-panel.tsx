"use client";

import { useMemo, useState, useTransition } from "react";

import { authorizeOAuth, type IntegrationSummary } from "@/lib/api";

function appendRedirectParams(
  redirectUri: string,
  params: Record<string, string | undefined>,
) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function OAuthAuthorizePanel({
  integration,
  clientId,
  redirectUri,
  scopes,
  state,
}: {
  integration: IntegrationSummary;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const normalizedScopes = useMemo(() => scopes.filter(Boolean), [scopes]);

  const handleAuthorize = () => {
    startTransition(async () => {
      try {
        setError("");
        const result = await authorizeOAuth({
          clientId,
          redirectUri,
          scopes: normalizedScopes,
          state,
        });
        window.location.assign(
          appendRedirectParams(redirectUri, {
            code: result.code,
            state: result.state,
          }),
        );
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "授权失败");
      }
    });
  };

  const handleDeny = () => {
    window.location.assign(
      appendRedirectParams(redirectUri, {
        error: "access_denied",
        state,
      }),
    );
  };

  return (
    <div className="w-full max-w-2xl border border-slate-200 bg-white px-6 py-5 shadow-panel">
      <div className="text-sm font-medium text-accent">CloudDoc OAuth</div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">授权访问 CloudDoc</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        <span className="font-medium text-slate-900">{integration.name}</span>
        正在请求访问你的 CloudDoc 账号内容。确认后会跳转回应用回调地址。
      </p>

      <div className="mt-5 grid gap-3 border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Application</div>
          <div className="mt-1 break-all font-medium text-slate-900">{integration.name}</div>
          <div className="mt-1 text-xs text-slate-500">{clientId}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Redirect URI</div>
          <div className="mt-1 break-all font-medium text-slate-900">{redirectUri}</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-sm font-semibold text-slate-900">请求范围</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {normalizedScopes.length > 0 ? (
            normalizedScopes.map((scope) => (
              <span key={scope} className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                {scope}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">未请求额外 scope，将使用默认只读范围。</span>
          )}
        </div>
      </div>

      <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
        CloudDoc 当前 OAuth 只负责用户身份授权。真正能访问哪些文档，仍然受 Integration 在“开放接入”中配置的资源范围限制。
      </div>

      {error ? <div className="mt-4 text-sm text-rose-600">{error}</div> : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleAuthorize}
          disabled={isPending}
          className="bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "授权中..." : "允许并继续"}
        </button>
        <button
          type="button"
          onClick={handleDeny}
          disabled={isPending}
          className="border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          拒绝
        </button>
      </div>
    </div>
  );
}
