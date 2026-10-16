import type { CalculatorSummary } from "@/lib/registry";

/** True when every word in the query appears in the calculator's title, description or keywords. */
export function matchesQuery(item: CalculatorSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const haystack = [item.shortTitle, item.description, ...item.keywords].join(" ").toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export function searchCalculators<T extends CalculatorSummary>(
  items: readonly T[],
  query: string,
): T[] {
  return items.filter((item) => matchesQuery(item, query));
}
