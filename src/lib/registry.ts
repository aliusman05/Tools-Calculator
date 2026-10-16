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
    related: ["loan-calculator", "savings-goal-calculator"],
    component: () => import("@/components/calculators/mortgage/MortgageCalculator"),
    contentPath: "mortgage-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "loan-calculator",
    title: "Loan Calculator with Extra Payments",
    shortTitle: "Loan Calculator",
    description:
      "Calculate loan payments, total interest and your payoff date for any fixed-rate loan. Add extra payments to see how much interest and time you can save.",
    category: "loans",
    keywords: [
      "loan calculator",
      "emi calculator",
      "monthly loan payment",
      "personal loan",
      "car loan payment",
      "loan amortization",
    ],
    related: ["mortgage-calculator", "car-loan-calculator", "savings-goal-calculator"],
    component: () => import("@/components/calculators/loan/LoanCalculator"),
    contentPath: "loan-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "compound-interest-calculator",
    title: "Compound Interest Calculator",
    shortTitle: "Compound Interest Calculator",
    description:
      "See how your savings grow with compound interest and regular deposits. Compare daily, monthly, quarterly and annual compounding with a year-by-year breakdown.",
    category: "savings",
    keywords: [
      "compound interest calculator",
      "compound interest formula",
      "investment growth",
      "savings growth",
      "future value",
    ],
    related: ["simple-interest-calculator", "savings-goal-calculator"],
    component: () =>
      import("@/components/calculators/compound-interest/CompoundInterestCalculator"),
    contentPath: "compound-interest-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "simple-interest-calculator",
    title: "Simple Interest Calculator",
    shortTitle: "Simple Interest Calculator",
    description:
      "Work out simple interest on a loan or deposit and compare it with compound interest side by side, over days, months or years, with a year-by-year growth chart.",
    category: "savings",
    keywords: [
      "simple interest calculator",
      "simple interest formula",
      "interest on a loan",
      "I = PRT",
    ],
    related: ["compound-interest-calculator", "loan-calculator"],
    component: () => import("@/components/calculators/simple-interest/SimpleInterestCalculator"),
    contentPath: "simple-interest-calculator.mdx",
    lastUpdated: "2026-10-16",
  },
  {
    slug: "savings-goal-calculator",
    title: "Savings Goal Calculator",
    shortTitle: "Savings Goal Calculator",
    description:
      "Find the monthly amount you need to save to reach a goal by a date, or see how long it takes at your current pace, including interest earned along the way.",
    category: "savings",
    keywords: [
      "savings goal calculator",
      "how much to save per month",
      "time to reach savings goal",
      "savings plan",
    ],
    related: ["compound-interest-calculator", "loan-calculator"],
    component: () => import("@/components/calculators/savings-goal/SavingsGoalCalculator"),
    contentPath: "savings-goal-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "retirement-calculator",
    title: "401(k) & Retirement Calculator",
    shortTitle: "Retirement Calculator",
    description:
      "Project your 401(k) at retirement with employer match, salary growth and inflation. See your balance in today's dollars and a sample withdrawal income.",
    category: "investing",
    keywords: [
      "retirement calculator",
      "401k calculator",
      "employer match",
      "retirement savings",
      "4% rule",
    ],
    related: ["compound-interest-calculator", "savings-goal-calculator"],
    component: () => import("@/components/calculators/retirement/RetirementCalculator"),
    contentPath: "retirement-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "car-loan-calculator",
    title: "Car Loan Calculator with Trade-In & Tax",
    shortTitle: "Car Loan Calculator",
    description:
      "Estimate your car payment including sales tax, fees, trade-in and down payment. See the amount financed, total interest and the full cost of the vehicle.",
    category: "loans",
    keywords: [
      "car loan calculator",
      "auto loan calculator",
      "car payment",
      "trade-in",
      "sales tax car",
    ],
    related: ["loan-calculator", "credit-card-payoff-calculator"],
    component: () => import("@/components/calculators/car-loan/CarLoanCalculator"),
    contentPath: "car-loan-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "credit-card-payoff-calculator",
    title: "Credit Card Payoff Calculator",
    shortTitle: "Credit Card Payoff Calculator",
    description:
      "See how long it takes to pay off your credit card at a fixed payment, or what to pay each month to be debt-free by a date, plus the total interest you will owe.",
    category: "debt",
    keywords: [
      "credit card payoff calculator",
      "pay off credit card",
      "credit card interest",
      "debt free date",
      "minimum payment",
    ],
    related: ["debt-payoff-planner", "loan-calculator"],
    component: () => import("@/components/calculators/credit-card/CreditCardCalculator"),
    contentPath: "credit-card-payoff-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "debt-payoff-planner",
    title: "Debt Payoff Planner: Snowball vs Avalanche",
    shortTitle: "Debt Payoff Planner",
    description:
      "Compare the debt snowball and avalanche methods across all your debts. See your payoff order, total interest and months to debt-free against minimum payments.",
    category: "debt",
    keywords: [
      "debt snowball calculator",
      "debt avalanche calculator",
      "debt payoff planner",
      "pay off multiple debts",
      "debt free",
    ],
    related: ["credit-card-payoff-calculator", "loan-calculator"],
    component: () => import("@/components/calculators/debt-payoff/DebtPayoffPlanner"),
    contentPath: "debt-payoff-planner.mdx",
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
