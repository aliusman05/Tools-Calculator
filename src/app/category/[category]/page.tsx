import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { categories, getCalculatorsByCategory, getCategory } from "@/lib/registry";

// Only prerendered paths exist; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/category/[category]">): Promise<Metadata> {
  const category = getCategory((await params).category);
  if (!category) return {};
  return { title: category.name, description: category.description };
}

// Minimal hub for now; Phase 4 adds unique intro copy and schema.
export default async function CategoryPage({ params }: PageProps<"/category/[category]">) {
  const category = getCategory((await params).category);
  if (!category) notFound();
  const items = getCalculatorsByCategory(category.id);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: category.name }]} />
      <h1 className="text-3xl font-bold">{category.name}</h1>
      <p className="text-muted mt-2 max-w-2xl">{category.description}</p>
      {items.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}`}
                className="rounded-card border-border bg-surface hover:border-accent block h-full border p-4"
              >
                <h2 className="font-semibold">{c.shortTitle}</h2>
                <p className="text-muted mt-1 text-sm">{c.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted mt-6">Calculators for this category are coming soon.</p>
      )}
    </>
  );
}
