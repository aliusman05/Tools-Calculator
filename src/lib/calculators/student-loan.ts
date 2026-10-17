import { amortize, type AmortizationResult } from "./amortization";
import { MAX_LOAN_MONTHS, termInMonths } from "./loan";

/**
 * Student loan payoff: one fixed-rate loan repaid on a standard schedule, with optional extra monthly
 * payments and one lump sum, compared with paying only the scheduled amount. Pure math: no React.
 *
 * Deliberately out of scope: income-driven plans, forgiveness, deferment and grace periods. The balance
 * entered is taken as the amount that will be repaid with interest from the first payment on, so any
 * interest that has already been added to the balance must be included in it.
 */

export type StudentLoanInput = {
  /** Balance to repay, including any interest already added to it. */
  balance: number;
  annualRatePct: number;
  term: number;
  termUnit: "years" | "months";
  /** Extra principal paid every month. */
  extraMonthly: number;
  /** One-time extra principal. */
  lumpSum: number;
  /** Month of the lump sum, counted from the first payment (1 = the first payment). */
  lumpSumMonth: number;
};

export type StudentLoanField = keyof StudentLoanInput;
export type StudentLoanErrors = Partial<Record<StudentLoanField, string>>;

export type StudentLoanResult = AmortizationResult & {
  termMonths: number;
  baseline: Pick<AmortizationResult, "months" | "totalInterest" | "totalPaid">;
  interestSaved: number;
  monthsSaved: number;
  /** True when the lump sum falls before the loan is paid off (so it was actually used). */
  lumpSumApplied: boolean;
};

export type StudentLoanOutcome =
  { ok: true; result: StudentLoanResult } | { ok: false; errors: StudentLoanErrors };

export function validateStudentLoan(input: StudentLoanInput): StudentLoanErrors {
  const errors: StudentLoanErrors = {};
  if (!Number.isFinite(input.balance) || input.balance <= 0) {
    errors.balance = "Enter a balance above 0.";
  }
  if (
    !Number.isFinite(input.annualRatePct) ||
    input.annualRatePct < 0 ||
    input.annualRatePct > 50
  ) {
    errors.annualRatePct = "Enter a rate between 0% and 50%.";
  }
  const months = termInMonths(input.term, input.termUnit);
  if (!Number.isFinite(input.term) || months < 1 || months > MAX_LOAN_MONTHS) {
    errors.term = `Enter a term between 1 month and ${MAX_LOAN_MONTHS / 12} years.`;
  }
  if (!Number.isFinite(input.extraMonthly) || input.extraMonthly < 0) {
    errors.extraMonthly = "Extra payment cannot be negative.";
  }
  if (!Number.isFinite(input.lumpSum) || input.lumpSum < 0) {
    errors.lumpSum = "The lump sum cannot be negative.";
  } else if (input.lumpSum > 0) {
    const m = input.lumpSumMonth;
    if (!Number.isInteger(m) || m < 1 || m > MAX_LOAN_MONTHS) {
      errors.lumpSumMonth = `Enter a whole month number from 1 to ${MAX_LOAN_MONTHS}.`;
    }
  }
  return errors;
}

export function calculateStudentLoan(input: StudentLoanInput): StudentLoanOutcome {
  const errors = validateStudentLoan(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const termMonths = termInMonths(input.term, input.termUnit);
  const base = { principal: input.balance, annualRatePct: input.annualRatePct, termMonths };
  const useLump = input.lumpSum > 0;
  const withExtras = amortize({
    ...base,
    extraMonthly: input.extraMonthly,
    ...(useLump ? { oneTime: { amount: input.lumpSum, month: input.lumpSumMonth } } : {}),
  });
  const baseline = amortize(base);

  return {
    ok: true,
    result: {
      ...withExtras,
      termMonths,
      baseline: {
        months: baseline.months,
        totalInterest: baseline.totalInterest,
        totalPaid: baseline.totalPaid,
      },
      interestSaved: baseline.totalInterest - withExtras.totalInterest,
      monthsSaved: baseline.months - withExtras.months,
      lumpSumApplied: useLump && input.lumpSumMonth <= withExtras.months,
    },
  };
}
