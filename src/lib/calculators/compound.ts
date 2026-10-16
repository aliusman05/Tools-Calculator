export type Compounding = "daily" | "monthly" | "quarterly" | "annually";
export type ContributionTiming = "start" | "end";

export const COMPOUNDS_PER_YEAR: Record<Compounding, number> = {
  daily: 365,
  monthly: 12,
  quarterly: 4,
  annually: 1,
};

export type CompoundInput = {
  principal: number;
  annualRatePct: number;
  years: number;
  compounding: Compounding;
  /** Deposited once a month. */
  monthlyContribution: number;
  timing: ContributionTiming;
};

export type CompoundField = keyof CompoundInput;
export type CompoundErrors = Partial<Record<CompoundField, string>>;

export type CompoundYearRow = {
  year: number;
  contributions: number;
  interest: number;
  /** Balance at the end of the year. */
  balance: number;
  /** Starting amount plus every deposit made through the end of the year. */
  totalDeposited: number;
  cumulativeInterest: number;
};

export type CompoundResult = {
  months: number;
  finalBalance: number;
  principal: number;
  totalContributions: number;
  totalInterest: number;
  schedule: CompoundYearRow[];
};

export type CompoundOutcome =
  { ok: true; result: CompoundResult } | { ok: false; errors: CompoundErrors };

export const MAX_YEARS = 100;

/**
 * Effective monthly growth rate for a nominal annual rate compounded m times per year:
 * (1 + r/m)^(m/12) - 1. Compounding this 12 times equals (1 + r/m)^m, so balances line up
 * exactly with the textbook formula A = P(1 + r/m)^(mt) at every compounding date.
 */
export function effectiveMonthlyRate(annualRatePct: number, compounding: Compounding): number {
  const m = COMPOUNDS_PER_YEAR[compounding];
  return Math.pow(1 + annualRatePct / 100 / m, m / 12) - 1;
}

export function validateCompound(input: CompoundInput): CompoundErrors {
  const errors: CompoundErrors = {};
  const ok = Number.isFinite;
  if (!ok(input.principal) || input.principal < 0)
    errors.principal = "Starting amount cannot be negative.";
  if (!ok(input.monthlyContribution) || input.monthlyContribution < 0) {
    errors.monthlyContribution = "Monthly deposit cannot be negative.";
  }
  if (!ok(input.annualRatePct) || input.annualRatePct < 0 || input.annualRatePct > 100) {
    errors.annualRatePct = "Enter a rate between 0% and 100%.";
  }
  if (!ok(input.years) || Math.round(input.years * 12) < 1 || input.years > MAX_YEARS) {
    errors.years = `Enter a period between 1 month and ${MAX_YEARS} years.`;
  }
  if (
    !errors.principal &&
    !errors.monthlyContribution &&
    input.principal === 0 &&
    input.monthlyContribution === 0
  ) {
    errors.principal = "Enter a starting amount or a monthly deposit.";
  }
  return errors;
}

export function calculateCompound(input: CompoundInput): CompoundOutcome {
  const errors = validateCompound(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const months = Math.round(input.years * 12);
  const i = effectiveMonthlyRate(input.annualRatePct, input.compounding);

  let balance = input.principal;
  let totalContributions = 0;
  let totalInterest = 0;
  const schedule: CompoundYearRow[] = [];
  let yearContrib = 0;
  let yearInterest = 0;

  for (let month = 1; month <= months; month++) {
    if (input.timing === "start") {
      balance += input.monthlyContribution;
      yearContrib += input.monthlyContribution;
      totalContributions += input.monthlyContribution;
    }
    const interest = balance * i;
    balance += interest;
    totalInterest += interest;
    yearInterest += interest;
    if (input.timing === "end") {
      balance += input.monthlyContribution;
      yearContrib += input.monthlyContribution;
      totalContributions += input.monthlyContribution;
    }

    if (month % 12 === 0 || month === months) {
      schedule.push({
        year: Math.ceil(month / 12),
        contributions: yearContrib,
        interest: yearInterest,
        balance,
        totalDeposited: input.principal + totalContributions,
        cumulativeInterest: totalInterest,
      });
      yearContrib = 0;
      yearInterest = 0;
    }
  }

  return {
    ok: true,
    result: {
      months,
      finalBalance: balance,
      principal: input.principal,
      totalContributions,
      totalInterest,
      schedule,
    },
  };
}
