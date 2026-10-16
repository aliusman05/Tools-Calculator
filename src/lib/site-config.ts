export const siteConfig = {
  name: "FinCalc",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Free, fast personal finance calculators for mortgages, loans, savings, investing and taxes. All calculations run in your browser.",
  defaultLocale: "en-US",
  defaultCurrency: "USD",
  lastUpdated: "2026-10-16",
} as const;
