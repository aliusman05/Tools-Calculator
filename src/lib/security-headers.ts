/**
 * HTTP response headers sent with every page. Kept in a plain module so next.config.ts can import it
 * and tests can check it.
 *
 * Deliberately not included: a Content-Security-Policy. The site relies on inline scripts (the
 * consent defaults, JSON-LD) and loads Google's ad and analytics scripts, so a useful policy needs
 * per-request nonces and a long allow-list that must track Google's domains. Add one (start in
 * report-only mode) only if you can maintain it.
 */
export type Header = { key: string; value: string };

export const securityHeaders: readonly Header[] = [
  // Never let a browser guess a file's type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Cross-origin requests (affiliate and ad links, scripts) get only the origin, never the path or
  // query string, which holds the numbers a visitor typed into a calculator.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The site is never meant to be embedded in someone else's page.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // The site never needs these powers; switch them off for it and anything it embeds.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
  },
  // Browsers should only talk to the site over HTTPS (ignored over plain HTTP, so harmless locally).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** Previews and development builds additionally tell crawlers to stay away. */
export function headersFor(production: boolean): Header[] {
  return production
    ? [...securityHeaders]
    : [...securityHeaders, { key: "X-Robots-Tag", value: "noindex, nofollow" }];
}
