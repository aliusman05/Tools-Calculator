import { describe, expect, it } from "vitest";
import {
  calculateCreditCard,
  paymentForTarget,
  validateCreditCard,
  type CreditCardInput,
} from "../credit-card";

// Reference: $5,000 at 18% APR (1.5% a month).
//   Paying $200/month: n = -ln(1 - 5000 x 0.015 / 200) / ln(1.015) = 31.57 -> 32 payments,
//   total interest $1,313.96 (independent month-by-month check).
//   To clear it in 24 months: 5000 x 0.015 / (1 - 1.015^-24) = $249.62/month.

const base: CreditCardInput = {
  mode: "payment",
  balance: 5_000,
  aprPct: 18,
  monthlyPayment: 200,
  targetMonths: 24,
};

function run(overrides: Partial<CreditCardInput> = {}) {
  const out = calculateCreditCard({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("payment mode", () => {
  it("matches the reference payoff for $5,000 at 18% paying $200", () => {
    const r = run();
    expect(r.months).toBe(32);
    expect(r.totalInterest).toBeCloseTo(1_313.96, 2);
    expect(r.totalPaid).toBeCloseTo(5_000 + r.totalInterest, 6);
    expect(r.neverPaysOff).toBe(false);
  });

  it("agrees with the closed-form month count", () => {
    const exact = -Math.log(1 - (5_000 * 0.015) / 200) / Math.log(1.015);
    expect(run().months).toBe(Math.ceil(exact));
  });

  it("ends at exactly zero with a smaller final payment", () => {
    const r = run();
    const last = r.schedule[r.schedule.length - 1]!;
    expect(last.balance).toBe(0);
    expect(last.payment).toBeLessThan(200);
    expect(r.schedule.reduce((s, row) => s + row.principal, 0)).toBeCloseTo(5_000, 6);
    expect(r.schedule.reduce((s, row) => s + row.payment, 0)).toBeCloseTo(r.totalPaid, 6);
  });

  it("charges first-month interest of balance x APR / 12", () => {
    const r = run();
    expect(r.firstMonthInterest).toBeCloseTo(75, 8);
    expect(r.schedule[0]!.interest).toBeCloseTo(75, 8);
    expect(r.schedule[0]!.principal).toBeCloseTo(125, 8);
  });

  it("handles 0% APR", () => {
    const r = run({ aprPct: 0, monthlyPayment: 500 });
    expect(r.months).toBe(10);
    expect(r.totalInterest).toBe(0);
  });

  it("pays off in one month when the payment covers everything", () => {
    const r = run({ monthlyPayment: 10_000 });
    expect(r.months).toBe(1);
    expect(r.totalPaid).toBeCloseTo(5_075, 8);
  });

  it("paying more never costs more interest or takes longer", () => {
    let prevMonths = Infinity;
    let prevInterest = Infinity;
    for (const monthlyPayment of [100, 150, 200, 300, 500, 1_000]) {
      const r = run({ monthlyPayment });
      expect(r.months!).toBeLessThanOrEqual(prevMonths);
      expect(r.totalInterest).toBeLessThanOrEqual(prevInterest);
      prevMonths = r.months!;
      prevInterest = r.totalInterest;
    }
  });
});

describe("payments that are too low", () => {
  it("flags a payment equal to the monthly interest", () => {
    const r = run({ monthlyPayment: 75 });
    expect(r.neverPaysOff).toBe(true);
    expect(r.months).toBeNull();
    expect(r.firstMonthInterest).toBeCloseTo(75, 8);
  });

  it("flags a payment below the monthly interest", () => {
    expect(run({ monthlyPayment: 20 }).neverPaysOff).toBe(true);
  });

  it("still pays off (in about 50 years) when the payment is a cent over the interest", () => {
    const r = run({ monthlyPayment: 75.01 });
    expect(r.neverPaysOff).toBe(false);
    expect(r.months).toBeGreaterThan(500);
  });

  it("flags a payment that would take more than 100 years", () => {
    // Excess over the monthly interest of 1e-7 needs ~1,370 months.
    expect(run({ monthlyPayment: 75.0000001 }).neverPaysOff).toBe(true);
  });
});

describe("target mode", () => {
  it("solves $249.62 to clear $5,000 at 18% in 24 months", () => {
    const r = run({ mode: "target", targetMonths: 24 });
    expect(r.monthlyPayment).toBeCloseTo(249.62, 2);
    expect(r.months).toBe(24);
    expect(r.schedule[23]!.balance).toBe(0);
  });

  it("splits evenly at 0% APR", () => {
    const r = run({ mode: "target", aprPct: 0, targetMonths: 10 });
    expect(r.monthlyPayment).toBe(500);
  });

  it("a shorter target needs a higher payment but costs less interest", () => {
    const quick = run({ mode: "target", targetMonths: 12 });
    const slow = run({ mode: "target", targetMonths: 60 });
    expect(quick.monthlyPayment).toBeGreaterThan(slow.monthlyPayment);
    expect(quick.totalInterest).toBeLessThan(slow.totalInterest);
  });

  it("paymentForTarget reproduces the payoff when fed back into payment mode", () => {
    const payment = paymentForTarget(5_000, 18, 36);
    const r = run({ monthlyPayment: payment + 1e-9 });
    expect(r.months).toBe(36);
  });

  it("handles a 1-month target", () => {
    const r = run({ mode: "target", targetMonths: 1 });
    expect(r.months).toBe(1);
    expect(r.monthlyPayment).toBeCloseTo(5_075, 6);
  });
});

describe("validateCreditCard", () => {
  it("accepts valid input", () => {
    expect(validateCreditCard(base)).toEqual({});
  });
  it.each([
    ["balance", { balance: 0 }],
    ["aprPct", { aprPct: -1 }],
    ["aprPct", { aprPct: 101 }],
    ["monthlyPayment", { monthlyPayment: 0 }],
    ["targetMonths", { mode: "target" as const, targetMonths: 0 }],
    ["targetMonths", { mode: "target" as const, targetMonths: 12.5 }],
    ["balance", { balance: Number.NaN }],
  ])("flags %s", (field, override) => {
    expect(
      validateCreditCard({ ...base, ...override })[field as keyof CreditCardInput],
    ).toBeDefined();
  });
  it("only validates the field for the active mode", () => {
    expect(validateCreditCard({ ...base, mode: "target", monthlyPayment: 0 })).toEqual({});
    expect(validateCreditCard({ ...base, mode: "payment", targetMonths: 0 })).toEqual({});
  });
  it("returns errors instead of a result", () => {
    expect(calculateCreditCard({ ...base, balance: -1 }).ok).toBe(false);
  });
});
