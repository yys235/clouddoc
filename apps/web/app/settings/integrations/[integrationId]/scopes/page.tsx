import Link from "next/link";

import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { AppShell } from "@/components/layout/app-shell";
import { IntegrationScopeHistoryPanel } from "@/components/settings/integration-scope-history-panel";
import { fetchCurrentUser, fetchIntegrations, fetchIntegrationScopes } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function IntegrationScopeHistoryPage({
  params,
}: {
  params: Promise<{ integrationId: string }>;
}) {
  const { integrationId } = await params;
  const [{ data: currentUser, unavailable: userUnavailable }, { data: integrations, unavailable: integrationsUnavailable }] =
    await Promise.all([fetchCurrentUser(), fetchIntegrations()]);

  const integration = integrations.find((item) => item.id === integrationId) ?? null;
  const { data: scopes, unavailable: scopesUnavailable } = integration
    ? await fetchIntegrationScopes(integrationId)
    : { data: [], unavailable: false };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-3">
        {userUnavailable || integrationsUnavailable || scopesUnavailable ? <ApiUnavailableNotice /> : null}
        {!currentUser ? (
          <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
            <div className="text-sm font-medium text-accent">Integration Scope History</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">需要登录</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">请先登录后再查看 AI Integration 的授权历史。</p>
            <Link href="/login" className="mt-4 inline-flex bg-accent px-4 py-1.5 text-sm font-medium text-white">
              去登录
            </Link>
          </section>
        ) : !integration ? (
          <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
            <div className="text-sm font-medium text-accent">Integration Scope History</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Integration 不存在</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">当前用户下没有找到这个 Integration，或者它已经被删除。</p>
            <Link href="/settings" className="mt-4 inline-flex border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700">
              返回设置
            </Link>
          </section>
        ) : (
          <IntegrationScopeHistoryPanel
            integrationId={integration.id}
            integrationName={integration.name}
            scopes={scopes}
          />
        )}
      </div>
    </AppShell>
  );
}
