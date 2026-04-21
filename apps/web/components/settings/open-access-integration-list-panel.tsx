"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { IntegrationSummary } from "@/lib/api";

const PAGE_SIZE = 20;

export function OpenAccessIntegrationListPanel({ integrations }: { integrations: IntegrationSummary[] }) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredIntegrations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return integrations;
    }
    return integrations.filter((integration) =>
      [integration.name, integration.clientId, integration.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [integrations, query]);

  const visibleIntegrations = filteredIntegrations.slice(0, visibleCount);

  return (
    <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Open Access Integrations</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Integration 列表</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">查看全部 Integration，支持按名称和 client_id 搜索。</p>
        </div>
        <Link href="/settings" className="border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
          返回设置
        </Link>
      </div>

      <div className="mt-4 grid gap-3 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="text-xs font-medium text-slate-600">
          搜索 Integration
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="mt-1 w-full border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="输入名称 / client_id / 状态"
          />
        </label>
        <div className="text-xs text-slate-500">
          <div>匹配结果 {filteredIntegrations.length} 个</div>
          <div className="mt-1">当前显示 {Math.min(visibleIntegrations.length, filteredIntegrations.length)} 个</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {visibleIntegrations.map((integration) => (
          <article key={integration.id} className="border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-sm font-medium text-slate-900">{integration.name}</div>
            <div className="mt-1 break-all text-xs text-slate-500">
              {integration.status} · client_id: {integration.clientId}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/settings/integrations/${integration.id}/scopes`}
                className="border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
              >
                查看授权历史
              </Link>
            </div>
          </article>
        ))}
        {filteredIntegrations.length === 0 ? (
          <div className="border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">没有匹配的 Integration。</div>
        ) : null}
      </div>

      {visibleCount < filteredIntegrations.length ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            className="border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700"
          >
            加载更多
          </button>
        </div>
      ) : null}
    </section>
  );
}
