/** Inflation math: future prices, purchasing power, and the implied average inflation rate. */

export type InflationMode = "future" | "power" | "rate";

export type InflationInput = {
  mode: InflationMode;
  /** The starting amount in dollars. */
  amount: number;
  /** Annual inflation in percent (modes "future" and "power"). */
  ratePct: number;
  years: number;
  /** Mode "rate": what the same basket costs at the end. */
  endAmount: number;
};

export type InflationField = keyof InflationInput;
export type InflationErrors = Partial<Record<InflationField, string>>;

export type InflationRow = {
  year: number;
  /** What `amount` of today's purchasing power costs in this year. */
  futureCost: number;
  /** What `amount` will buy in this year, measured in today's dollars. */
  purchasingPower: number;
};

export type InflationResult = {
  mode: InflationMode;
  /** The annual rate used (given, or solved for in mode "rate"). */
  ratePct: number;
  years: number;
  /** Mode "future": future cost of `amount`. Mode "power": value of `amount` in today's dollars. */
  headline: number;
  /** Total price increase over the period, in percent. */
  totalInflationPct: number;
  /** Years for prices to double at this rate; null at 0% or below. */
  doublingYears: number | null;
  /** Share of purchasing power lost over the period, in percent. */
  powerLostPct: number;
  schedule: InflationRow[];
};

export type InflationOutcome =
  { ok: true; result: InflationResult } | { ok: false; errors: InflationErrors };

export const MAX_INFLATION_YEARS = 100;

export function validateInflation(input: InflationInput): InflationErrors {
  const errors: InflationErrors = {};
  const ok = Number.isFinite;
  if (!ok(input.amount) || input.amount <= 0) errors.amount = "Enter an amount above 0.";
  if (!ok(input.years) || input.years <= 0 || input.years > MAX_INFLATION_YEARS) {
    errors.years = `Enter a period above 0 and up to ${MAX_INFLATION_YEARS} years.`;
  }
  if (input.mode === "rate") {
    if (!ok(input.endAmount) || input.endAmount <= 0) errors.endAmount = "Enter an amount above 0.";
  } else if (!ok(input.ratePct) || input.ratePct < -20 || input.ratePct > 100) {
    errors.ratePct = "Enter a rate between -20% and 100%.";
  }
  return errors;
}

/** FV = PV x (1 + i)^t */
export function futureValue(amount: number, ratePct: number, years: number): number {
  return amount * Math.pow(1 + ratePct / 100, years);
}

/** The average annual rate that turns `start` into `end` over `years`. */
export function impliedRatePct(start: number, end: number, years: number): number {
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export function calculateInflation(input: InflationInput): InflationOutcome {
  const errors = validateInflation(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const ratePct =
    input.mode === "rate"
      ? impliedRatePct(input.amount, input.endAmount, input.years)
      : input.ratePct;
  const growth = Math.pow(1 + ratePct / 100, input.years);

  const schedule: InflationRow[] = [];
  const whole = Math.floor(input.years);
  const points = Array.from({ length: whole + 1 }, (_, i) => i);
  if (input.years > whole) points.push(input.years);
  for (const year of points) {
    const g = Math.pow(1 + ratePct / 100, year);
    schedule.push({ year, futureCost: input.amount * g, purchasingPower: input.amount / g });
  }

  return {
    ok: true,
    result: {
      mode: input.mode,
      ratePct,
      years: input.years,
      headline: input.mode === "power" ? input.amount / growth : input.amount * growth,
      totalInflationPct: (growth - 1) * 100,
      doublingYears: ratePct > 0 ? Math.log(2) / Math.log(1 + ratePct / 100) : null,
      powerLostPct: (1 - 1 / growth) * 100,
      schedule,
    },
  };
}
