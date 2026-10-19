import { payrollUs2026, type PayrollYearData } from "@/lib/data/payroll-us-2026";
import { computeIncomeTax, type FilingStatus } from "./income-tax";

/**
 * US take-home pay ESTIMATE for one job paid a salary. Pure math: no React, no DOM.
 *
 * It estimates the year's tax and spreads it evenly over the paychecks, which is how a paycheck
 * would look if withholding matched the tax owed. Real paychecks follow the employer's withholding
 * (from the Form W-4) and can differ.
 *
 *   Social Security tax  = 6.2% of pay after pre-tax benefits, up to the yearly wage base
 *   Medicare tax         = 1.45% of pay after pre-tax benefits
 *   Additional Medicare  = 0.9% of that pay above $200,000 ($250,000 married filing jointly,
 *                          $125,000 married filing separately)
 *   Federal income tax   = the income tax estimator applied to pay after pre-tax benefits, with the
 *                          traditional 401(k) as an adjustment and the standard deduction
 *
 * Pre-tax benefits (health insurance, HSA and FSA through payroll) reduce income tax AND payroll tax.
 * A traditional 401(k) reduces income tax only. After-tax deductions reduce take-home pay only.
 *
 * Not modelled: state and local taxes, tax credits, itemized deductions, other income, a second job,
 * the 65+ or blind deduction, and the Roth treatment some plans require for catch-up contributions.
 */

export const CURRENT_PAYROLL_YEAR: PayrollYearData = payrollUs2026;

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
};

/** Which 401(k) catch-up applies: none, the age 50 amount, or the ages 60 to 63 amount. */
export type AgeGroup = "under50" | "50plus" | "60to63";

export type TakeHomeInput = {
  /** Gross salary for the year, before anything is taken out. */
  annualGross: number;
  frequency: PayFrequency;
  status: FilingStatus;
  /** Traditional (pre-tax) 401(k) contribution as a percent of gross pay. */
  retirementPct: number;
  ageGroup: AgeGroup;
  /** Health insurance, HSA, FSA and similar, taken from each paycheck before tax. */
  preTaxBenefitsPerPaycheck: number;
  /** Roth 401(k), union dues and similar, taken from each paycheck after tax. */
  afterTaxDeductionsPerPaycheck: number;
};

export type TakeHomeField = keyof TakeHomeInput;
export type TakeHomeErrors = Partial<Record<TakeHomeField, string>>;

export type Amount = { annual: number; perPaycheck: number };

export type TakeHomeResult = {
  year: number;
  periods: number;
  gross: Amount;
  preTaxBenefits: Amount;
  retirement: Amount;
  federalIncomeTax: Amount;
  socialSecurity: Amount;
  medicare: Amount;
  additionalMedicare: Amount;
  afterTaxDeductions: Amount;
  takeHome: Amount;
  /** Income tax + Social Security + Medicare + Additional Medicare. */
  totalTaxes: Amount;
  /** Taxes as a share of gross pay, in percent. */
  totalTaxRatePct: number;
  /** Take-home pay as a share of gross pay, in percent. */
  takeHomePct: number;
  /** Federal income tax rate on the next dollar of taxable income, in percent. */
  marginalIncomeTaxRatePct: number;
  /** Pay that Social Security and Medicare tax apply to (gross less pre-tax benefits). */
  payrollTaxWages: number;
  /** The yearly 401(k) limit that applies to this person. */
  retirementLimit: number;
  /** True when the percent entered would exceed the limit and was reduced to it. */
  retirementCapped: boolean;
  /** The paycheck in which Social Security tax stops for the year, or null if it never reaches the cap. */
  socialSecurityStopsAtPaycheck: number | null;
  /**
   * Take-home pay in a paycheck before Social Security tax stops. Equal to the average when it never
   * stops. null when it stops in the very first paycheck, so there is no earlier one.
   */
  earlyPaycheckTakeHome: number | null;
  /**
   * Take-home pay in the paychecks after Social Security tax has stopped. null when it never stops or
   * stops in the last paycheck. (The paycheck in which it stops falls in between.)
   */
  latePaycheckTakeHome: number | null;
};

export type TakeHomeOutcome =
  { ok: true; result: TakeHomeResult } | { ok: false; errors: TakeHomeErrors };

const FILING_STATUSES: readonly FilingStatus[] = ["single", "mfj", "hoh", "mfs"];
const FREQUENCIES = Object.keys(PERIODS_PER_YEAR) as PayFrequency[];

export function retirementLimitFor(ageGroup: AgeGroup, data = CURRENT_PAYROLL_YEAR): number {
  const k = data.retirement401k;
  if (ageGroup === "60to63") return k.deferralLimit + k.catchUp60to63;
  if (ageGroup === "50plus") return k.deferralLimit + k.catchUp50;
  return k.deferralLimit;
}

export function validateTakeHome(input: TakeHomeInput): TakeHomeErrors {
  const e: TakeHomeErrors = {};
  const ok = Number.isFinite;
  if (!ok(input.annualGross) || input.annualGross <= 0)
    e.annualGross = "Enter a yearly pay above 0.";
  if (!FREQUENCIES.includes(input.frequency)) e.frequency = "Choose how often you are paid.";
  if (!FILING_STATUSES.includes(input.status)) e.status = "Choose a filing status.";
  if (!ok(input.retirementPct) || input.retirementPct < 0 || input.retirementPct > 100) {
    e.retirementPct = "Enter a percent from 0 to 100.";
  }
  if (!["under50", "50plus", "60to63"].includes(input.ageGroup))
    e.ageGroup = "Choose an age group.";
  if (!ok(input.preTaxBenefitsPerPaycheck) || input.preTaxBenefitsPerPaycheck < 0) {
    e.preTaxBenefitsPerPaycheck = "Benefits cannot be negative.";
  } else if (
    ok(input.annualGross) &&
    FREQUENCIES.includes(input.frequency) &&
    input.preTaxBenefitsPerPaycheck * PERIODS_PER_YEAR[input.frequency] > input.annualGross
  ) {
    e.preTaxBenefitsPerPaycheck = "Benefits cannot be more than your pay.";
  }
  if (!ok(input.afterTaxDeductionsPerPaycheck) || input.afterTaxDeductionsPerPaycheck < 0) {
    e.afterTaxDeductionsPerPaycheck = "Deductions cannot be negative.";
  }
  return e;
}

export function calculateTakeHome(
  input: TakeHomeInput,
  data: PayrollYearData = CURRENT_PAYROLL_YEAR,
): TakeHomeOutcome {
  const errors = validateTakeHome(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const periods = PERIODS_PER_YEAR[input.frequency];
  const annualBenefits = input.preTaxBenefitsPerPaycheck * periods;
  const annualAfterTax = input.afterTaxDeductionsPerPaycheck * periods;

  // Pay that payroll taxes and income tax start from.
  const payrollTaxWages = input.annualGross - annualBenefits;

  const retirementLimit = retirementLimitFor(input.ageGroup, data);
  const wanted = (input.annualGross * input.retirementPct) / 100;
  const annualRetirement = Math.min(wanted, retirementLimit, payrollTaxWages);
  const retirementCapped = wanted > Math.min(retirementLimit, payrollTaxWages);

  // Every amount below was validated above, and the adjustments never exceed the income.
  const incomeTaxResult = computeIncomeTax({
    status: input.status,
    grossIncome: payrollTaxWages,
    adjustments: annualRetirement,
    deductionType: "standard",
    itemizedDeductions: 0,
    age65OrBlindCount: 0,
    credits: 0,
    withheld: 0,
  });

  const { socialSecurity, medicare } = data;
  const annualSocialSecurity =
    (Math.min(payrollTaxWages, socialSecurity.wageBase) * socialSecurity.employeeRatePct) / 100;
  const annualMedicare = (payrollTaxWages * medicare.employeeRatePct) / 100;
  const annualAdditional =
    (Math.max(0, payrollTaxWages - medicare.additional.threshold[input.status]) *
      medicare.additional.ratePct) /
    100;

  const annualIncomeTax = incomeTaxResult.totalTax;
  const annualTaxes = annualIncomeTax + annualSocialSecurity + annualMedicare + annualAdditional;
  const annualTakeHome =
    input.annualGross - annualBenefits - annualRetirement - annualTaxes - annualAfterTax;

  if (annualTakeHome < 0) {
    return {
      ok: false,
      errors: {
        afterTaxDeductionsPerPaycheck: "Deductions and taxes add up to more than your pay.",
      },
    };
  }

  const amount = (annual: number): Amount => ({ annual, perPaycheck: annual / periods });
  const wagesPerPaycheck = payrollTaxWages / periods;

  // Everything except Social Security is spread evenly, so paychecks only differ by that tax: a full
  // 6.2% before the cap is reached, none after it, and a part in the paycheck that reaches it.
  const stopsAt =
    payrollTaxWages > socialSecurity.wageBase && wagesPerPaycheck > 0
      ? Math.ceil(socialSecurity.wageBase / wagesPerPaycheck)
      : null;
  const averageTakeHome = annualTakeHome / periods;
  const averageSocialSecurity = annualSocialSecurity / periods;
  const fullSocialSecurity = (wagesPerPaycheck * socialSecurity.employeeRatePct) / 100;

  return {
    ok: true,
    result: {
      year: data.year,
      periods,
      gross: amount(input.annualGross),
      preTaxBenefits: amount(annualBenefits),
      retirement: amount(annualRetirement),
      federalIncomeTax: amount(annualIncomeTax),
      socialSecurity: amount(annualSocialSecurity),
      medicare: amount(annualMedicare),
      additionalMedicare: amount(annualAdditional),
      afterTaxDeductions: amount(annualAfterTax),
      takeHome: amount(annualTakeHome),
      totalTaxes: amount(annualTaxes),
      totalTaxRatePct: (annualTaxes / input.annualGross) * 100,
      takeHomePct: (annualTakeHome / input.annualGross) * 100,
      marginalIncomeTaxRatePct: incomeTaxResult.marginalRatePct,
      payrollTaxWages,
      retirementLimit,
      retirementCapped,
      socialSecurityStopsAtPaycheck: stopsAt,
      earlyPaycheckTakeHome:
        stopsAt === null
          ? averageTakeHome
          : stopsAt > 1
            ? averageTakeHome + averageSocialSecurity - fullSocialSecurity
            : null,
      latePaycheckTakeHome:
        stopsAt !== null && stopsAt < periods ? averageTakeHome + averageSocialSecurity : null,
    },
  };
}
