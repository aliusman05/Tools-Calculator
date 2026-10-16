import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FAQ } from "@/components/seo/FAQ";
import { JsonLd } from "@/components/seo/JsonLd";
import { RelatedTools } from "@/components/seo/RelatedTools";
import { calculators, getCalculator, getCategory } from "@/lib/registry";
import {
  breadcrumbSchema,
  calculatorMetadata,
  faqSchema,
  webApplicationSchema,
  type Faq,
} from "@/lib/seo";
import { formatIsoDate } from "@/lib/format";

// Only prerendered paths exist; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return calculators.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const calc = getCalculator((await params).slug);
  return calc ? calculatorMetadata(calc) : {};
}

export default async function CalculatorPage({ params }: PageProps<"/[slug]">) {
  const calc = getCalculator((await params).slug);
  if (!calc) notFound();

  const category = getCategory(calc.category);
  const contentName = calc.contentPath.replace(/\.mdx$/, "");
  const [{ default: Calculator }, content] = await Promise.all([
    calc.component(),
    import(`@/content/calculators/${contentName}.mdx`) as Promise<{
      default: React.ComponentType<{ components?: Record<string, unknown> }>;
      faqs?: Faq[];
    }>,
  ]);
  const Content = content.default;
  const faqs = content.faqs ?? [];

  return (
    <article>
      <JsonLd data={webApplicationSchema(calc)} />
      {faqs.length > 0 && <JsonLd data={faqSchema(faqs)} />}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          ...(category ? [{ name: category.name, path: `/category/${category.id}` }] : []),
          { name: calc.shortTitle, path: `/${calc.slug}` },
        ])}
      />

      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          ...(category ? [{ label: category.name, href: `/category/${category.id}` }] : []),
          { label: calc.shortTitle },
        ]}
      />
      <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">{calc.title}</h1>

      <Content components={{ Calculator }} />

      {faqs.length > 0 && <FAQ faqs={faqs} />}
      <RelatedTools slugs={calc.related} />

      <p className="text-muted border-border mt-12 border-t pt-4 text-sm">
        Last updated {formatIsoDate(calc.lastUpdated)}. Results are estimates for educational
        purposes and are not financial advice.
      </p>
    </article>
  );
}
