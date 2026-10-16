import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { categoryContent } from "@/lib/category-content";
import { categories, getCalculatorsByCategory, getCategory } from "@/lib/registry";
import { breadcrumbSchema, collectionPageSchema, pageMetadata } from "@/lib/seo";

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
  return pageMetadata({
    title: `${category.name} Calculators`,
    description: categoryContent[category.id].metaDescription,
    path: `/category/${category.id}`,
  });
}

export default async function CategoryPage({ params }: PageProps<"/category/[category]">) {
  const category = getCategory((await params).category);
  if (!category) notFound();
  const content = categoryContent[category.id];
  const items = getCalculatorsByCategory(category.id);
  const otherCategories = categories.filter((c) => c.id !== category.id);

  return (
    <>
      <JsonLd data={collectionPageSchema(category, content.metaDescription, items)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: category.name, path: `/category/${category.id}` },
        ])}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: category.name }]} />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{category.name} Calculators</h1>
      <div className="mt-4 max-w-3xl space-y-4 leading-7">
        {content.intro.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>

      <section aria-labelledby="tools-heading" className="mt-10">
        <h2 id="tools-heading" className="mb-4 text-2xl font-bold">
          {items.length === 1 ? "The calculator" : `All ${items.length} calculators`}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}`}
                className="rounded-card border-border bg-surface hover:border-accent block h-full border p-4"
              >
                <h3 className="font-semibold">{c.shortTitle}</h3>
                <p className="text-muted mt-1 text-sm">{c.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="guidance-heading" className="mt-10 max-w-3xl">
        <h2 id="guidance-heading" className="mb-3 text-2xl font-bold">
          {content.guidance.heading}
        </h2>
        <ul className="list-disc space-y-2 pl-6 leading-7">
          {content.guidance.points.map((point) => (
            <li key={point.slice(0, 40)}>{point}</li>
          ))}
        </ul>
      </section>

      <nav aria-labelledby="more-categories-heading" className="mt-10">
        <h2 id="more-categories-heading" className="mb-3 text-xl font-bold">
          More calculator categories
        </h2>
        <ul className="flex flex-wrap gap-2">
          {otherCategories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/category/${c.id}`}
                className="rounded-control border-border bg-surface hover:border-accent inline-flex min-h-11 items-center border px-3 text-sm font-medium"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
