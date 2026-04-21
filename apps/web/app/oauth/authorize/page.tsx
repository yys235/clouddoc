import Link from "next/link";

import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { OAuthAuthorizePanel } from "@/components/oauth/oauth-authorize-panel";
import { fetchCurrentUser, fetchOAuthClient } from "@/lib/api";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseScopes(rawScope: string | string[] | undefined) {
  const scopeValue = firstParam(rawScope)?.trim() ?? "";
  if (!scopeValue) {
    return [];
  }
  return scopeValue
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const clientId = firstParam(params.client_id);
  const redirectUri = firstParam(params.redirect_uri);
  const state = firstParam(params.state);
  const scopes = parseScopes(params.scope);

  const [{ data: currentUser, unavailable: userUnavailable }, { data: integration, unavailable: clientUnavailable }] =
    clientId
      ? await Promise.all([fetchCurrentUser({ bootstrap: false }), fetchOAuthClient(clientId)])
      : [{ data: null, unavailable: false }, { data: null, unavailable: false }];

  const invalidRequest = !clientId || !redirectUri;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4 py-8">
      <div className="w-full max-w-2xl space-y-3">
        {userUnavailable || clientUnavailable ? <ApiUnavailableNotice /> : null}
        {invalidRequest ? (
          <section className="border border-slate-200 bg-white px-6 py-5 shadow-panel">
            <div className="text-sm font-medium text-accent">CloudDoc OAuth</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">授权请求无效</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              当前请求缺少 <code>client_id</code> 或 <code>redirect_uri</code>。
            </p>
          </section>
        ) : !currentUser ? (
          <section className="border border-slate-200 bg-white px-6 py-5 shadow-panel">
            <div className="text-sm font-medium text-accent">CloudDoc OAuth</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">需要登录</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              授权第三方应用前，需要先登录 CloudDoc 账号。登录后请重新打开当前授权链接。
            </p>
            <Link href="/login" className="mt-4 inline-flex bg-accent px-4 py-2 text-sm font-medium text-white">
              去登录
            </Link>
          </section>
        ) : !integration ? (
          <section className="border border-slate-200 bg-white px-6 py-5 shadow-panel">
            <div className="text-sm font-medium text-accent">CloudDoc OAuth</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">应用不存在或未启用 OAuth</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              指定的 client_id 无法使用，请联系应用管理员检查 OAuth 配置。
            </p>
          </section>
        ) : (
          <OAuthAuthorizePanel
            integration={integration}
            clientId={clientId}
            redirectUri={redirectUri}
            scopes={scopes}
            state={state}
          />
        )}
      </div>
    </div>
  );
}
