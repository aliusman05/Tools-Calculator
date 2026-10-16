import { amortize, type AmortizationResult } from "./amortization";

export type LoanInput = {
  amount: number;
  annualRatePct: number;
  term: number;
  termUnit: "years" | "months";
  extraMonthly: number;
};

export type LoanField = keyof LoanInput;
export type LoanErrors = Partial<Record<LoanField, string>>;

export type LoanResult = AmortizationResult & {
  termMonths: number;
  baseline: Pick<AmortizationResult, "months" | "totalInterest" | "totalPaid">;
  interestSaved: number;
  monthsSaved: number;
};

export type LoanOutcome = { ok: true; result: LoanResult } | { ok: false; errors: LoanErrors };

export const MAX_LOAN_MONTHS = 600;

export function termInMonths(term: number, unit: "years" | "months"): number {
  return unit === "years" ? Math.round(term * 12) : Math.round(term);
}

export function validateLoan(input: LoanInput): LoanErrors {
  const errors: LoanErrors = {};
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    errors.amount = "Enter a loan amount above 0.";
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
  return errors;
}

export function calculateLoan(input: LoanInput): LoanOutcome {
  const errors = validateLoan(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const termMonths = termInMonths(input.term, input.termUnit);
  const base = { principal: input.amount, annualRatePct: input.annualRatePct, termMonths };
  const withExtra = amortize({ ...base, extraMonthly: input.extraMonthly });
  const baseline = amortize(base);

  return {
    ok: true,
    result: {
      ...withExtra,
      termMonths,
      baseline: {
        months: baseline.months,
        totalInterest: baseline.totalInterest,
        totalPaid: baseline.totalPaid,
      },
      interestSaved: baseline.totalInterest - withExtra.totalInterest,
      monthsSaved: baseline.months - withExtra.months,
    },
  };
}
