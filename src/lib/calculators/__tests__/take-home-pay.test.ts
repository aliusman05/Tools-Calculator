import { describe, expect, it } from "vitest";
import { payrollUs2026 } from "@/lib/data/payroll-us-2026";
import {
  calculateTakeHome,
  PERIODS_PER_YEAR,
  retirementLimitFor,
  validateTakeHome,
  type TakeHomeInput,
  type TakeHomeResult,
} from "../take-home-pay";

/*
 * Reference values were derived independently of the engine, by hand and with a separate arithmetic
 * script (no engine code). Income tax uses the tax-at-the-start-of-each-bracket amounts published in
 * IRS Rev. Proc. 2025-32: tax = base tax + rate * (taxable income - bracket start). For a single filer
 * the 2026 amounts are 1,240 at 12,400; 5,800 at 50,400; 17,966 at 105,700; 41,024 at 201,775, and the
 * standard deduction is 16,100. Payroll tax uses 6.2% up to 184,500, 1.45% of everything and 0.9% above
 * the Additional Medicare threshold.
 *
 * S1  single, $75,000, biweekly, 5% 401(k), $150 benefits per paycheck:
 *       benefits 3,900; pay for payroll tax 71,100; 401(k) 3,750; taxable 71,100 - 3,750 - 16,100 = 51,250;
 *       income tax 5,800 + 22% * 850 = 5,987; Social Security 6.2% * 71,100 = 4,408.20;
 *       Medicare 1.45% * 71,100 = 1,030.95; take-home 75,000 - 3,900 - 3,750 - 5,987 - 4,408.20 - 1,030.95
 *       = 55,923.85 a year = 2,150.917... per paycheck.
 * S2  single, $250,000, monthly, 10% 401(k) wanted but capped at 24,500:
 *       taxable 250,000 - 24,500 - 16,100 = 209,400; income tax 41,024 + 32% * 7,625 = 43,464;
 *       Social Security 6.2% * 184,500 = 11,439; Medicare 3,625; Additional Medicare 0.9% * 50,000 = 450;
 *       take-home 166,522 a year. Social Security stops in paycheck ceil(184,500 / 20,833.33) = 9.
 * S3  married filing jointly, $320,000, twice a month:
 *       taxable 320,000 - 32,200 = 287,800; income tax 35,932 + 24% * 76,400 = 54,268;
 *       Additional Medicare 0.9% * (320,000 - 250,000) = 630; take-home 249,023.
 * S4  single, $40,000, weekly, nothing deducted: income tax 1,240 + 12% * 11,500 = 2,620; take-home 34,320
 *       = 660 a week.
 */

const base: TakeHomeInput = {
  annualGross: 75_000,
  frequency: "biweekly",
  status: "single",
  retirementPct: 5,
  ageGroup: "under50",
  preTaxBenefitsPerPaycheck: 150,
  afterTaxDeductionsPerPaycheck: 0,
};

function run(overrides: Partial<TakeHomeInput> = {}): TakeHomeResult {
  const out = calculateTakeHome({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("S1: typical salary under the Social Security cap", () => {
  const r = run();

  it("matches the hand-derived taxes and take-home pay", () => {
    expect(r.preTaxBenefits.annual).toBe(3_900);
    expect(r.payrollTaxWages).toBe(71_100);
    expect(r.retirement.annual).toBe(3_750);
    expect(r.federalIncomeTax.annual).toBeCloseTo(5_987, 9);
    expect(r.socialSecurity.annual).toBeCloseTo(4_408.2, 9);
    expect(r.medicare.annual).toBeCloseTo(1_030.95, 9);
    expect(r.additionalMedicare.annual).toBe(0);
    expect(r.takeHome.annual).toBeCloseTo(55_923.85, 9);
    expect(r.takeHome.perPaycheck).toBeCloseTo(2_150.917307692308, 9);
  });

  it("splits a year into 26 paychecks and keeps every line consistent", () => {
    expect(r.periods).toBe(26);
    expect(r.gross.perPaycheck).toBeCloseTo(75_000 / 26, 9);
    expect(r.totalTaxes.annual).toBeCloseTo(11_426.15, 9);
    const sum =
      r.takeHome.annual +
      r.totalTaxes.annual +
      r.preTaxBenefits.annual +
      r.retirement.annual +
      r.afterTaxDeductions.annual;
    expect(sum).toBeCloseTo(r.gross.annual, 9);
    expect(r.takeHomePct + r.totalTaxRatePct + ((3_900 + 3_750) / 75_000) * 100).toBeCloseTo(
      100,
      9,
    );
  });

  it("reports the marginal federal rate and no Social Security stop", () => {
    expect(r.marginalIncomeTaxRatePct).toBe(22);
    expect(r.socialSecurityStopsAtPaycheck).toBeNull();
    expect(r.retirementCapped).toBe(false);
  });
});

describe("S2: above the Social Security cap, with a capped 401(k)", () => {
  const r = run({
    annualGross: 250_000,
    frequency: "monthly",
    retirementPct: 10,
    preTaxBenefitsPerPaycheck: 0,
  });

  it("caps the 401(k) at the limit and says so", () => {
    expect(r.retirement.annual).toBe(24_500);
    expect(r.retirementCapped).toBe(true);
    expect(r.retirementLimit).toBe(24_500);
  });

  it("caps Social Security at the wage base and adds Additional Medicare", () => {
    expect(r.socialSecurity.annual).toBeCloseTo(11_439, 9);
    expect(r.medicare.annual).toBeCloseTo(3_625, 9);
    expect(r.additionalMedicare.annual).toBeCloseTo(450, 9);
  });

  it("matches the hand-derived income tax and take-home pay", () => {
    expect(r.federalIncomeTax.annual).toBeCloseTo(43_464, 9);
    expect(r.takeHome.annual).toBeCloseTo(166_522, 9);
    expect(r.takeHome.perPaycheck).toBeCloseTo(13_876.833333333334, 9);
    expect(r.marginalIncomeTaxRatePct).toBe(32);
  });

  it("tells which paycheck stops Social Security tax", () => {
    expect(r.socialSecurityStopsAtPaycheck).toBe(9);
  });

  it("separates the average paycheck from the early and later ones", () => {
    // Monthly pay 20,833.33; a full month of Social Security tax is 1,291.67 and the year's total is
    // 11,439, so the average month carries 953.25 of it. Early: 13,876.83 + 953.25 - 1,291.67 =
    // 13,538.42. Later: 13,876.83 + 953.25 = 14,830.08. Paycheck 9 pays the rest of the 11,439
    // (11,439 - 8 * 1,291.67 = 1,105.67), so it is 13,724.42. Eight early + paycheck 9 + three later
    // must add up to the year's take-home pay.
    expect(r.earlyPaycheckTakeHome).toBeCloseTo(13_538.416666666667, 8);
    expect(r.latePaycheckTakeHome).toBeCloseTo(14_830.083333333334, 8);
    const ninth = 13_876.833333333334 + 953.25 - (11_439 - 8 * (250_000 / 12) * 0.062);
    expect(ninth).toBeCloseTo(13_724.416666666667, 8);
    expect(8 * r.earlyPaycheckTakeHome! + ninth + 3 * r.latePaycheckTakeHome!).toBeCloseTo(
      166_522,
      6,
    );
    expect(r.latePaycheckTakeHome!).toBeGreaterThan(r.takeHome.perPaycheck);
    expect(r.earlyPaycheckTakeHome!).toBeLessThan(r.takeHome.perPaycheck);
  });

  it("without a Social Security stop every paycheck is the average", () => {
    const plain = run();
    expect(plain.earlyPaycheckTakeHome).toBeCloseTo(plain.takeHome.perPaycheck, 12);
    expect(plain.latePaycheckTakeHome).toBeNull();
  });

  it("when the cap is reached in the last paycheck there is no later paycheck", () => {
    // 190,000 paid monthly: 184,500 / 15,833.33 = 11.65, so it stops in paycheck 12 (the last).
    const r12 = run({
      annualGross: 190_000,
      frequency: "monthly",
      retirementPct: 0,
      preTaxBenefitsPerPaycheck: 0,
    });
    expect(r12.socialSecurityStopsAtPaycheck).toBe(12);
    expect(r12.latePaycheckTakeHome).toBeNull();
    expect(r12.earlyPaycheckTakeHome).not.toBeNull();
  });

  it("when one paycheck alone passes the cap there is no earlier paycheck", () => {
    const one = run({
      annualGross: 5_000_000_000,
      frequency: "monthly",
      retirementPct: 0,
      preTaxBenefitsPerPaycheck: 0,
    });
    expect(one.socialSecurityStopsAtPaycheck).toBe(1);
    expect(one.earlyPaycheckTakeHome).toBeNull();
    expect(one.latePaycheckTakeHome).not.toBeNull();
  });
});

describe("S3: married filing jointly, high earner", () => {
  const r = run({
    annualGross: 320_000,
    frequency: "semimonthly",
    status: "mfj",
    retirementPct: 0,
    preTaxBenefitsPerPaycheck: 0,
  });

  it("uses the joint standard deduction, brackets and Additional Medicare threshold", () => {
    expect(r.federalIncomeTax.annual).toBeCloseTo(54_268, 9);
    expect(r.additionalMedicare.annual).toBeCloseTo(630, 9);
    expect(r.socialSecurity.annual).toBeCloseTo(11_439, 9);
    expect(r.medicare.annual).toBeCloseTo(4_640, 9);
    expect(r.takeHome.annual).toBeCloseTo(249_023, 9);
    expect(r.takeHome.perPaycheck).toBeCloseTo(10_375.958333333334, 9);
    expect(r.socialSecurityStopsAtPaycheck).toBe(14);
  });
});

describe("S4 and other cases", () => {
  it("S4: a lower earner with nothing deducted", () => {
    const r = run({
      annualGross: 40_000,
      frequency: "weekly",
      retirementPct: 0,
      preTaxBenefitsPerPaycheck: 0,
    });
    expect(r.federalIncomeTax.annual).toBeCloseTo(2_620, 9);
    expect(r.socialSecurity.annual).toBeCloseTo(2_480, 9);
    expect(r.medicare.annual).toBeCloseTo(580, 9);
    expect(r.takeHome.annual).toBeCloseTo(34_320, 9);
    expect(r.takeHome.perPaycheck).toBeCloseTo(660, 9);
  });

  it("pre-tax benefits reduce payroll tax as well as income tax ($200 a month on $60,000)", () => {
    const r = run({
      annualGross: 60_000,
      frequency: "monthly",
      retirementPct: 0,
      preTaxBenefitsPerPaycheck: 200,
    });
    expect(r.socialSecurity.annual).toBeCloseTo(3_571.2, 9);
    expect(r.medicare.annual).toBeCloseTo(835.2, 9);
    expect(r.federalIncomeTax.annual).toBeCloseTo(4_732, 9);
    expect(r.takeHome.annual).toBeCloseTo(48_461.6, 9);
  });

  it("a traditional 401(k) lowers income tax but not payroll tax", () => {
    const without = run({ retirementPct: 0 });
    const withK = run({ retirementPct: 10 });
    expect(withK.federalIncomeTax.annual).toBeLessThan(without.federalIncomeTax.annual);
    expect(withK.socialSecurity.annual).toBe(without.socialSecurity.annual);
    expect(withK.medicare.annual).toBe(without.medicare.annual);
  });

  it("married filing separately uses the $125,000 Additional Medicare threshold", () => {
    const r = run({
      annualGross: 275_000,
      frequency: "monthly",
      status: "mfs",
      retirementPct: 0,
      preTaxBenefitsPerPaycheck: 0,
    });
    expect(r.additionalMedicare.annual).toBeCloseTo(1_350, 9);
    expect(r.federalIncomeTax.annual).toBeCloseTo(59_384.25, 9);
    expect(r.takeHome.annual).toBeCloseTo(198_839.25, 9);
  });

  it("catch-up contributions raise the 401(k) limit for ages 50+ and 60 to 63", () => {
    expect(retirementLimitFor("under50")).toBe(24_500);
    expect(retirementLimitFor("50plus")).toBe(32_500);
    expect(retirementLimitFor("60to63")).toBe(35_750);
    const r = run({
      annualGross: 100_000,
      retirementPct: 100,
      ageGroup: "60to63",
      preTaxBenefitsPerPaycheck: 0,
    });
    expect(r.retirement.annual).toBe(35_750);
    expect(r.federalIncomeTax.annual).toBeCloseTo(5_530, 9);
    expect(r.takeHome.annual).toBeCloseTo(51_070, 9);
  });

  it("after-tax deductions reduce take-home pay only ($100 a paycheck on $90,000)", () => {
    const r = run({
      annualGross: 90_000,
      retirementPct: 0,
      preTaxBenefitsPerPaycheck: 0,
      afterTaxDeductionsPerPaycheck: 100,
    });
    expect(r.afterTaxDeductions.annual).toBe(2_600);
    expect(r.federalIncomeTax.annual).toBeCloseTo(10_970, 9);
    expect(r.takeHome.annual).toBeCloseTo(69_545, 9);
  });

  it("pay exactly at the Social Security wage base still pays the full 6.2% and never 'stops'", () => {
    const r = run({
      annualGross: 184_500,
      frequency: "monthly",
      retirementPct: 0,
      preTaxBenefitsPerPaycheck: 0,
    });
    expect(r.socialSecurity.annual).toBeCloseTo(11_439, 9);
    expect(r.socialSecurityStopsAtPaycheck).toBeNull();
    expect(r.federalIncomeTax.annual).toBeCloseTo(33_014, 9);
  });

  it("a very low income pays payroll tax but no income tax", () => {
    const r = run({
      annualGross: 10_000,
      retirementPct: 0,
      preTaxBenefitsPerPaycheck: 0,
    });
    expect(r.federalIncomeTax.annual).toBe(0);
    expect(r.socialSecurity.annual).toBeCloseTo(620, 9);
    expect(r.medicare.annual).toBeCloseTo(145, 9);
    expect(r.marginalIncomeTaxRatePct).toBe(10);
  });

  it("every pay frequency gives the same year, divided differently", () => {
    const annual = run({ frequency: "weekly", preTaxBenefitsPerPaycheck: 0 }).takeHome.annual;
    for (const frequency of Object.keys(PERIODS_PER_YEAR) as (keyof typeof PERIODS_PER_YEAR)[]) {
      const r = run({ frequency, preTaxBenefitsPerPaycheck: 0 });
      expect(r.takeHome.annual).toBeCloseTo(annual, 9);
      expect(r.takeHome.perPaycheck * PERIODS_PER_YEAR[frequency]).toBeCloseTo(annual, 9);
    }
  });

  it("handles a very large salary", () => {
    const r = run({ annualGross: 5_000_000_000, retirementPct: 1, preTaxBenefitsPerPaycheck: 0 });
    expect(Number.isFinite(r.takeHome.annual)).toBe(true);
    expect(r.socialSecurity.annual).toBeCloseTo(11_439, 6);
  });

  it("uses the figures in the dated data file", () => {
    expect(payrollUs2026.year).toBe(2026);
    expect(payrollUs2026.socialSecurity.wageBase).toBe(184_500);
    expect(payrollUs2026.medicare.additional.threshold).toEqual({
      single: 200_000,
      hoh: 200_000,
      mfj: 250_000,
      mfs: 125_000,
    });
    expect(payrollUs2026.retirement401k).toEqual({
      deferralLimit: 24_500,
      catchUp50: 8_000,
      catchUp60to63: 11_250,
    });
    expect(payrollUs2026.sources.length).toBeGreaterThanOrEqual(4);
    expect(payrollUs2026.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("validation", () => {
  it("accepts the defaults", () => {
    expect(validateTakeHome(base)).toEqual({});
  });

  it("rejects bad pay, percent, benefits and deductions", () => {
    const errors = validateTakeHome({
      ...base,
      annualGross: 0,
      retirementPct: 101,
      preTaxBenefitsPerPaycheck: -1,
      afterTaxDeductionsPerPaycheck: -1,
    });
    expect(Object.keys(errors).sort()).toEqual(
      [
        "afterTaxDeductionsPerPaycheck",
        "annualGross",
        "preTaxBenefitsPerPaycheck",
        "retirementPct",
      ].sort(),
    );
  });

  it("rejects benefits that are more than the pay", () => {
    const errors = validateTakeHome({
      ...base,
      annualGross: 1_000,
      preTaxBenefitsPerPaycheck: 100,
    });
    expect(errors.preTaxBenefitsPerPaycheck).toBeDefined();
  });

  it("rejects a pay frequency, filing status or age group that is not on the list", () => {
    const errors = validateTakeHome({
      ...base,
      frequency: "daily" as unknown as TakeHomeInput["frequency"],
      status: "widowed" as unknown as TakeHomeInput["status"],
      ageGroup: "70plus" as unknown as TakeHomeInput["ageGroup"],
    });
    expect(Object.keys(errors).sort()).toEqual(["ageGroup", "frequency", "status"]);
  });

  it("rejects deductions that leave nothing, and NaN", () => {
    expect(
      calculateTakeHome({ ...base, annualGross: 20_000, afterTaxDeductionsPerPaycheck: 2_000 }).ok,
    ).toBe(false);
    expect(calculateTakeHome({ ...base, annualGross: Number.NaN }).ok).toBe(false);
  });
});
