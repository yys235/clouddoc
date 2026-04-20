import { AppShell } from "@/components/layout/app-shell";
import { SearchForm } from "@/components/search/search-form";
import { SearchResults } from "@/components/search/search-results";
import { searchDocuments } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const { data: results, unavailable } = query
    ? await searchDocuments(query)
    : { data: [], unavailable: false };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-4 pt-3">
        <section className="border border-slate-200 bg-white px-5 py-4 shadow-panel">
          <div className="max-w-2xl">
            <div className="text-sm font-medium text-accent">Search Workspace</div>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">搜索 CloudDoc 文档</h1>
            <SearchForm initialQuery={query} />
          </div>
        </section>
      </div>
      <SearchResults query={query} results={results} apiUnavailable={unavailable} />
    </AppShell>
  );
}
