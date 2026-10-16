import { describe, expect, it } from "vitest";
import { calculateLoan, termInMonths, validateLoan, type LoanInput } from "../loan";

// Reference: $25,000 @ 6.9% over 60 months -> $493.85/month (standard EMI formula, derived independently).

const base: LoanInput = {
  amount: 25_000,
  annualRatePct: 6.9,
  term: 5,
  termUnit: "years",
  extraMonthly: 0,
};

function run(overrides: Partial<LoanInput> = {}) {
  const out = calculateLoan({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("calculateLoan", () => {
  it("matches the reference EMI for $25k @ 6.9% / 60 months", () => {
    const r = run();
    expect(r.monthlyPayment).toBeCloseTo(493.85, 2);
    expect(r.months).toBe(60);
    expect(r.totalInterest).toBeCloseTo(493.8513092430088 * 60 - 25_000, 4);
  });

  it("amortizes to exactly zero; principal and payments reconcile", () => {
    const r = run();
    expect(r.schedule[r.schedule.length - 1]!.balance).toBe(0);
    expect(r.schedule.reduce((s, row) => s + row.principal, 0)).toBeCloseTo(25_000, 6);
    expect(r.schedule.reduce((s, row) => s + row.payment, 0)).toBeCloseTo(r.totalPaid, 6);
  });

  it("gives the same loan whether the term is entered in years or months", () => {
    expect(run({ term: 60, termUnit: "months" }).monthlyPayment).toBeCloseTo(
      run().monthlyPayment,
      10,
    );
  });

  it("handles 0% interest", () => {
    const r = run({ annualRatePct: 0, amount: 12_000, term: 12, termUnit: "months" });
    expect(r.monthlyPayment).toBe(1000);
    expect(r.totalInterest).toBe(0);
  });

  it("handles a 1-month loan and a 50-year loan", () => {
    expect(run({ term: 1, termUnit: "months" }).months).toBe(1);
    expect(run({ term: 50 }).months).toBe(600);
  });

  it("handles a very large loan", () => {
    const r = run({ amount: 5_000_000_000 });
    expect(r.schedule[r.schedule.length - 1]!.balance).toBe(0);
  });

  it("reports savings from extra payments", () => {
    const r = run({ extraMonthly: 100 });
    expect(r.months).toBeLessThan(60);
    expect(r.monthsSaved).toBe(60 - r.months);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.interestSaved).toBeCloseTo(r.baseline.totalInterest - r.totalInterest, 8);
  });

  it("reports no savings without extra payments", () => {
    const r = run();
    expect(r.monthsSaved).toBe(0);
    expect(r.interestSaved).toBeCloseTo(0, 8);
  });

  it("a higher rate never lowers the payment", () => {
    let prev = 0;
    for (const rate of [0, 1, 3, 5, 9, 15, 25]) {
      const m = run({ annualRatePct: rate }).monthlyPayment;
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});

describe("validateLoan", () => {
  it("accepts valid input", () => {
    expect(validateLoan(base)).toEqual({});
  });
  it.each([
    ["amount", { amount: 0 }],
    ["amount", { amount: Number.NaN }],
    ["annualRatePct", { annualRatePct: -1 }],
    ["annualRatePct", { annualRatePct: 80 }],
    ["term", { term: 0 }],
    ["term", { term: 51 }],
    ["term", { term: 601, termUnit: "months" as const }],
    ["extraMonthly", { extraMonthly: -5 }],
  ])("flags %s", (field, override) => {
    const errors = validateLoan({ ...base, ...override });
    expect(errors[field as keyof LoanInput]).toBeDefined();
  });
  it("returns errors instead of a result", () => {
    expect(calculateLoan({ ...base, amount: -1 }).ok).toBe(false);
  });
});

describe("termInMonths", () => {
  it("converts units", () => {
    expect(termInMonths(2.5, "years")).toBe(30);
    expect(termInMonths(18, "months")).toBe(18);
  });
});
