import { renderOgImage } from "@/lib/og";
import { calculators, getCalculator } from "@/lib/registry";
import { siteConfig } from "@/lib/site-config";

export const alt = `${siteConfig.name} calculator`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return calculators.map((c) => ({ slug: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const calc = getCalculator((await params).slug);
  return renderOgImage({
    title: calc?.title ?? siteConfig.name,
    subtitle: calc ? "Formulas explained, with a worked example" : siteConfig.description,
  });
}
