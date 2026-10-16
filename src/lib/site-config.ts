export const siteConfig = {
  name: "FinCalc",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Free, fast personal finance calculators for mortgages, loans, savings, retirement, debt and taxes. Every calculation runs privately in your own browser.",
  defaultLocale: "en-US",
  defaultCurrency: "USD",
  lastUpdated: "2026-10-16",
} as const;
