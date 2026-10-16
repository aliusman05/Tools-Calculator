/** Return on investment and compound annual growth rate (CAGR). */

export type RoiUnit = "years" | "months" | "days";

export type RoiInput = {
  initial: number;
  final: number;
  /** Length of the holding period; 0 means "not given" (only ROI is computed). */
  time: number;
  unit: RoiUnit;
};

export type RoiField = keyof RoiInput;
export type RoiErrors = Partial<Record<RoiField, string>>;

export type RoiPoint = { year: number; compound: number; straightLine: number };

export type RoiResult = {
  gain: number;
  /** (final - initial) / initial, in percent. */
  roiPct: number;
  years: number | null;
  /** (final / initial)^(1 / years) - 1, in percent; null without a holding period. */
  cagrPct: number | null;
  /** ROI divided by years (no compounding), in percent per year; null without a holding period. */
  simpleAnnualPct: number | null;
  /** Years to double at the CAGR; null if the CAGR is not positive. */
  doublingYears: number | null;
  series: RoiPoint[];
};

export type RoiOutcome = { ok: true; result: RoiResult } | { ok: false; errors: RoiErrors };

export const MAX_ROI_YEARS = 200;

export function roiYears(time: number, unit: RoiUnit): number {
  if (unit === "years") return time;
  if (unit === "months") return time / 12;
  return time / 365;
}

export function validateRoi(input: RoiInput): RoiErrors {
  const errors: RoiErrors = {};
  const ok = Number.isFinite;
  if (!ok(input.initial) || input.initial <= 0) errors.initial = "Enter an initial amount above 0.";
  if (!ok(input.final) || input.final < 0) errors.final = "The final value cannot be negative.";
  if (!ok(input.time) || input.time < 0 || roiYears(input.time, input.unit) > MAX_ROI_YEARS) {
    errors.time = `Enter a period from 0 up to ${MAX_ROI_YEARS} years.`;
  }
  return errors;
}

export function calculateRoi(input: RoiInput): RoiOutcome {
  const errors = validateRoi(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const gain = input.final - input.initial;
  const roi = gain / input.initial;
  const years = input.time > 0 ? roiYears(input.time, input.unit) : null;
  const cagr = years === null ? null : Math.pow(input.final / input.initial, 1 / years) - 1;

  const series: RoiPoint[] = [];
  if (years !== null) {
    const steps = Math.min(30, Math.max(4, Math.ceil(years)));
    for (let k = 0; k <= steps; k++) {
      const t = (years * k) / steps;
      series.push({
        year: Math.round(t * 100) / 100,
        compound: input.initial * Math.pow(input.final / input.initial, t / years),
        straightLine: input.initial + (gain * t) / years,
      });
    }
  }

  return {
    ok: true,
    result: {
      gain,
      roiPct: roi * 100,
      years,
      cagrPct: cagr === null ? null : cagr * 100,
      simpleAnnualPct: years === null ? null : (roi * 100) / years,
      doublingYears: cagr !== null && cagr > 0 ? Math.log(2) / Math.log(1 + cagr) : null,
      series,
    },
  };
}
