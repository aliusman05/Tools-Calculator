import type { MetadataRoute } from "next";
import { staticPages } from "@/lib/pages";
import { calculators, categories } from "@/lib/registry";
import { absoluteUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = new Date(siteConfig.lastUpdated);
  return [
    ...staticPages.map((p) => ({
      url: absoluteUrl(p.path),
      lastModified: site,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...categories.map((c) => ({
      url: absoluteUrl(`/category/${c.id}`),
      lastModified: site,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...calculators.map((c) => ({
      url: absoluteUrl(`/${c.slug}`),
      lastModified: new Date(c.lastUpdated),
      changeFrequency: "monthly" as const,
      priority: c.popular ? 0.9 : 0.8,
    })),
  ];
}
