import Link from "next/link";
import { getCalculator } from "@/lib/registry";

export function RelatedTools({ slugs }: { slugs: readonly string[] }) {
  const items = slugs.map((s) => getCalculator(s)).filter((c) => c !== undefined);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mt-12">
      <h2 id="related-heading" className="mb-4 text-2xl font-bold">
        Related calculators
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/${c.slug}`}
              className="rounded-card border-border bg-surface hover:border-accent block h-full border p-4"
            >
              <span className="font-semibold">{c.shortTitle}</span>
              <span className="text-muted mt-1 block text-sm">{c.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
