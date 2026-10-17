import type { MetadataRoute } from "next";
import { productionDeploy } from "@/lib/deploy";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // A preview or staging deployment asks every crawler to stay away.
  if (!productionDeploy) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/search"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
