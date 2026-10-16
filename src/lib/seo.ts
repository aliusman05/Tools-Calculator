import type { Metadata } from "next";
import type {
  BreadcrumbList,
  CollectionPage,
  FAQPage,
  Organization,
  WebApplication,
  WebSite,
  WithContext,
} from "schema-dts";
import type { CalculatorMeta, Category } from "@/lib/registry";
import { siteConfig } from "@/lib/site-config";

export type Faq = { question: string; answer: string };

export function absoluteUrl(path: string): string {
  return new URL(path, siteConfig.url).toString();
}

/** Page title as it appears in the browser tab, e.g. "Mortgage Calculator | FinCalc". */
export function fullTitle(title: string): string {
  return `${title} | ${siteConfig.name}`;
}

type PageSeo = {
  /** Title without the site name (the layout template appends it). */
  title: string;
  description: string;
  /** Path starting with "/". */
  path: string;
  keywords?: readonly string[];
  noindex?: boolean;
  /** Path of a shared social image, for pages without their own opengraph-image file. */
  image?: string;
};

/** Metadata shared by every indexable page: canonical URL, Open Graph and Twitter card. */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  noindex,
  image,
}: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const shown = fullTitle(title);
  return {
    title,
    description,
    ...(keywords ? { keywords: [...keywords] } : {}),
    alternates: { canonical: url },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "website",
      url,
      title: shown,
      description,
      siteName: siteConfig.name,
      locale: "en_US",
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: shown }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: shown,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export function calculatorMetadata(calc: CalculatorMeta): Metadata {
  return pageMetadata({
    title: calc.title,
    description: calc.description,
    path: `/${calc.slug}`,
    keywords: calc.keywords,
  });
}

export function webApplicationSchema(calc: CalculatorMeta): WithContext<WebApplication> {
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
    inLanguage: "en-US",
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function faqSchema(faqs: readonly Faq[]): WithContext<FAQPage> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question" as const,
      name: f.question,
      acceptedAnswer: { "@type": "Answer" as const, text: f.answer },
    })),
  };
}

export function breadcrumbSchema(
  items: ReadonlyArray<{ name: string; path: string }>,
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function organizationSchema(): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

/** WebSite with a SearchAction that points at the /search page. */
export function websiteSchema(): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: "en-US",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}`,
      },
      // Google's documented property; schema-dts has no type for it, hence the widening below.
      ...({ "query-input": "required name=search_term_string" } as object),
    },
  };
}

export function collectionPageSchema(
  category: Category,
  description: string,
  items: ReadonlyArray<Pick<CalculatorMeta, "slug" | "shortTitle">>,
): WithContext<CollectionPage> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description,
    url: absoluteUrl(`/category/${category.id}`),
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((c, i) => ({
        "@type": "ListItem" as const,
        position: i + 1,
        name: c.shortTitle,
        url: absoluteUrl(`/${c.slug}`),
      })),
    },
  };
}
