import { describe, expect, it } from "vitest";
import {
  aggregateByYear,
  balanceSeries,
  amortize,
  monthlyPayment,
  type AmortizationInput,
} from "../amortization";

// Reference payments are standard published figures, re-derived independently:
//   $300,000 @ 6.00% / 30y -> $1,798.65 (total interest $347,514.57)
//   $200,000 @ 5.00% / 30y -> $1,073.64
//   $100,000 @ 4.50% / 15y -> $764.99
//   $10,000  @ 12.00% / 12m -> $888.49

describe("monthlyPayment", () => {
  it.each([
    [300_000, 6, 360, 1798.65],
    [200_000, 5, 360, 1073.64],
    [100_000, 4.5, 180, 764.99],
    [10_000, 12, 12, 888.49],
  ])("P=%d rate=%d n=%d -> %d", (p, rate, n, expected) => {
    expect(monthlyPayment(p, rate, n)).toBeCloseTo(expected, 2);
  });

  it("splits principal evenly at 0% interest", () => {
    expect(monthlyPayment(120_000, 0, 120)).toBe(1000);
  });

  it("handles a one-month term", () => {
    expect(monthlyPayment(1000, 12, 1)).toBeCloseTo(1010, 8);
  });

  it("never lowers the payment when the rate goes up", () => {
    let prev = 0;
    for (let rate = 0; rate <= 20; rate += 0.5) {
      const m = monthlyPayment(250_000, rate, 360);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it("never raises the payment when the term gets longer", () => {
    let prev = Infinity;
    for (let years = 5; years <= 40; years += 5) {
      const m = monthlyPayment(250_000, 6, years * 12);
      expect(m).toBeLessThan(prev);
      prev = m;
    }
  });

  it.each([
    [0, 5, 360],
    [-1, 5, 360],
    [100_000, -1, 360],
    [100_000, 5, 0],
    [100_000, 5, 12.5],
    [Number.NaN, 5, 360],
    [100_000, Number.POSITIVE_INFINITY, 360],
  ])("rejects invalid input P=%d rate=%d n=%d", (p, rate, n) => {
    expect(() => monthlyPayment(p, rate, n)).toThrow(RangeError);
  });
});

/** Relative tolerance so very large loans are not judged by absolute cents. */
function near(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));
}

function expectConsistent(input: AmortizationInput) {
  const res = amortize(input);
  const last = res.schedule[res.schedule.length - 1]!;
  // Ends at exactly zero.
  expect(last.balance).toBe(0);
  // Principal repaid equals the amount borrowed.
  const principalSum = res.schedule.reduce((s, r) => s + r.principal, 0);
  near(principalSum, input.principal);
  // Payments equal principal + interest and match the reported totals.
  const paymentSum = res.schedule.reduce((s, r) => s + r.payment, 0);
  const interestSum = res.schedule.reduce((s, r) => s + r.interest, 0);
  near(paymentSum, res.totalPaid);
  near(interestSum, res.totalInterest);
  near(res.totalPaid, input.principal + res.totalInterest);
  // Balances are continuous and never negative.
  res.schedule.forEach((row, i) => {
    expect(row.balance).toBeGreaterThanOrEqual(0);
    const expectedOpening = i === 0 ? input.principal : res.schedule[i - 1]!.balance;
    near(row.openingBalance, expectedOpening);
  });
  return res;
}

describe("amortize", () => {
  it("matches the reference loan: $300k @ 6% for 30 years", () => {
    const res = expectConsistent({ principal: 300_000, annualRatePct: 6, termMonths: 360 });
    expect(res.months).toBe(360);
    expect(res.monthlyPayment).toBeCloseTo(1798.65, 2);
    expect(res.totalInterest).toBeCloseTo(347_514.57, 1);
    // First month: interest = 300,000 * 0.005 = 1,500 exactly.
    expect(res.schedule[0]!.interest).toBeCloseTo(1500, 8);
    expect(res.schedule[0]!.principal).toBeCloseTo(298.65, 2);
  });

  it("handles 0% interest", () => {
    const res = expectConsistent({ principal: 120_000, annualRatePct: 0, termMonths: 120 });
    expect(res.totalInterest).toBe(0);
    expect(res.totalPaid).toBeCloseTo(120_000, 8);
  });

  it("handles a very short term (1 month)", () => {
    const res = expectConsistent({ principal: 5_000, annualRatePct: 6, termMonths: 1 });
    expect(res.months).toBe(1);
    expect(res.totalInterest).toBeCloseTo(25, 8);
  });

  it("handles a very long term (50 years)", () => {
    const res = expectConsistent({ principal: 400_000, annualRatePct: 7.25, termMonths: 600 });
    expect(res.months).toBe(600);
  });

  it("handles very large amounts", () => {
    expectConsistent({ principal: 250_000_000, annualRatePct: 4.125, termMonths: 360 });
  });

  it("handles tiny amounts", () => {
    expectConsistent({ principal: 1, annualRatePct: 3, termMonths: 24 });
  });

  it("monthly extra payments shorten the loan: $200k @ 5%, +$200/mo", () => {
    // Independent check with the closed-form NPER formula:
    //   n = -ln(1 - P*r/pmt) / ln(1+r), with pmt = base payment + 200 -> 255.45, so 256 payments.
    const res = expectConsistent({
      principal: 200_000,
      annualRatePct: 5,
      termMonths: 360,
      extraMonthly: 200,
    });
    expect(res.months).toBe(256);
    const base = amortize({ principal: 200_000, annualRatePct: 5, termMonths: 360 });
    expect(res.totalInterest).toBeLessThan(base.totalInterest);
  });

  it("yearly extra payments land on months 12, 24, ...", () => {
    const res = expectConsistent({
      principal: 200_000,
      annualRatePct: 5,
      termMonths: 360,
      extraYearly: 2_000,
    });
    expect(res.schedule[11]!.extra).toBeCloseTo(2_000, 8);
    expect(res.schedule[10]!.extra).toBeCloseTo(0, 8);
    expect(res.months).toBeLessThan(360);
  });

  it("applies a one-time extra payment in the requested month", () => {
    const res = expectConsistent({
      principal: 200_000,
      annualRatePct: 5,
      termMonths: 360,
      oneTime: { amount: 20_000, month: 24 },
    });
    expect(res.schedule[23]!.extra).toBeCloseTo(20_000, 8);
    expect(res.months).toBeLessThan(360);
  });

  it("pays off early and shrinks the last payment when extras exceed the balance", () => {
    const res = expectConsistent({
      principal: 10_000,
      annualRatePct: 6,
      termMonths: 120,
      oneTime: { amount: 50_000, month: 3 },
    });
    expect(res.months).toBe(3);
    expect(res.schedule[2]!.balance).toBe(0);
  });

  it("ignores a one-time extra scheduled after the loan ends", () => {
    const res = expectConsistent({
      principal: 10_000,
      annualRatePct: 6,
      termMonths: 12,
      oneTime: { amount: 5_000, month: 99 },
    });
    expect(res.months).toBe(12);
  });

  it("more extra never costs more interest", () => {
    let prev = Infinity;
    for (const extra of [0, 50, 100, 250, 500, 1000]) {
      const r = amortize({
        principal: 300_000,
        annualRatePct: 6,
        termMonths: 360,
        extraMonthly: extra,
      });
      expect(r.totalInterest).toBeLessThanOrEqual(prev);
      prev = r.totalInterest;
    }
  });

  it("rejects invalid extras", () => {
    expect(() =>
      amortize({ principal: 1000, annualRatePct: 5, termMonths: 12, extraMonthly: -5 }),
    ).toThrow(RangeError);
    expect(() =>
      amortize({
        principal: 1000,
        annualRatePct: 5,
        termMonths: 12,
        oneTime: { amount: 5, month: 0 },
      }),
    ).toThrow(RangeError);
  });
});

describe("aggregateByYear", () => {
  it("rolls months into years and preserves totals", () => {
    const res = amortize({ principal: 300_000, annualRatePct: 6, termMonths: 360 });
    const years = aggregateByYear(res.schedule);
    expect(years).toHaveLength(30);
    expect(years.reduce((s, y) => s + y.interest, 0)).toBeCloseTo(res.totalInterest, 6);
    expect(years.reduce((s, y) => s + y.principal, 0)).toBeCloseTo(300_000, 6);
    expect(years[29]!.balance).toBe(0);
  });

  it("includes a partial final year", () => {
    const res = amortize({ principal: 10_000, annualRatePct: 6, termMonths: 18 });
    expect(aggregateByYear(res.schedule)).toHaveLength(2);
  });
});

describe("balanceSeries", () => {
  it("starts at the principal in year 0 and ends at zero with all the interest", () => {
    const res = amortize({ principal: 300_000, annualRatePct: 6, termMonths: 360 });
    const series = balanceSeries(300_000, res.schedule);
    expect(series).toHaveLength(31);
    expect(series[0]).toEqual({ year: 0, balance: 300_000, cumulativeInterest: 0 });
    expect(series[30]!.balance).toBe(0);
    expect(series[30]!.cumulativeInterest).toBeCloseTo(res.totalInterest, 6);
  });

  it("is monotonic: balance never rises and interest never falls", () => {
    const res = amortize({
      principal: 150_000,
      annualRatePct: 7,
      termMonths: 240,
      extraMonthly: 100,
    });
    const series = balanceSeries(150_000, res.schedule);
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.balance).toBeLessThanOrEqual(series[i - 1]!.balance);
      expect(series[i]!.cumulativeInterest).toBeGreaterThanOrEqual(
        series[i - 1]!.cumulativeInterest,
      );
    }
  });
});
