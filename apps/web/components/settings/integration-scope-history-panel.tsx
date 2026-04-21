"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { IntegrationScopeSummary } from "@/lib/api";

const PAGE_SIZE = 20;

export function IntegrationScopeHistoryPanel({
  integrationId,
  integrationName,
  scopes,
}: {
  integrationId: string;
  integrationName: string;
  scopes: IntegrationScopeSummary[];
}) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredScopes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return scopes;
    }
    return scopes.filter((scope) => {
      const haystacks = [
        scope.resourceTitle,
        scope.resourceId,
        scope.resourceType,
        scope.permissionLevel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystacks.includes(normalizedQuery);
    });
  }, [query, scopes]);

  const visibleScopes = filteredScopes.slice(0, visibleCount);
  const hasMore = visibleCount < filteredScopes.length;

  return (
    <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Integration Scope History</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{integrationName}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            查看当前 Integration 的全部授权范围历史。支持按资源名称、资源 ID、资源类型和权限搜索。
          </p>
        </div>
        <Link href="/settings" className="border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
          返回设置
        </Link>
      </div>

      <div className="mt-4 grid gap-3 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="text-xs font-medium text-slate-600">
          搜索授权历史
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="mt-1 w-full border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="输入资源名称 / 资源 ID / 类型 / 权限"
          />
        </label>
        <div className="text-xs text-slate-500">
          <div>Integration ID</div>
          <div className="mt-1 break-all text-slate-700">{integrationId}</div>
          <div className="mt-3">匹配结果 {filteredScopes.length} 条</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {filteredScopes.length === 0 ? (
          <div className="border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            没有匹配的授权范围记录。
          </div>
        ) : (
          visibleScopes.map((scope) => (
            <article key={scope.id} className="border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="border border-slate-300 bg-white px-1.5 py-0.5 text-slate-700">{scope.resourceType}</span>
                <span className="border border-slate-300 bg-white px-1.5 py-0.5 text-slate-700">
                  {scope.permissionLevel === "edit" ? "可编辑" : "只读"}
                </span>
                {scope.includeChildren ? (
                  <span className="border border-slate-300 bg-white px-1.5 py-0.5 text-slate-700">含子级</span>
                ) : null}
              </div>
              <div className="mt-2 break-all text-sm font-medium leading-6 text-slate-900">
                {scope.resourceTitle || scope.resourceId || "all-public"}
              </div>
              {scope.resourceTitle && scope.resourceId ? (
                <div className="mt-1 break-all text-xs text-slate-500">{scope.resourceId}</div>
              ) : null}
              <div className="mt-2 text-xs text-slate-400">
                创建时间 {new Date(scope.createdAt).toLocaleString("zh-CN", { hour12: false })}
              </div>
            </article>
          ))
        )}
      </div>

      {hasMore ? (
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
