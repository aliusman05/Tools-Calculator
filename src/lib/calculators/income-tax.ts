/**
 * US federal income tax ESTIMATE on ordinary income. It applies the standard (or itemized)
 * deduction and the progressive brackets from a tax-year data file. It does not model payroll
 * taxes, state taxes, capital gains rates, the QBI deduction, AMT, phase-outs, or special
 * deductions, and treats credits as reducing tax no lower than zero.
 */
import {
  taxUs2026,
  type Bracket,
  type FilingStatus,
  type TaxYearData,
} from "@/lib/data/tax-us-2026";

export const CURRENT_TAX_YEAR: TaxYearData = taxUs2026;

export type { FilingStatus };

export type IncomeTaxInput = {
  status: FilingStatus;
  /** Wages and other ordinary income before any adjustments. */
  grossIncome: number;
  /** Above-the-line adjustments such as traditional 401(k)/IRA, HSA contributions. */
  adjustments: number;
  deductionType: "standard" | "itemized";
  /** Total itemized deductions; used when deductionType = "itemized". */
  itemizedDeductions: number;
  /** Number of people (taxpayer/spouse) who are 65 or older or blind; adds to the standard deduction. */
  age65OrBlindCount: number;
  /** Tax credits, subtracted from tax (not below zero). */
  credits: number;
  /** Federal income tax already withheld or paid in estimated payments. */
  withheld: number;
};

export type IncomeTaxField = keyof IncomeTaxInput;
export type IncomeTaxErrors = Partial<Record<IncomeTaxField, string>>;

export type BracketLine = {
  rate: number;
  from: number;
  /** Null for the top bracket. */
  to: number | null;
  /** Taxable income that falls in this bracket. */
  amount: number;
  tax: number;
};

export type IncomeTaxResult = {
  year: number;
  adjustedGrossIncome: number;
  deduction: number;
  deductionKind: "standard" | "itemized";
  taxableIncome: number;
  taxBeforeCredits: number;
  creditsApplied: number;
  totalTax: number;
  /** Total tax as a share of gross income, in percent. */
  effectiveRatePct: number;
  /** Rate on the next dollar of taxable income, in percent. */
  marginalRatePct: number;
  /** Positive = refund, negative = amount owed. */
  refundOrOwed: number;
  breakdown: BracketLine[];
};

export type IncomeTaxOutcome =
  { ok: true; result: IncomeTaxResult } | { ok: false; errors: IncomeTaxErrors };

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  hoh: "Head of household",
  mfs: "Married filing separately",
};

export function maxAgeBlindCount(status: FilingStatus): number {
  return status === "mfj" ? 4 : 2;
}

export function validateIncomeTax(input: IncomeTaxInput): IncomeTaxErrors {
  const errors: IncomeTaxErrors = {};
  const ok = Number.isFinite;
  if (!ok(input.grossIncome) || input.grossIncome < 0)
    errors.grossIncome = "Income cannot be negative.";
  if (!ok(input.adjustments) || input.adjustments < 0) {
    errors.adjustments = "Adjustments cannot be negative.";
  } else if (ok(input.grossIncome) && input.adjustments > input.grossIncome) {
    errors.adjustments = "Adjustments cannot be more than your income.";
  }
  if (
    input.deductionType === "itemized" &&
    (!ok(input.itemizedDeductions) || input.itemizedDeductions < 0)
  ) {
    errors.itemizedDeductions = "Enter your itemized deductions (0 or more).";
  }
  if (!ok(input.credits) || input.credits < 0) errors.credits = "Credits cannot be negative.";
  if (!ok(input.withheld) || input.withheld < 0)
    errors.withheld = "Withholding cannot be negative.";
  if (
    !Number.isInteger(input.age65OrBlindCount) ||
    input.age65OrBlindCount < 0 ||
    input.age65OrBlindCount > maxAgeBlindCount(input.status)
  ) {
    errors.age65OrBlindCount = `Choose 0 to ${maxAgeBlindCount(input.status)}.`;
  }
  return errors;
}

/** Progressive tax on `taxableIncome`, with the line-by-line breakdown. */
export function applyBrackets(taxableIncome: number, brackets: readonly Bracket[]): BracketLine[] {
  const lines: BracketLine[] = [];
  brackets.forEach((b, i) => {
    const next = brackets[i + 1];
    const to = next ? next.over : null;
    const top = to === null ? taxableIncome : Math.min(taxableIncome, to);
    const amount = Math.max(0, top - b.over);
    lines.push({ rate: b.rate, from: b.over, to, amount, tax: (amount * b.rate) / 100 });
  });
  return lines;
}

/** The bracket rate that applies to the next dollar of `taxableIncome`. */
export function marginalRate(taxableIncome: number, brackets: readonly Bracket[]): number {
  let rate = brackets[0]?.rate ?? 0;
  for (const b of brackets) {
    if (taxableIncome > b.over) rate = b.rate;
  }
  return rate;
}

/**
 * The estimate for input that has ALREADY passed `validateIncomeTax`. Other calculators that build their
 * input from validated numbers call this directly; everything else should use `calculateIncomeTax`.
 */
export function computeIncomeTax(
  input: IncomeTaxInput,
  data: TaxYearData = CURRENT_TAX_YEAR,
): IncomeTaxResult {
  const agi = input.grossIncome - input.adjustments;
  const extraPerPerson =
    input.status === "single" || input.status === "hoh"
      ? data.additionalDeduction.unmarried
      : data.additionalDeduction.married;
  const standard = data.standardDeduction[input.status] + input.age65OrBlindCount * extraPerPerson;
  const useItemized = input.deductionType === "itemized";
  const deduction = useItemized ? input.itemizedDeductions : standard;

  const taxableIncome = Math.max(0, agi - deduction);
  const brackets = data.brackets[input.status];
  const breakdown = applyBrackets(taxableIncome, brackets);
  const taxBeforeCredits = breakdown.reduce((s, l) => s + l.tax, 0);
  const creditsApplied = Math.min(input.credits, taxBeforeCredits);
  const totalTax = taxBeforeCredits - creditsApplied;

  return {
    year: data.year,
    adjustedGrossIncome: agi,
    deduction,
    deductionKind: useItemized ? "itemized" : "standard",
    taxableIncome,
    taxBeforeCredits,
    creditsApplied,
    totalTax,
    effectiveRatePct: input.grossIncome > 0 ? (totalTax / input.grossIncome) * 100 : 0,
    marginalRatePct: marginalRate(taxableIncome, brackets),
    refundOrOwed: input.withheld - totalTax,
    breakdown,
  };
}

export function calculateIncomeTax(
  input: IncomeTaxInput,
  data: TaxYearData = CURRENT_TAX_YEAR,
): IncomeTaxOutcome {
  const errors = validateIncomeTax(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, result: computeIncomeTax(input, data) };
}
