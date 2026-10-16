import { COMPOUNDS_PER_YEAR, type Compounding } from "./compound";

export type TimeUnit = "years" | "months" | "days";

export type SimpleInterestInput = {
  principal: number;
  /** Annual rate in percent. */
  annualRatePct: number;
  time: number;
  unit: TimeUnit;
  /** Compounding used for the side-by-side comparison. */
  compareWith: Compounding;
};

export type SimpleInterestField = keyof SimpleInterestInput;
export type SimpleInterestErrors = Partial<Record<SimpleInterestField, string>>;

export type GrowthPoint = { year: number; simple: number; compound: number };

export type SimpleInterestResult = {
  years: number;
  interest: number;
  total: number;
  compoundInterest: number;
  compoundTotal: number;
  /** How much more compounding earns than simple interest over the period. */
  difference: number;
  series: GrowthPoint[];
};

export type SimpleInterestOutcome =
  { ok: true; result: SimpleInterestResult } | { ok: false; errors: SimpleInterestErrors };

export function toYears(time: number, unit: TimeUnit): number {
  if (unit === "years") return time;
  if (unit === "months") return time / 12;
  return time / 365;
}

/** I = P * R * T, with R as a fraction and T in years. */
export function simpleInterest(principal: number, annualRatePct: number, years: number): number {
  return principal * (annualRatePct / 100) * years;
}

/** A = P(1 + r/m)^(m t). */
export function compoundAmount(
  principal: number,
  annualRatePct: number,
  years: number,
  compounding: Compounding,
): number {
  const m = COMPOUNDS_PER_YEAR[compounding];
  return principal * Math.pow(1 + annualRatePct / 100 / m, m * years);
}

export function validateSimpleInterest(input: SimpleInterestInput): SimpleInterestErrors {
  const errors: SimpleInterestErrors = {};
  if (!Number.isFinite(input.principal) || input.principal <= 0) {
    errors.principal = "Enter an amount above 0.";
  }
  if (
    !Number.isFinite(input.annualRatePct) ||
    input.annualRatePct < 0 ||
    input.annualRatePct > 100
  ) {
    errors.annualRatePct = "Enter a rate between 0% and 100%.";
  }
  const years = toYears(input.time, input.unit);
  if (!Number.isFinite(input.time) || input.time <= 0 || years > 100) {
    errors.time = "Enter a time above 0 and up to 100 years.";
  }
  return errors;
}

export function calculateSimpleInterest(input: SimpleInterestInput): SimpleInterestOutcome {
  const errors = validateSimpleInterest(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const years = toYears(input.time, input.unit);
  const interest = simpleInterest(input.principal, input.annualRatePct, years);
  const compoundTotal = compoundAmount(
    input.principal,
    input.annualRatePct,
    years,
    input.compareWith,
  );

  const steps = Math.min(30, Math.max(4, Math.ceil(years)));
  const series: GrowthPoint[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = (years * k) / steps;
    series.push({
      year: Math.round(t * 100) / 100,
      simple: input.principal + simpleInterest(input.principal, input.annualRatePct, t),
      compound: compoundAmount(input.principal, input.annualRatePct, t, input.compareWith),
    });
  }

  return {
    ok: true,
    result: {
      years,
      interest,
      total: input.principal + interest,
      compoundInterest: compoundTotal - input.principal,
      compoundTotal,
      difference: compoundTotal - input.principal - interest,
      series,
    },
  };
}
