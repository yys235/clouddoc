"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";

import {
  BootstrapStatus,
  initializeSystem,
  type BootstrapInitializeInput,
} from "@/lib/api";

const steps = ["系统检查", "管理员", "组织空间", "安全策略", "可选能力", "确认执行"];

type SetupWizardProps = {
  initialStatus: BootstrapStatus | null;
  apiUnavailable: boolean;
};

export function SetupWizard({ initialStatus, apiUnavailable }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BootstrapInitializeInput>({
    setupToken: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    organizationName: "CloudDoc",
    spaceName: "产品空间",
    spaceVisibility: "organization",
    allowPublicDocuments: true,
    allowShareLinks: true,
    sharePasswordRequiredByDefault: false,
    allowGuestPublicRead: true,
    allowUserPat: true,
    allowOpenApi: true,
    importDemoData: false,
  });

  const canContinue =
    step === 0
      ? Boolean(initialStatus && initialStatus.databaseOk && initialStatus.schemaOk && initialStatus.setupAllowed)
      : step === 1
        ? Boolean(form.adminName.trim() && form.adminEmail.includes("@") && form.adminPassword.length >= 8)
        : step === 2
          ? Boolean(form.organizationName.trim() && form.spaceName.trim())
          : true;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    setSubmitting(true);
    try {
      const result = await initializeSystem(form);
      router.replace(result.nextUrl || "/documents");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "初始化失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (apiUnavailable) {
    return (
      <SetupFrame>
        <div className="border border-red-200 bg-red-50 p-5 text-red-900">
          <h1 className="text-xl font-semibold">后端接口不可用</h1>
          <p className="mt-3 text-sm leading-6">
            初始化向导需要访问后端 API。请先确认 API 服务、数据库连接和 Nginx `/api/` 代理是否正常。
          </p>
        </div>
      </SetupFrame>
    );
  }

  if (initialStatus?.initialized) {
    return (
      <SetupFrame>
        <div className="border border-slate-200 bg-white p-5">
          <h1 className="text-xl font-semibold text-slate-950">系统已初始化</h1>
          <p className="mt-3 text-sm text-slate-600">初始化向导已锁定。后续配置请在管理员后台调整。</p>
          <button
            type="button"
            onClick={() => router.replace("/documents")}
            className="mt-5 border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            进入文档系统
          </button>
        </div>
      </SetupFrame>
    );
  }

  return (
    <SetupFrame>
      <form onSubmit={submit} className="grid min-h-[620px] grid-cols-[220px_minmax(0,1fr)_280px] border border-slate-200 bg-white">
        <aside className="border-r border-slate-200 bg-slate-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">CloudDoc</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">首次部署初始化</h1>
          <div className="mt-8 space-y-1">
            {steps.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => index <= step && setStep(index)}
                className={`flex w-full items-center gap-3 border px-3 py-2 text-left text-sm ${
                  index === step
                    ? "border-slate-900 bg-white text-slate-950"
                    : index < step
                      ? "border-transparent text-slate-700"
                      : "border-transparent text-slate-400"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center border border-current text-xs">{index + 1}</span>
                {item}
              </button>
            ))}
          </div>
        </aside>

        <main className="p-7">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Step {step + 1}</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{steps[step]}</h2>
          </div>
          {step === 0 && <SystemCheck status={initialStatus} />}
          {step === 1 && (
            <section className="grid max-w-xl gap-4">
              <TextInput label="管理员姓名" value={form.adminName} onChange={(adminName) => setForm({ ...form, adminName })} />
              <TextInput label="管理员邮箱" value={form.adminEmail} onChange={(adminEmail) => setForm({ ...form, adminEmail })} />
              <TextInput
                label="管理员密码"
                type="password"
                value={form.adminPassword}
                onChange={(adminPassword) => setForm({ ...form, adminPassword })}
                hint="至少 8 位。初始化后该账号会成为系统超级管理员。"
              />
              <TextInput
                label="Setup Token（如已配置）"
                value={form.setupToken ?? ""}
                onChange={(setupToken) => setForm({ ...form, setupToken })}
                hint="生产环境建议配置 CLOUDDOC_SETUP_TOKEN，避免公网抢先初始化。"
              />
            </section>
          )}
          {step === 2 && (
            <section className="grid max-w-xl gap-4">
              <TextInput label="组织名称" value={form.organizationName} onChange={(organizationName) => setForm({ ...form, organizationName })} />
              <TextInput label="默认空间名称" value={form.spaceName} onChange={(spaceName) => setForm({ ...form, spaceName })} />
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                默认空间可见性
                <select
                  value={form.spaceVisibility}
                  onChange={(event) => setForm({ ...form, spaceVisibility: event.target.value as "private" | "organization" })}
                  className="border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-900"
                >
                  <option value="organization">组织内可见</option>
                  <option value="private">私有</option>
                </select>
              </label>
            </section>
          )}
          {step === 3 && (
            <section className="grid max-w-2xl gap-3">
              <Toggle label="允许公开文档" checked={form.allowPublicDocuments} onChange={(allowPublicDocuments) => setForm({ ...form, allowPublicDocuments })} />
              <Toggle label="允许创建分享链接" checked={form.allowShareLinks} onChange={(allowShareLinks) => setForm({ ...form, allowShareLinks })} />
              <Toggle
                label="分享链接默认要求密码"
                checked={form.sharePasswordRequiredByDefault}
                onChange={(sharePasswordRequiredByDefault) => setForm({ ...form, sharePasswordRequiredByDefault })}
              />
              <Toggle label="允许游客读取公开文档" checked={form.allowGuestPublicRead} onChange={(allowGuestPublicRead) => setForm({ ...form, allowGuestPublicRead })} />
            </section>
          )}
          {step === 4 && (
            <section className="grid max-w-2xl gap-3">
              <Toggle label="允许用户创建 Personal Access Token" checked={form.allowUserPat} onChange={(allowUserPat) => setForm({ ...form, allowUserPat })} />
              <Toggle label="启用开放 API 管理入口" checked={form.allowOpenApi} onChange={(allowOpenApi) => setForm({ ...form, allowOpenApi })} />
              <Toggle label="导入示例数据" checked={form.importDemoData} onChange={(importDemoData) => setForm({ ...form, importDemoData })} />
            </section>
          )}
          {step === 5 && (
            <section className="max-w-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">即将执行初始化：</p>
              <ul className="mt-3 space-y-2">
                <li>管理员：{form.adminName || "-"} / {form.adminEmail || "-"}</li>
                <li>组织：{form.organizationName}</li>
                <li>空间：{form.spaceName}（{form.spaceVisibility === "organization" ? "组织内可见" : "私有"}）</li>
                <li>开放 API：{form.allowOpenApi ? "启用" : "禁用"}</li>
                <li>Personal Access Token：{form.allowUserPat ? "允许" : "禁用"}</li>
              </ul>
              <p className="mt-4 text-slate-500">提交后会创建超级管理员并锁定初始化向导。</p>
            </section>
          )}

          {error && <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}

          <div className="mt-8 flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((value) => value - 1)}
                className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                上一步
              </button>
            )}
            <button
              type="submit"
              disabled={!canContinue || submitting}
              className="border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {submitting ? "正在初始化..." : step === steps.length - 1 ? "确认初始化" : "下一步"}
            </button>
          </div>
        </main>

        <aside className="border-l border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-950">部署提示</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>初始化只会在空库或未初始化状态出现。</p>
            <p>生产环境建议设置 `CLOUDDOC_SETUP_TOKEN`。</p>
            <p>MCP 服务不是首启必需项，可以初始化完成后再启动。</p>
          </div>
        </aside>
      </form>
    </SetupFrame>
  );
}

function SetupFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#eef2f6] p-8 text-slate-950">{children}</div>;
}

function SystemCheck({ status }: { status: BootstrapStatus | null }) {
  if (!status) {
    return <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">无法读取初始化状态。</div>;
  }
  return (
    <section className="grid max-w-2xl gap-3">
      {status.checks.map((check) => (
        <div key={check.key} className="flex items-start justify-between border border-slate-200 bg-white p-4">
          <div>
            <div className="text-sm font-semibold text-slate-950">{check.key}</div>
            <div className="mt-1 text-sm text-slate-600">{check.message}</div>
          </div>
          <span className={`border px-2 py-1 text-xs font-semibold ${check.status === "ok" ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}`}>
            {check.status}
          </span>
        </div>
      ))}
      {!status.setupAllowed && (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-900">当前环境不允许 Web 初始化，或系统已经初始化。</div>
      )}
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-900"
      />
      {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
    </label>
  );
}
