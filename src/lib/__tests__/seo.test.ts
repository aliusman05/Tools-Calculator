import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { categoryContent } from "@/lib/category-content";
import { calculators, categories } from "@/lib/registry";
import {
  absoluteUrl,
  breadcrumbSchema,
  calculatorMetadata,
  collectionPageSchema,
  faqSchema,
  fullTitle,
  organizationSchema,
  pageMetadata,
  webApplicationSchema,
  websiteSchema,
} from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

const inRange = (s: string) => s.length >= 150 && s.length <= 160;

describe("titles and descriptions", () => {
  it("home description is 150-160 characters", () => {
    expect(inRange(siteConfig.description)).toBe(true);
  });

  it("every full page title is under 60 characters", () => {
    for (const c of calculators) expect(fullTitle(c.title).length).toBeLessThan(60);
    for (const c of categories) expect(fullTitle(`${c.name} Calculators`).length).toBeLessThan(60);
  });

  it("calculator titles and descriptions are unique", () => {
    expect(new Set(calculators.map((c) => c.title)).size).toBe(calculators.length);
    expect(new Set(calculators.map((c) => c.description)).size).toBe(calculators.length);
  });

  it("category meta descriptions are 150-160 characters and unique", () => {
    const all = categories.map((c) => categoryContent[c.id].metaDescription);
    for (const d of all) expect(inRange(d), d).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  it("category intros are unique, multi-paragraph and not boilerplate", () => {
    const intros = categories.map((c) => categoryContent[c.id].intro.join(" "));
    expect(new Set(intros).size).toBe(categories.length);
    for (const c of categories) {
      const content = categoryContent[c.id];
      expect(content.intro.length).toBeGreaterThanOrEqual(2);
      expect(content.intro.join(" ").length).toBeGreaterThan(300);
      expect(content.guidance.points.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("metadata", () => {
  const meta = calculatorMetadata(calculators[0]!);

  it("sets canonical, Open Graph and Twitter fields", () => {
    expect(meta.alternates?.canonical).toBe(absoluteUrl(`/${calculators[0]!.slug}`));
    expect(meta.openGraph).toMatchObject({ type: "website", siteName: siteConfig.name });
    expect(meta.openGraph?.title).toBe(fullTitle(calculators[0]!.title));
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("marks noindex pages", () => {
    const m = pageMetadata({ title: "x", description: "y", path: "/search", noindex: true });
    expect(m.robots).toMatchObject({ index: false });
  });

  it("builds absolute URLs without a trailing slash on pages", () => {
    expect(absoluteUrl("/loan-calculator")).toBe(
      `${siteConfig.url.replace(/\/$/, "")}/loan-calculator`,
    );
  });
});

describe("JSON-LD", () => {
  const calc = calculators[0]!;

  it("WebApplication has the required fields", () => {
    const s = webApplicationSchema(calc);
    expect(s["@context"]).toBe("https://schema.org");
    expect(s["@type"]).toBe("WebApplication");
    expect(s).toMatchObject({ name: calc.title, applicationCategory: "FinanceApplication" });
    expect(s.offers).toMatchObject({ price: "0", priceCurrency: "USD" });
  });

  it("FAQPage questions each have a name and an answer", () => {
    const s = faqSchema([
      { question: "Q1?", answer: "A1." },
      { question: "Q2?", answer: "A2." },
    ]);
    const entities = s.mainEntity as unknown as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(2);
    for (const e of entities) {
      expect(e["@type"]).toBe("Question");
      expect(typeof e.name).toBe("string");
      expect(e.acceptedAnswer).toMatchObject({ "@type": "Answer" });
    }
  });

  it("BreadcrumbList positions start at 1 and URLs are absolute", () => {
    const s = breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Loans", path: "/category/loans" },
      { name: "Loan", path: "/loan-calculator" },
    ]);
    const items = s.itemListElement as unknown as Array<{ position: number; item: string }>;
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    for (const i of items) expect(i.item).toMatch(/^https?:\/\//);
  });

  it("Organization and WebSite schemas are well formed, with a SearchAction", () => {
    expect(organizationSchema()).toMatchObject({ "@type": "Organization", name: siteConfig.name });
    const site = websiteSchema();
    expect(site["@type"]).toBe("WebSite");
    const action = site.potentialAction as unknown as {
      target: { urlTemplate: string };
      "query-input": string;
    };
    expect(action.target.urlTemplate).toContain("/search?q={search_term_string}");
    expect(action["query-input"]).toBe("required name=search_term_string");
  });

  it("CollectionPage lists every calculator in the category in order", () => {
    const cat = categories[0]!;
    const items = calculators.filter((c) => c.category === cat.id);
    const s = collectionPageSchema(cat, "d", items);
    const list = (
      s.mainEntity as unknown as { itemListElement: Array<{ position: number; url: string }> }
    ).itemListElement;
    expect(list).toHaveLength(items.length);
    expect(list[0]).toMatchObject({ position: 1, url: absoluteUrl(`/${items[0]!.slug}`) });
  });

  it("serialises to valid JSON", () => {
    for (const s of [webApplicationSchema(calc), organizationSchema(), websiteSchema()]) {
      expect(() => JSON.parse(JSON.stringify(s))).not.toThrow();
    }
  });
});

describe("sitemap and robots", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it("lists the home page, every category and every calculator exactly once", () => {
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(absoluteUrl("/"));
    for (const c of categories) expect(urls).toContain(absoluteUrl(`/category/${c.id}`));
    for (const c of calculators) expect(urls).toContain(absoluteUrl(`/${c.slug}`));
  });

  it("does not list the noindex search page", () => {
    expect(urls.some((u) => u.includes("/search"))).toBe(false);
  });

  it("uses valid priorities and dates", () => {
    for (const e of entries) {
      expect(e.priority).toBeGreaterThan(0);
      expect(e.priority).toBeLessThanOrEqual(1);
      expect(Number.isNaN((e.lastModified as Date).getTime())).toBe(false);
    }
  });

  it("robots points at the sitemap and blocks the search page", () => {
    const r = robots();
    expect(r.sitemap).toBe(absoluteUrl("/sitemap.xml"));
    const rule = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    expect(rule.disallow).toContain("/search");
  });
});

describe("internal linking", () => {
  it("every calculator is linked from at least one other calculator", () => {
    const linked = new Set(calculators.flatMap((c) => c.related));
    for (const c of calculators) {
      expect(linked.has(c.slug), `${c.slug} has no inbound related link`).toBe(true);
    }
  });

  it("every calculator links to at least two related calculators", () => {
    for (const c of calculators) expect(c.related.length, c.slug).toBeGreaterThanOrEqual(2);
  });

  it("every category has at least one calculator", () => {
    for (const cat of categories) {
      expect(
        calculators.some((c) => c.category === cat.id),
        cat.id,
      ).toBe(true);
    }
  });
});
