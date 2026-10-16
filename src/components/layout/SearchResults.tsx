"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CalculatorSummary } from "@/lib/registry";
import { searchCalculators } from "@/lib/search";

export function SearchResults({ items }: { items: CalculatorSummary[] }) {
  const query = useSearchParams().get("q") ?? "";
  const results = searchCalculators(items, query);

  if (!query.trim()) {
    return <p className="text-muted">Type in the search box to find a calculator.</p>;
  }

  return (
    <div aria-live="polite">
      <p className="text-muted mb-4">
        {results.length} {results.length === 1 ? "result" : "results"} for “{query.trim()}”
      </p>
      {results.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {results.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/${r.slug}`}
                className="rounded-card border-border bg-surface hover:border-accent block h-full border p-4"
              >
                <span className="font-semibold">{r.shortTitle}</span>
                <span className="text-muted mt-1 block text-sm">{r.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          Nothing matched. Try a broader word such as “loan”, “savings” or “tax”, or{" "}
          <Link href="/" className="text-accent underline underline-offset-2">
            browse all calculators
          </Link>
          .
        </p>
      )}
    </div>
  );
}
