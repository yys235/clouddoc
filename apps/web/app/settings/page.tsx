import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PersonalSettingsForm } from "@/components/settings/personal-settings-form";
import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { fetchCurrentUser, fetchUserPreference } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [{ data: currentUser, unavailable: userUnavailable }, { data: preference, unavailable: preferenceUnavailable }] =
    await Promise.all([fetchCurrentUser(), fetchUserPreference()]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-3">
        {userUnavailable || preferenceUnavailable ? <ApiUnavailableNotice /> : null}
        {!currentUser ? (
          <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
            <div className="text-sm font-medium text-accent">Personal Settings</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">需要登录</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">个人配置保存在后端账号下，请先登录后再修改。</p>
            <Link
              href="/login"
              className="mt-4 inline-flex bg-accent px-4 py-1.5 text-sm font-medium text-white"
            >
              去登录
            </Link>
          </section>
        ) : (
          <PersonalSettingsForm preference={preference} />
        )}
      </div>
    </AppShell>
  );
}
