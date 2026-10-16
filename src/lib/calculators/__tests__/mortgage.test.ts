import { describe, expect, it } from "vitest";
import {
  calculateMortgage,
  downPaymentFromPercent,
  paymentDate,
  validateMortgage,
  type MortgageInput,
  type MortgageResult,
} from "../mortgage";

const base: MortgageInput = {
  homePrice: 400_000,
  downPayment: 80_000,
  annualRatePct: 6,
  termYears: 30,
  propertyTaxPct: 0,
  insuranceAnnual: 0,
  hoaMonthly: 0,
  pmiRatePct: 0,
  extraMonthly: 0,
  extraYearly: 0,
  oneTimeExtra: 0,
  oneTimeMonth: 1,
};

function run(overrides: Partial<MortgageInput> = {}): MortgageResult {
  const out = calculateMortgage({ ...base, ...overrides });
  if (!out.ok) throw new Error(`unexpected validation errors: ${JSON.stringify(out.errors)}`);
  return out.result;
}

describe("calculateMortgage", () => {
  it("computes P&I for a $320k loan @ 6% / 30y (reference: $300k = $1,798.65 scales linearly)", () => {
    const r = run();
    expect(r.loanAmount).toBe(320_000);
    expect(r.monthlyPrincipalInterest).toBeCloseTo((1798.65157545827 * 320) / 300, 6);
    expect(r.monthlyPrincipalInterest).toBeCloseTo(1918.56, 2);
    expect(r.downPaymentPct).toBeCloseTo(20, 8);
  });

  it("amortizes to exactly zero with matching totals", () => {
    const r = run();
    const last = r.schedule[r.schedule.length - 1]!;
    expect(last.balance).toBe(0);
    expect(r.schedule.reduce((s, row) => s + row.principal, 0)).toBeCloseTo(r.loanAmount, 6);
    expect(r.schedule.reduce((s, row) => s + row.payment, 0)).toBeCloseTo(r.totalPaid, 6);
    expect(r.totalPaid).toBeCloseTo(r.loanAmount + r.totalInterest, 6);
    expect(r.months).toBe(360);
  });

  it("adds property tax, insurance and HOA to the monthly total", () => {
    const r = run({ propertyTaxPct: 1.2, insuranceAnnual: 1_800, hoaMonthly: 75 });
    expect(r.monthlyPropertyTax).toBeCloseTo(400, 8); // 400,000 * 1.2% / 12
    expect(r.monthlyInsurance).toBeCloseTo(150, 8);
    expect(r.monthlyHoa).toBe(75);
    expect(r.monthlyTotal).toBeCloseTo(r.monthlyPrincipalInterest + 400 + 150 + 75, 8);
  });

  it("does not charge PMI at 20% down", () => {
    const r = run({ pmiRatePct: 0.5 });
    expect(r.monthlyPmi).toBe(0);
    expect(r.pmiEndsAfterMonth).toBeNull();
  });

  it("charges PMI below 20% down until the balance reaches 80% of the price", () => {
    const r = run({ downPayment: 20_000, pmiRatePct: 0.6 });
    expect(r.monthlyPmi).toBeCloseTo((380_000 * 0.006) / 12, 8); // $190
    const ends = r.pmiEndsAfterMonth!;
    expect(ends).toBeGreaterThan(0);
    expect(ends).toBeLessThan(r.months);
    const limit = 400_000 * 0.8;
    // Charged while the opening balance is above the limit, then dropped.
    expect(r.schedule[ends - 1]!.openingBalance).toBeGreaterThan(limit);
    expect(r.schedule[ends - 1]!.pmi).toBeGreaterThan(0);
    expect(r.schedule[ends]!.openingBalance).toBeLessThanOrEqual(limit);
    expect(r.schedule[ends]!.pmi).toBe(0);
  });

  it("handles 0% interest", () => {
    const r = run({ annualRatePct: 0, termYears: 20 });
    expect(r.monthlyPrincipalInterest).toBeCloseTo(320_000 / 240, 8);
    expect(r.totalInterest).toBe(0);
  });

  it("handles a 1-year term and a 50-year term", () => {
    expect(run({ termYears: 1 }).months).toBe(12);
    expect(run({ termYears: 50 }).months).toBe(600);
  });

  it("reports interest and time saved with extra payments", () => {
    const r = run({ homePrice: 250_000, downPayment: 50_000, annualRatePct: 5, extraMonthly: 200 });
    expect(r.months).toBe(256);
    expect(r.monthsSaved).toBe(104);
    expect(r.baseline.months).toBe(360);
    expect(r.interestSaved).toBeCloseTo(r.baseline.totalInterest - r.totalInterest, 8);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.schedule[r.schedule.length - 1]!.balance).toBe(0);
  });

  it("combines monthly, yearly and one-time extras and still ends at zero", () => {
    const r = run({
      extraMonthly: 100,
      extraYearly: 1_000,
      oneTimeExtra: 15_000,
      oneTimeMonth: 12,
    });
    expect(r.schedule[r.schedule.length - 1]!.balance).toBe(0);
    expect(r.schedule.reduce((s, row) => s + row.principal, 0)).toBeCloseTo(r.loanAmount, 6);
    expect(r.monthsSaved).toBeGreaterThan(0);
  });

  it("a higher rate never gives a lower payment", () => {
    let prev = 0;
    for (const rate of [0, 2, 4, 6, 8, 10]) {
      const m = run({ annualRatePct: rate }).monthlyPrincipalInterest;
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it("handles large amounts", () => {
    const r = run({ homePrice: 25_000_000, downPayment: 5_000_000 });
    expect(r.schedule[r.schedule.length - 1]!.balance).toBe(0);
  });
});

describe("validation", () => {
  it("flags a missing or non-positive price", () => {
    expect(validateMortgage({ ...base, homePrice: 0 }).homePrice).toBeDefined();
    expect(validateMortgage({ ...base, homePrice: Number.NaN }).homePrice).toBeDefined();
  });

  it("flags a down payment at or above the price", () => {
    expect(validateMortgage({ ...base, downPayment: 400_000 }).downPayment).toBeDefined();
    expect(validateMortgage({ ...base, downPayment: -1 }).downPayment).toBeDefined();
  });

  it("flags out-of-range rate and term", () => {
    expect(validateMortgage({ ...base, annualRatePct: -1 }).annualRatePct).toBeDefined();
    expect(validateMortgage({ ...base, annualRatePct: 51 }).annualRatePct).toBeDefined();
    expect(validateMortgage({ ...base, termYears: 0 }).termYears).toBeDefined();
    expect(validateMortgage({ ...base, termYears: 51 }).termYears).toBeDefined();
  });

  it("flags negative extras and costs", () => {
    const errors = validateMortgage({ ...base, extraMonthly: -1, hoaMonthly: -5, pmiRatePct: -1 });
    expect(errors.extraMonthly).toBeDefined();
    expect(errors.hoaMonthly).toBeDefined();
    expect(errors.pmiRatePct).toBeDefined();
  });

  it("requires a valid payment number for a one-time extra", () => {
    expect(
      validateMortgage({ ...base, oneTimeExtra: 1_000, oneTimeMonth: 0 }).oneTimeMonth,
    ).toBeDefined();
    expect(
      validateMortgage({ ...base, oneTimeExtra: 0, oneTimeMonth: 0 }).oneTimeMonth,
    ).toBeUndefined();
  });

  it("returns errors instead of a result for invalid input", () => {
    const out = calculateMortgage({ ...base, homePrice: -1 });
    expect(out.ok).toBe(false);
  });

  it("accepts valid input with no errors", () => {
    expect(validateMortgage(base)).toEqual({});
  });
});

describe("helpers", () => {
  it("converts a percent down payment to dollars", () => {
    expect(downPaymentFromPercent(400_000, 20)).toBe(80_000);
  });

  it("computes payment dates across year boundaries", () => {
    expect(paymentDate(11, 2026, 1)).toEqual({ month: 11, year: 2026 });
    expect(paymentDate(11, 2026, 3)).toEqual({ month: 1, year: 2027 });
    expect(paymentDate(1, 2026, 360)).toEqual({ month: 12, year: 2055 });
  });
});
