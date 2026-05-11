import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PersonalSettingsForm } from "@/components/settings/personal-settings-form";
import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { fetchCurrentUser, fetchSystemSettingsSummary, fetchUserPreference } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [
    { data: currentUser, unavailable: userUnavailable },
    { data: preference, unavailable: preferenceUnavailable },
    { data: systemSummary, unavailable: systemSummaryUnavailable },
  ] = await Promise.all([fetchCurrentUser(), fetchUserPreference(), fetchSystemSettingsSummary()]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-3">
        {userUnavailable || preferenceUnavailable || systemSummaryUnavailable ? <ApiUnavailableNotice /> : null}
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
          <>
            {currentUser.isSuperAdmin && systemSummary ? (
              <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
                <div className="text-sm font-medium text-accent">System Bootstrap</div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">系统初始化摘要</h2>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
                  <div className="border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">状态</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {systemSummary.initialized ? "已初始化" : "未初始化"}
                    </div>
                  </div>
                  <div className="border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">初始化管理员</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {systemSummary.initializedByEmail ?? "未记录"}
                    </div>
                  </div>
                  <div className="border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">运行环境</div>
                    <div className="mt-1 font-medium text-slate-900">{systemSummary.appEnv}</div>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-4">
                  <div>公开文档：{systemSummary.allowPublicDocuments ? "允许" : "禁用"}</div>
                  <div>分享链接：{systemSummary.allowShareLinks ? "允许" : "禁用"}</div>
                  <div>AI Token：{systemSummary.allowUserPat ? "允许" : "禁用"}</div>
                  <div>开放 API：{systemSummary.allowOpenApi ? "允许" : "禁用"}</div>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <div className="text-sm font-semibold text-slate-900">最近系统审计</div>
                  <div className="mt-2 space-y-1.5">
                    {systemSummary.recentAuditLogs.length > 0 ? (
                      systemSummary.recentAuditLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-3 border border-slate-100 px-2 py-1.5 text-xs text-slate-600">
                          <span className="font-medium text-slate-800">{log.action}</span>
                          <span>{new Date(log.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500">暂无系统审计记录。</div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}
            <PersonalSettingsForm preference={preference} />
          </>
        )}
      </div>
    </AppShell>
  );
}
