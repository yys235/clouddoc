import Link from "next/link";

import { SearchDocument } from "@/lib/api";

export function SearchResults({
  query,
  results,
}: {
  query: string;
  results: SearchDocument[];
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="text-sm font-medium text-accent">Search</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {query ? `“${query}” 的搜索结果` : "搜索文档"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {query
            ? `当前共返回 ${results.length} 条结果，已覆盖标题与正文内容。`
            : "输入关键字后可搜索标题和文档正文内容。"}
        </p>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-panel">
        {query ? (
          results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/docs/${result.id}`}
                  className="block rounded-2xl border border-slate-100 px-4 py-4 transition hover:border-slate-200 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">{result.title}</div>
                    <div className="flex items-center gap-2">
                      {result.isFavorited ? (
                        <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          已收藏
                        </span>
                      ) : null}
                      <span className="rounded-lg bg-mist px-3 py-1 text-xs font-medium text-slate-600">
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
