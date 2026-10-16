export const siteConfig = {
  name: "FinCalc",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Free, fast personal finance calculators for mortgages, loans, savings, retirement, debt and taxes. Every calculation runs privately in your own browser.",
  defaultLocale: "en-US",
  defaultCurrency: "USD",
  lastUpdated: "2026-10-16",
  /**
   * Details used by the legal pages. These are PLACEHOLDERS: replace them, review every legal
   * page for your jurisdiction, then set `reviewed` to true to remove the "template" notice.
   */
  legal: {
    operatorName: "[Your name or company name]",
    contactEmail: "hello@example.com",
    jurisdiction: "[Your state or country]",
    lastUpdated: "2026-10-16",
    reviewed: false,
  } as {
    operatorName: string;
    contactEmail: string;
    jurisdiction: string;
    lastUpdated: string;
    reviewed: boolean;
  },
} as const;
