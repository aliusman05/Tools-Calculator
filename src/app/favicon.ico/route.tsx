import { renderBrandIcon } from "@/lib/brand-icon";

// Browsers, feed readers and crawlers still ask for /favicon.ico by name, so answer it with the brand icon.
export const dynamic = "force-static";

export function GET() {
  return renderBrandIcon(48);
}
