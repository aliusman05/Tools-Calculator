import type { AffiliateContext } from "@/lib/data/affiliates";

export type CategoryId = "loans" | "savings" | "investing" | "tax" | "debt" | "other";

export type CalculatorMeta = {
  slug: string; // e.g. "mortgage-calculator"
  title: string; // H1 and <title> base
  shortTitle: string; // for cards and menus
  description: string; // meta description (150-160 chars)
  category: CategoryId;
  keywords: string[];
  related: string[]; // slugs
  contentPath: string; // MDX file
  popular?: boolean;
  /** Which affiliate offers may appear on this page (see src/lib/data/affiliates.ts). */
  affiliateContext?: AffiliateContext;
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
    related: [
      "refinance-calculator",
      "rent-vs-buy-calculator",
      "loan-calculator",
      "savings-goal-calculator",
    ],
    contentPath: "mortgage-calculator.mdx",
    affiliateContext: "mortgage",
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
    related: [
      "mortgage-calculator",
      "refinance-calculator",
      "student-loan-calculator",
      "car-loan-calculator",
      "savings-goal-calculator",
    ],
    contentPath: "loan-calculator.mdx",
    affiliateContext: "personal-loan",
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
    related: [
      "simple-interest-calculator",
      "savings-goal-calculator",
      "inflation-calculator",
      "roi-calculator",
    ],
    contentPath: "compound-interest-calculator.mdx",
    affiliateContext: "savings-account",
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
    related: ["compound-interest-calculator", "retirement-calculator", "inflation-calculator"],
    contentPath: "savings-goal-calculator.mdx",
    affiliateContext: "savings-account",
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
    related: ["compound-interest-calculator", "savings-goal-calculator", "income-tax-calculator"],
    contentPath: "retirement-calculator.mdx",
    affiliateContext: "investing",
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
    contentPath: "car-loan-calculator.mdx",
    affiliateContext: "auto-loan",
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
    contentPath: "credit-card-payoff-calculator.mdx",
    affiliateContext: "credit-card",
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
    related: ["credit-card-payoff-calculator", "student-loan-calculator", "loan-calculator"],
    contentPath: "debt-payoff-planner.mdx",
    affiliateContext: "debt-consolidation",
    lastUpdated: "2026-10-16",
  },
  {
    slug: "income-tax-calculator",
    title: "Income Tax Estimator (US Federal)",
    shortTitle: "Income Tax Estimator",
    description:
      "Estimate your 2026 US federal income tax by filing status, with the standard or itemized deduction, a bracket breakdown, and your effective and marginal rates.",
    category: "tax",
    keywords: [
      "income tax calculator",
      "federal income tax estimator",
      "tax brackets 2026",
      "marginal tax rate",
      "effective tax rate",
      "standard deduction",
    ],
    related: ["retirement-calculator", "inflation-calculator"],
    contentPath: "income-tax-calculator.mdx",
    affiliateContext: "tax-software",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "inflation-calculator",
    title: "Inflation Calculator",
    shortTitle: "Inflation Calculator",
    description:
      "See what something will cost in the future, what your money will be worth in today's dollars, or the average inflation rate between two prices, year by year.",
    category: "other",
    keywords: [
      "inflation calculator",
      "purchasing power calculator",
      "future value of money",
      "cost of living over time",
      "inflation rate",
    ],
    related: ["compound-interest-calculator", "retirement-calculator", "savings-goal-calculator"],
    contentPath: "inflation-calculator.mdx",
    popular: true,
    lastUpdated: "2026-10-16",
  },
  {
    slug: "roi-calculator",
    title: "ROI & CAGR Calculator",
    shortTitle: "ROI & CAGR Calculator",
    description:
      "Calculate return on investment (ROI) and compound annual growth rate (CAGR) from a starting and ending value, over years, months or days, with a growth chart.",
    category: "investing",
    keywords: [
      "roi calculator",
      "cagr calculator",
      "return on investment",
      "compound annual growth rate",
      "investment return",
    ],
    related: ["compound-interest-calculator", "inflation-calculator"],
    contentPath: "roi-calculator.mdx",
    affiliateContext: "investing",
    lastUpdated: "2026-10-16",
  },
  {
    slug: "rent-vs-buy-calculator",
    title: "Rent vs Buy Calculator",
    shortTitle: "Rent vs Buy Calculator",
    description:
      "Compare renting and buying a home over the years you plan to stay. Edit every assumption and see who comes out ahead, when, and how sensitive the answer is.",
    category: "loans",
    keywords: [
      "rent vs buy calculator",
      "should i rent or buy",
      "rent or buy a home",
      "buying vs renting",
      "cost of owning vs renting",
      "rent vs buy break even",
    ],
    related: ["mortgage-calculator", "refinance-calculator", "inflation-calculator"],
    contentPath: "rent-vs-buy-calculator.mdx",
    affiliateContext: "mortgage",
    lastUpdated: "2026-10-18",
  },
  {
    slug: "student-loan-calculator",
    title: "Student Loan Payoff Calculator",
    shortTitle: "Student Loan Payoff Calculator",
    description:
      "See how extra monthly payments or a lump sum shorten your student loan. Get your payoff date, the interest you save and a month-by-month payment schedule.",
    category: "loans",
    keywords: [
      "student loan calculator",
      "student loan payoff calculator",
      "pay off student loans faster",
      "student loan extra payment",
      "student loan interest",
      "student loan lump sum",
    ],
    related: ["loan-calculator", "debt-payoff-planner", "savings-goal-calculator"],
    contentPath: "student-loan-calculator.mdx",
    lastUpdated: "2026-10-17",
  },
  {
    slug: "refinance-calculator",
    title: "Refinance Calculator: Break-Even Point",
    shortTitle: "Refinance Calculator",
    description:
      "Find out when refinancing pays off. Compare payments, closing costs and total interest to see your break-even month and whether a new loan really saves money.",
    category: "loans",
    keywords: [
      "refinance calculator",
      "refinance break even",
      "mortgage refinance calculator",
      "should i refinance",
      "refinance closing costs",
      "when does refinancing pay off",
    ],
    related: ["mortgage-calculator", "loan-calculator", "car-loan-calculator"],
    contentPath: "refinance-calculator.mdx",
    affiliateContext: "mortgage",
    lastUpdated: "2026-10-17",
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
