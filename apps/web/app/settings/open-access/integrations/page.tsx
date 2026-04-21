import Link from "next/link";

import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { AppShell } from "@/components/layout/app-shell";
import { OpenAccessIntegrationListPanel } from "@/components/settings/open-access-integration-list-panel";
import { fetchCurrentUser, fetchIntegrations } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function OpenAccessIntegrationsPage() {
  const [{ data: currentUser, unavailable: userUnavailable }, { data: integrations, unavailable: integrationsUnavailable }] =
    await Promise.all([fetchCurrentUser(), fetchIntegrations()]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-3">
        {userUnavailable || integrationsUnavailable ? <ApiUnavailableNotice /> : null}
        {!currentUser ? (
          <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
            <div className="text-sm font-medium text-accent">Open Access Integrations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">需要登录</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">请先登录后再查看 Integration 列表。</p>
            <Link href="/login" className="mt-4 inline-flex bg-accent px-4 py-1.5 text-sm font-medium text-white">
              去登录
            </Link>
          </section>
        ) : (
          <OpenAccessIntegrationListPanel integrations={integrations} />
        )}
      </div>
    </AppShell>
  );
}
