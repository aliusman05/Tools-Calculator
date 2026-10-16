import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResults } from "@/components/layout/SearchResults";
import { getSummaries } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Search calculators",
  description: "Search our free personal finance calculators by name or topic.",
  path: "/search",
  noindex: true,
});

export default function SearchPage() {
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">Search calculators</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SearchResults items={getSummaries()} />
      </Suspense>
    </>
  );
}
