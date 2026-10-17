import { amortize } from "./amortization";
import { MAX_LOAN_MONTHS, termInMonths } from "./loan";

/**
 * Refinance break-even. Pure math: no React, no DOM.
 *
 * "Keeping" the loan and "refinancing" it are compared month by month. At any month m the cost of a
 * choice is what you have paid so far plus what you still owe; refinancing also pays the closing
 * costs up front unless they are rolled into the new loan (then they sit in the new balance).
 *
 *   net(m) = [paid_keep(m) + owed_keep(m)] - [paid_refi(m) + owed_refi(m) + upfront costs]
 *
 * Counting what is still owed matters: a lower payment can come from a longer term, which saves cash
 * each month but not money overall. net(m) is positive once refinancing has come out ahead.
 */

export type RefinanceInput = {
  /** Principal still owed on the current loan. */
  balance: number;
  currentRatePct: number;
  /** Time left on the current loan. */
  currentTerm: number;
  currentTermUnit: "years" | "months";
  newRatePct: number;
  newTerm: number;
  newTermUnit: "years" | "months";
  /** Fees to close the new loan. */
  closingCosts: number;
  /** True: costs are added to the new loan. False: paid in cash at closing. */
  rollCosts: boolean;
  /** How long the borrower expects to keep the new loan, for the "if you stay" figure. */
  horizonYears: number;
};

export type RefinanceField = keyof RefinanceInput;
export type RefinanceErrors = Partial<Record<RefinanceField, string>>;

export type NetPoint = {
  /** Years since closing; 0 is the closing day. */
  year: number;
  /** Net benefit of refinancing at that point (negative = still behind). */
  net: number;
};

export type RefinanceResult = {
  currentPayment: number;
  newPayment: number;
  /** Current payment minus new payment. Negative when the new payment is higher. */
  monthlySavings: number;
  newLoanAmount: number;
  /** Cash due at closing (0 when costs are rolled into the loan). */
  upfrontCosts: number;
  currentMonths: number;
  newMonths: number;
  /** First month in which refinancing is ahead, counting what is still owed. null if never. */
  breakEvenMonth: number | null;
  /** Closing costs divided by the monthly payment saving. null when it does not apply. */
  simpleBreakEvenMonths: number | null;
  horizonMonths: number;
  /** Net benefit if the new loan is kept for the horizon. */
  netAtHorizon: number;
  /** Net benefit once both loans have run their full terms. */
  lifetimeNet: number;
  /** Interest still to pay on the current loan if it is kept. */
  currentInterestRemaining: number;
  /** Interest over the life of the new loan. */
  newInterestTotal: number;
  series: NetPoint[];
};

export type RefinanceOutcome =
  { ok: true; result: RefinanceResult } | { ok: false; errors: RefinanceErrors };

export const MAX_HORIZON_YEARS = 50;

/** Comparisons treat differences smaller than a hundredth of a cent as zero (floating-point noise). */
const EPSILON = 1e-6;

export function validateRefinance(input: RefinanceInput): RefinanceErrors {
  const errors: RefinanceErrors = {};
  if (!Number.isFinite(input.balance) || input.balance <= 0) {
    errors.balance = "Enter the balance you still owe, above 0.";
  }
  const rateOk = (r: number) => Number.isFinite(r) && r >= 0 && r <= 50;
  if (!rateOk(input.currentRatePct)) {
    errors.currentRatePct = "Enter a rate between 0% and 50%.";
  }
  if (!rateOk(input.newRatePct)) {
    errors.newRatePct = "Enter a rate between 0% and 50%.";
  }
  const termOk = (t: number, unit: "years" | "months") => {
    const months = termInMonths(t, unit);
    return Number.isFinite(t) && months >= 1 && months <= MAX_LOAN_MONTHS;
  };
  const termMessage = `Enter a term between 1 month and ${MAX_LOAN_MONTHS / 12} years.`;
  if (!termOk(input.currentTerm, input.currentTermUnit)) errors.currentTerm = termMessage;
  if (!termOk(input.newTerm, input.newTermUnit)) errors.newTerm = termMessage;
  if (!Number.isFinite(input.closingCosts) || input.closingCosts < 0) {
    errors.closingCosts = "Closing costs cannot be negative.";
  }
  if (
    !Number.isFinite(input.horizonYears) ||
    input.horizonYears < 1 ||
    input.horizonYears > MAX_HORIZON_YEARS
  ) {
    errors.horizonYears = `Enter between 1 and ${MAX_HORIZON_YEARS} years.`;
  }
  return errors;
}

/** Running totals for one loan, padded with its final values after the loan has ended. */
function track(principal: number, ratePct: number, months: number, length: number) {
  const { monthlyPayment, schedule, totalInterest } = amortize({
    principal,
    annualRatePct: ratePct,
    termMonths: months,
  });
  const paid = new Array<number>(length + 1).fill(0);
  const owed = new Array<number>(length + 1).fill(0);
  owed[0] = principal;
  for (let m = 1; m <= length; m++) {
    const row = schedule[m - 1];
    paid[m] = paid[m - 1] + (row ? row.payment : 0);
    owed[m] = row ? row.balance : 0;
  }
  return { monthlyPayment, paid, owed, totalInterest };
}

export function calculateRefinance(input: RefinanceInput): RefinanceOutcome {
  const errors = validateRefinance(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const currentMonths = termInMonths(input.currentTerm, input.currentTermUnit);
  const newMonths = termInMonths(input.newTerm, input.newTermUnit);
  const horizonMonths = Math.round(input.horizonYears * 12);
  // Long enough to cover both loans and the horizon, so every comparison point exists.
  const length = Math.max(currentMonths, newMonths, horizonMonths);

  const newLoanAmount = input.rollCosts ? input.balance + input.closingCosts : input.balance;
  const upfrontCosts = input.rollCosts ? 0 : input.closingCosts;

  const keep = track(input.balance, input.currentRatePct, currentMonths, length);
  const refi = track(newLoanAmount, input.newRatePct, newMonths, length);

  const net = (m: number) =>
    keep.paid[m]! + keep.owed[m]! - (refi.paid[m]! + refi.owed[m]! + upfrontCosts);

  const fullTerms = Math.max(currentMonths, newMonths);
  let breakEvenMonth: number | null = null;
  for (let m = 1; m <= fullTerms; m++) {
    if (net(m) >= -EPSILON) {
      breakEvenMonth = m;
      break;
    }
  }

  const monthlySavings = keep.monthlyPayment - refi.monthlyPayment;
  let simpleBreakEvenMonths: number | null = null;
  if (!input.rollCosts && monthlySavings > EPSILON) {
    simpleBreakEvenMonths = input.closingCosts / monthlySavings;
  }

  const series: NetPoint[] = [];
  for (let year = 0; year * 12 < fullTerms; year++) {
    series.push({ year, net: net(year * 12) });
  }
  series.push({ year: fullTerms / 12, net: net(fullTerms) });

  return {
    ok: true,
    result: {
      currentPayment: keep.monthlyPayment,
      newPayment: refi.monthlyPayment,
      monthlySavings,
      newLoanAmount,
      upfrontCosts,
      currentMonths,
      newMonths,
      breakEvenMonth,
      simpleBreakEvenMonths,
      horizonMonths,
      netAtHorizon: net(horizonMonths),
      lifetimeNet: net(fullTerms),
      currentInterestRemaining: keep.totalInterest,
      newInterestTotal: refi.totalInterest,
      series,
    },
  };
}
