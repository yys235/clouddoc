"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SearchForm({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    startTransition(() => {
      router.push(normalized ? `/search?q=${encodeURIComponent(normalized)}` : "/search");
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex w-full max-w-xl items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2"
    >
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
        placeholder="搜索标题或正文内容"
      />
      <button
        type="submit"
        disabled={isPending}
        className="bg-accent px-3.5 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "搜索中..." : "搜索"}
      </button>
    </form>
  );
}
