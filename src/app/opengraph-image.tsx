import { renderOgImage } from "@/lib/og";
import { siteConfig } from "@/lib/site-config";

export const alt = `${siteConfig.name} – free personal finance calculators`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderOgImage({
    title: "Free personal finance calculators",
    subtitle: "Mortgage, loans, savings, retirement, debt and tax",
  });
}
