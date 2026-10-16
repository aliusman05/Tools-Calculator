import type { ComponentType } from "react";

export type CategoryId = "loans" | "savings" | "investing" | "tax" | "debt" | "other";

export type CalculatorMeta = {
  slug: string; // e.g. "mortgage-calculator"
  title: string; // H1 and <title> base
  shortTitle: string; // for cards and menus
  description: string; // meta description (150-160 chars)
  category: CategoryId;
  keywords: string[];
  related: string[]; // slugs
  component: () => Promise<{ default: ComponentType }>; // dynamic import
  contentPath: string; // MDX file
  popular?: boolean;
  lastUpdated: string; // ISO date
};

export type Category = {
  id: CategoryId;
  name: string;
  description: string;
};

export const categories: readonly Category[] = [
  {
    id: "loans",
    name: "Loans & Mortgages",
    description: "Monthly payments, interest and payoff schedules.",
  },
  { id: "savings", name: "Savings", description: "Grow your money and plan toward a goal." },
  {
    id: "investing",
    name: "Investing & Retirement",
    description: "Returns, growth and retirement planning.",
  },
  { id: "tax", name: "Tax", description: "Estimate what you owe and what you keep." },
  { id: "debt", name: "Debt", description: "Pay off cards and balances faster." },
  {
    id: "other",
    name: "Other Tools",
    description: "Inflation, conversions and everyday money math.",
  },
];

// One entry per calculator. Populated from Phase 2 onward.
export const calculators: readonly CalculatorMeta[] = [
  {
    slug: "mortgage-calculator",
    title: "Mortgage Calculator with Extra Payments",
    shortTitle: "Mortgage Calculator",
    description:
      "Estimate your monthly mortgage payment with taxes, insurance, HOA and PMI. See total interest, your payoff date, and how extra payments shorten the loan.",
    category: "loans",
    keywords: [
      "mortgage calculator",
      "monthly mortgage payment",
      "home loan",
      "amortization",
      "PMI",
      "extra payments",
    ],
    related: [],
    component: () => import("@/components/calculators/mortgage/MortgageCalculator"),
    contentPath: "mortgage-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
];

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getCalculator(slug: string): CalculatorMeta | undefined {
  return calculators.find((c) => c.slug === slug);
}

export function getCalculatorsByCategory(id: CategoryId): CalculatorMeta[] {
  return calculators.filter((c) => c.category === id);
}

export function getPopularCalculators(limit = 8): CalculatorMeta[] {
  return calculators.filter((c) => c.popular).slice(0, limit);
}

/** Serializable subset for client components such as search. */
export type CalculatorSummary = Pick<
  CalculatorMeta,
  "slug" | "shortTitle" | "description" | "category" | "keywords"
>;

export function getSummaries(): CalculatorSummary[] {
  return calculators.map(({ slug, shortTitle, description, category, keywords }) => ({
    slug,
    shortTitle,
    description,
    category,
    keywords,
  }));
}
