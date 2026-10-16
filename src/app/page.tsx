import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, pageMetadata, websiteSchema } from "@/lib/seo";
import { SearchBox } from "@/components/layout/SearchBox";
import { Card } from "@/components/ui/Card";
import {
  categories,
  getCalculatorsByCategory,
  getPopularCalculators,
  getSummaries,
} from "@/lib/registry";
import { siteConfig } from "@/lib/site-config";

const trustPoints = [
  {
    title: "Private by design",
    body: "Every calculation runs in your browser. The numbers you enter never leave your device.",
  },
  {
    title: "Formulas you can check",
    body: "Each calculator explains its formula and assumptions, and is tested against known reference values.",
  },
  {
    title: "Clearly dated",
    body: "Pages show when they were last reviewed, and rates and tax data are kept in one dated place.",
  },
];

const homeTitle = `${siteConfig.name} – Free Personal Finance Calculators`;

export const metadata: Metadata = {
  ...pageMetadata({ title: homeTitle, description: siteConfig.description, path: "/" }),
  title: { absolute: homeTitle },
};

export default function Home() {
  const popular = getPopularCalculators(8);

  return (
    <div className="flex flex-col gap-14">
      <JsonLd data={websiteSchema()} />
      <JsonLd data={organizationSchema()} />
      <section className="flex flex-col items-center gap-5 py-6 text-center sm:py-10">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          Free finance calculators you can trust
        </h1>
        <p className="text-muted max-w-xl text-lg text-balance">{siteConfig.description}</p>
        <SearchBox
          items={getSummaries()}
          landmarkLabel="Find a calculator"
          size="lg"
          className="mt-2 w-full max-w-xl"
        />
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="mb-4 text-2xl font-bold">
          Browse by category
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const count = getCalculatorsByCategory(c.id).length;
            return (
              <li key={c.id}>
                <Link
                  href={`/category/${c.id}`}
                  className="rounded-card border-border bg-surface hover:border-accent block h-full border p-5 transition-colors"
                >
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                  <p className="text-muted mt-1">{c.description}</p>
                  <p className="text-accent mt-3 text-sm font-medium">
                    {count} {count === 1 ? "calculator" : "calculators"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="popular-heading">
        <h2 id="popular-heading" className="mb-4 text-2xl font-bold">
          Popular calculators
        </h2>
        {popular.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}`}
                  className="rounded-card border-border bg-surface hover:border-accent block h-full border p-4 transition-colors"
                >
                  <h3 className="font-semibold">{c.shortTitle}</h3>
                  <p className="text-muted mt-1 text-sm">{c.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="text-muted">Our first calculators are on the way. Check back soon.</Card>
        )}
      </section>

      <section aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="mb-4 text-2xl font-bold">
          Why use {siteConfig.name}
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {trustPoints.map((t) => (
            <li key={t.title}>
              <Card className="h-full">
                <h3 className="font-semibold">{t.title}</h3>
                <p className="text-muted mt-2">{t.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
