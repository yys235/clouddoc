"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { instantiateTemplate, TemplateItem } from "@/lib/api";

export function TemplateGallery({ templates }: { templates: TemplateItem[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUseTemplate = (templateId: string) => {
    startTransition(async () => {
      try {
        setError("");
        setPendingTemplateId(templateId);
        const response = await instantiateTemplate(templateId, {});
        router.push(`/docs/${response.document.id}`);
        router.refresh();
      } catch {
        setError("模板创建失败");
      } finally {
        setPendingTemplateId(null);
      }
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5">
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="text-sm font-medium text-accent">Templates</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">模板中心</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          当前页面只显示后端返回的真实模板数据。后端不可用时，这里会显示空状态，而不是演示模板。
        </p>
      </section>

      {templates.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="rounded-3xl bg-white p-5 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">{template.category}</div>
                  <h2 className="mt-1.5 text-xl font-semibold">{template.name}</h2>
                </div>
                <span className="rounded-lg bg-mist px-3 py-1 text-xs font-medium text-slate-600">
                  {template.status === "published" ? "已发布" : "草稿"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                基于当前模板创建真实文档，并进入对应文档页面。
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-slate-400">{template.createdAt}</div>
                <button
                  type="button"
                  disabled={isPending && pendingTemplateId === template.id}
                  onClick={() => handleUseTemplate(template.id)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending && pendingTemplateId === template.id ? "创建中..." : "使用模板"}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl bg-white p-5 shadow-panel">
          <p className="text-sm leading-6 text-slate-600">
            当前没有可用模板，或者后端模板接口暂时不可用。
          </p>
        </section>
      )}
    </div>
  );
}
