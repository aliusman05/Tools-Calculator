import type { Metadata } from "next";
import type { CalculatorMeta } from "@/lib/registry";
import { siteConfig } from "@/lib/site-config";

export type Faq = { question: string; answer: string };

export function absoluteUrl(path: string): string {
  return new URL(path, siteConfig.url).toString();
}

export function calculatorMetadata(calc: CalculatorMeta): Metadata {
  const url = absoluteUrl(`/${calc.slug}`);
  return {
    title: calc.title,
    description: calc.description,
    keywords: calc.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: calc.title,
      description: calc.description,
      siteName: siteConfig.name,
    },
    twitter: { card: "summary_large_image", title: calc.title, description: calc.description },
  };
}

export function webApplicationSchema(calc: CalculatorMeta) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: calc.title,
    description: calc.description,
    url: absoluteUrl(`/${calc.slug}`),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    dateModified: calc.lastUpdated,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function faqSchema(faqs: readonly Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function breadcrumbSchema(items: ReadonlyArray<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
