import Link from "next/link";

import { ApiUnavailableNotice } from "@/components/common/api-unavailable-notice";
import { SearchDocument } from "@/lib/api";

export function SearchResults({
  query,
  results,
  apiUnavailable = false,
}: {
  query: string;
  results: SearchDocument[];
  apiUnavailable?: boolean;
}) {
  return (
    <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-3">
      {apiUnavailable ? (
        <ApiUnavailableNotice message="搜索接口当前不可用，以下页面结果不是最新状态。请检查后端服务后重试。" />
      ) : null}
      <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <div className="text-sm font-medium text-accent">Search</div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">
          {query ? `“${query}” 的搜索结果` : "搜索文档"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {query
            ? `当前共返回 ${results.length} 条结果，已覆盖标题与正文内容。`
            : "输入关键字后可搜索标题和文档正文内容。"}
        </p>
      </section>

      <section className="border border-slate-200 bg-white px-4 py-3 shadow-panel">
        {query ? (
          results.length > 0 ? (
            <div className="space-y-1.5">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/docs/${result.id}`}
                  className="block border border-slate-200 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">{result.title}</div>
                    <div className="flex items-center gap-2">
                      {result.isFavorited ? (
                        <span className="bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          已收藏
                        </span>
                      ) : null}
                      <span className="bg-mist px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {result.status === "published" ? "已发布" : "草稿"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{result.excerpt}</p>
                  <div className="mt-2 text-xs text-slate-400">{result.updatedAt}</div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">没有找到匹配结果。</p>
          )
        ) : (
          <p className="text-sm leading-6 text-slate-600">请输入搜索关键字。</p>
        )}
      </section>
    </div>
  );
}
