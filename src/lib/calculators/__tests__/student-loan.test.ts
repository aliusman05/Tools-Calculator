import { describe, expect, it } from "vitest";
import {
  calculateStudentLoan,
  validateStudentLoan,
  type StudentLoanInput,
  type StudentLoanResult,
} from "../student-loan";

/*
 * Reference values were derived independently of the engine, with closed-form annuity formulas only
 * (no schedule loop, none of this code). With r = annual rate / 12 and g = 1 + r:
 *
 *   level payment                      M   = P r / (1 - g^-n)
 *   balance after k payments of size Q B_k = P g^k - Q (g^k - 1) / r
 *   months to clear balance B with Q   N   = -ln(1 - B r / Q) / ln(g), rounded up
 *   total paid = Q * (N - 1) + B_(N-1) * g      (the last payment is the remaining balance plus interest)
 *
 * A lump sum L paid in month t reduces the balance after payment t by L, and the loan then continues
 * from that balance with the same monthly payment. Reference loan: $35,000 at 5.5% over 10 years.
 */

const base: StudentLoanInput = {
  balance: 35_000,
  annualRatePct: 5.5,
  term: 10,
  termUnit: "years",
  extraMonthly: 0,
  lumpSum: 0,
  lumpSumMonth: 12,
};

function run(overrides: Partial<StudentLoanInput> = {}): StudentLoanResult {
  const out = calculateStudentLoan({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("standard schedule ($35,000 at 5.5% for 10 years)", () => {
  const r = run();

  it("matches the closed-form payment, total paid and interest", () => {
    expect(r.monthlyPayment).toBeCloseTo(379.84197286167944, 8);
    expect(r.months).toBe(120);
    expect(r.totalPaid).toBeCloseTo(45581.036743401535, 4);
    expect(r.totalInterest).toBeCloseTo(10581.036743401535, 4);
  });

  it("splits the first payment into interest and principal", () => {
    expect(r.schedule[0]!.interest).toBeCloseTo(160.41666666666666, 8);
    expect(r.schedule[0]!.principal).toBeCloseTo(219.42530619501278, 8);
  });

  it("ends at exactly zero and saves nothing against itself", () => {
    expect(r.schedule[r.schedule.length - 1]!.balance).toBe(0);
    expect(r.interestSaved).toBeCloseTo(0, 9);
    expect(r.monthsSaved).toBe(0);
    expect(r.lumpSumApplied).toBe(false);
  });
});

describe("extra payments", () => {
  it("$150 extra every month: 79 payments, $6,785.14 of interest", () => {
    const r = run({ extraMonthly: 150 });
    expect(r.months).toBe(79);
    expect(r.totalInterest).toBeCloseTo(6785.142647013796, 4);
    expect(r.interestSaved).toBeCloseTo(10581.036743401535 - 6785.142647013796, 4);
    expect(r.monthsSaved).toBe(41);
  });

  it("a $5,000 lump sum in month 12: 100 payments, $7,750.27 of interest", () => {
    const r = run({ lumpSum: 5_000, lumpSumMonth: 12 });
    expect(r.months).toBe(100);
    expect(r.totalInterest).toBeCloseTo(7750.274712374216, 4);
    expect(r.monthsSaved).toBe(20);
    expect(r.lumpSumApplied).toBe(true);
    expect(r.schedule[11]!.extra).toBeCloseTo(5_000, 6);
  });

  it("monthly extra and a lump sum together: 67 payments, $5,173.76 of interest", () => {
    const r = run({ extraMonthly: 150, lumpSum: 5_000, lumpSumMonth: 12 });
    expect(r.months).toBe(67);
    expect(r.totalInterest).toBeCloseTo(5173.759310119523, 4);
    expect(r.monthsSaved).toBe(53);
  });

  it("a lump sum bigger than the balance pays the loan off that month", () => {
    const r = run({ lumpSum: 40_000, lumpSumMonth: 6 });
    expect(r.months).toBe(6);
    expect(r.totalInterest).toBeCloseTo(947.3220036132648, 4);
    expect(r.totalPaid).toBeCloseTo(35947.32200361326, 4);
    expect(r.schedule[5]!.balance).toBe(0);
  });

  it("a lump sum after the loan is already paid off changes nothing and is flagged", () => {
    const r = run({ lumpSum: 5_000, lumpSumMonth: 200 });
    expect(r.months).toBe(120);
    expect(r.lumpSumApplied).toBe(false);
    expect(r.interestSaved).toBeCloseTo(0, 9);
  });

  it("ignores the lump sum month when there is no lump sum", () => {
    expect(run({ lumpSum: 0, lumpSumMonth: Number.NaN }).months).toBe(120);
  });

  it("an earlier lump sum saves more than a later one", () => {
    expect(run({ lumpSum: 5_000, lumpSumMonth: 1 }).interestSaved).toBeGreaterThan(
      run({ lumpSum: 5_000, lumpSumMonth: 60 }).interestSaved,
    );
  });
});

describe("edge cases", () => {
  it("0% interest: $12,000 over 24 months with $100 extra takes 20 payments and no interest", () => {
    const r = run({
      balance: 12_000,
      annualRatePct: 0,
      term: 24,
      termUnit: "months",
      extraMonthly: 100,
    });
    expect(r.monthlyPayment).toBe(500);
    expect(r.months).toBe(20);
    expect(r.totalInterest).toBe(0);
  });

  it("terms in months and years give the same loan", () => {
    expect(run({ term: 120, termUnit: "months" }).monthlyPayment).toBeCloseTo(
      run().monthlyPayment,
      10,
    );
  });

  it("principal repaid always adds up to the balance", () => {
    const r = run({ extraMonthly: 75, lumpSum: 3_000, lumpSumMonth: 30 });
    expect(r.schedule.reduce((s, row) => s + row.principal, 0)).toBeCloseTo(35_000, 6);
  });

  it("handles a very large balance and a one-month loan", () => {
    expect(run({ balance: 9_000_000_000 }).schedule.at(-1)!.balance).toBe(0);
    expect(run({ term: 1, termUnit: "months" }).months).toBe(1);
  });
});

describe("validateStudentLoan", () => {
  it("accepts the defaults", () => {
    expect(validateStudentLoan(base)).toEqual({});
  });

  it("rejects bad balances, rates, terms and negative extras", () => {
    const errors = validateStudentLoan({
      ...base,
      balance: 0,
      annualRatePct: 51,
      term: 61,
      extraMonthly: -1,
      lumpSum: -5,
    });
    expect(Object.keys(errors).sort()).toEqual(
      ["annualRatePct", "balance", "extraMonthly", "lumpSum", "term"].sort(),
    );
  });

  it("requires a whole, positive month only when there is a lump sum", () => {
    expect(
      validateStudentLoan({ ...base, lumpSum: 100, lumpSumMonth: 0 }).lumpSumMonth,
    ).toBeDefined();
    expect(
      validateStudentLoan({ ...base, lumpSum: 100, lumpSumMonth: 2.5 }).lumpSumMonth,
    ).toBeDefined();
    expect(
      validateStudentLoan({ ...base, lumpSum: 0, lumpSumMonth: 0 }).lumpSumMonth,
    ).toBeUndefined();
  });

  it("treats NaN (an empty required box) as invalid", () => {
    expect(calculateStudentLoan({ ...base, balance: Number.NaN }).ok).toBe(false);
  });
});
