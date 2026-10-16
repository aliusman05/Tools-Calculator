import { renderOgImage } from "@/lib/og";
import { categories, getCategory } from "@/lib/registry";
import { siteConfig } from "@/lib/site-config";

export const alt = `${siteConfig.name} calculator category`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.id }));
}

export default async function Image({ params }: { params: Promise<{ category: string }> }) {
  const category = getCategory((await params).category);
  return renderOgImage({
    title: category?.name ?? siteConfig.name,
    subtitle: "Free calculators and guides",
  });
}
