"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type FormEvent } from "react";
import type { CalculatorSummary } from "@/lib/registry";
import { cn } from "@/lib/cn";
import { searchCalculators } from "@/lib/search";

export function SearchBox({
  items,
  className,
  size = "md",
}: {
  items: CalculatorSummary[];
  className?: string;
  size?: "md" | "lg";
}) {
  const id = useId();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCalculators(items, query).slice(0, 6), [items, query]);
  const hasQuery = query.trim().length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    // A single match goes straight to the calculator; otherwise show the full results page.
    const all = searchCalculators(items, term);
    router.push(all.length === 1 ? `/${all[0]!.slug}` : `/search?q=${encodeURIComponent(term)}`);
    setQuery("");
  }

  return (
    <form role="search" onSubmit={onSubmit} className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Search calculators
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search calculators…"
        autoComplete="off"
        aria-describedby={`${id}-status`}
        className={cn(
          "rounded-control border-border bg-surface text-foreground placeholder:text-muted w-full border px-3",
          size === "lg" ? "min-h-14 text-lg" : "min-h-11 text-base",
        )}
      />
      <p id={`${id}-status`} role="status" className="sr-only">
        {hasQuery ? `${results.length} calculator${results.length === 1 ? "" : "s"} found` : ""}
      </p>
      {hasQuery && (
        <ul className="rounded-control border-border bg-surface absolute inset-x-0 top-full z-30 mt-1 overflow-hidden border shadow-lg">
          {results.length === 0 ? (
            <li className="text-muted px-3 py-3 text-sm">No calculators match “{query.trim()}”.</li>
          ) : (
            results.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/${r.slug}`}
                  onClick={() => setQuery("")}
                  className="hover:bg-surface-muted block min-h-11 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{r.shortTitle}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}
