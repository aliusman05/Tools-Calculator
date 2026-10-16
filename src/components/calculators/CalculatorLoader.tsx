"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * One lazily loaded component per calculator.
 *
 * Why this lives in a client component rather than in the registry: if the (server-side) registry
 * imported the calculators, Next would treat every calculator as a client dependency of the root
 * layout, and every page, even "About", would download all twelve. Here each calculator is its own
 * chunk, requested only by the page that renders it. Each `dynamic(() => import(...))` must be
 * written out literally so the bundler can find it and preload the right chunk during SSR.
 *
 * Adding a calculator: add a line here, a registry entry and an MDX file. A unit test fails if the
 * registry and this map disagree.
 */
export const calculatorComponents = {
  "mortgage-calculator": dynamic(
    () => import("@/components/calculators/mortgage/MortgageCalculator"),
  ),
  "loan-calculator": dynamic(() => import("@/components/calculators/loan/LoanCalculator")),
  "compound-interest-calculator": dynamic(
    () => import("@/components/calculators/compound-interest/CompoundInterestCalculator"),
  ),
  "simple-interest-calculator": dynamic(
    () => import("@/components/calculators/simple-interest/SimpleInterestCalculator"),
  ),
  "savings-goal-calculator": dynamic(
    () => import("@/components/calculators/savings-goal/SavingsGoalCalculator"),
  ),
  "retirement-calculator": dynamic(
    () => import("@/components/calculators/retirement/RetirementCalculator"),
  ),
  "car-loan-calculator": dynamic(
    () => import("@/components/calculators/car-loan/CarLoanCalculator"),
  ),
  "credit-card-payoff-calculator": dynamic(
    () => import("@/components/calculators/credit-card/CreditCardCalculator"),
  ),
  "debt-payoff-planner": dynamic(
    () => import("@/components/calculators/debt-payoff/DebtPayoffPlanner"),
  ),
  "income-tax-calculator": dynamic(
    () => import("@/components/calculators/income-tax/IncomeTaxCalculator"),
  ),
  "inflation-calculator": dynamic(
    () => import("@/components/calculators/inflation/InflationCalculator"),
  ),
  "roi-calculator": dynamic(() => import("@/components/calculators/roi/RoiCalculator")),
} satisfies Record<string, ComponentType>;

export function CalculatorLoader({ slug }: { slug: string }) {
  const Calculator = (calculatorComponents as Record<string, ComponentType | undefined>)[slug];
  return Calculator ? <Calculator /> : null;
}
