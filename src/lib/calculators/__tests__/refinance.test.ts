import { describe, expect, it } from "vitest";
import {
  calculateRefinance,
  validateRefinance,
  type RefinanceInput,
  type RefinanceResult,
} from "../refinance";

/*
 * Reference values were derived independently of the engine, with closed-form annuity formulas only
 * (no schedule loop, none of this code):
 *
 *   payment  M   = P r / (1 - (1+r)^-n)            r = annual rate / 12
 *   balance  B_m = P (1+r)^m - M ((1+r)^m - 1) / r  (0 once m >= n)
 *   paid         = M * min(m, n)
 *
 * and, at month m, the net benefit of refinancing
 *   net(m) = [paid_keep + B_keep] - [paid_refi + B_refi + up-front costs].
 * The first month with net(m) >= 0 is the break-even month. Scenario letters match that derivation.
 */

const base: RefinanceInput = {
  balance: 300_000,
  currentRatePct: 7,
  currentTerm: 25,
  currentTermUnit: "years",
  newRatePct: 5.5,
  newTerm: 25,
  newTermUnit: "years",
  closingCosts: 4_500,
  rollCosts: false,
  horizonYears: 7,
};

function run(overrides: Partial<RefinanceInput> = {}): RefinanceResult {
  const out = calculateRefinance({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("scenario A: lower rate, same term, costs paid in cash", () => {
  const r = run();

  it("matches the closed-form payments", () => {
    expect(r.currentPayment).toBeCloseTo(2120.337591825272, 6);
    expect(r.newPayment).toBeCloseTo(1842.2624768444014, 6);
    expect(r.monthlySavings).toBeCloseTo(278.07511498087047, 6);
    expect(r.newLoanAmount).toBe(300_000);
    expect(r.upfrontCosts).toBe(4_500);
  });

  it("breaks even in month 13 counting interest, 16.2 months counting only the payment", () => {
    expect(r.breakEvenMonth).toBe(13);
    expect(r.simpleBreakEvenMonths).toBeCloseTo(16.182677836201083, 6);
  });

  it("is still just behind after 12 months", () => {
    const year1 = r.series.find((p) => p.year === 1)!;
    expect(year1.net).toBeCloseTo(-1.8602913049398921, 4);
  });

  it("reports the net benefit after 5 and 7 years and over the full term", () => {
    expect(r.series.find((p) => p.year === 5)!.net).toBeCloseTo(17856.38811893796, 3);
    expect(r.netAtHorizon).toBeCloseTo(26606.822643311927, 3);
    expect(r.lifetimeNet).toBeCloseTo(78922.53449426114, 3);
  });

  it("reports total interest on each loan", () => {
    expect(r.currentInterestRemaining).toBeCloseTo(336101.2775475816, 3);
    expect(r.newInterestTotal).toBeCloseTo(252678.74305332045, 3);
  });

  it("starts the chart at minus the closing costs", () => {
    expect(r.series[0]).toEqual({ year: 0, net: -4_500 });
  });
});

describe("scenario B: costs rolled in and the clock restarted at 30 years", () => {
  const r = run({
    balance: 250_000,
    currentRatePct: 6.5,
    currentTerm: 240,
    currentTermUnit: "months",
    newRatePct: 5.75,
    newTerm: 30,
    closingCosts: 6_000,
    rollCosts: true,
    horizonYears: 10,
  });

  it("matches the closed-form payments on the larger balance", () => {
    expect(r.currentPayment).toBeCloseTo(1863.9328387877497, 6);
    expect(r.newPayment).toBeCloseTo(1493.9465124954856, 6);
    expect(r.monthlySavings).toBeCloseTo(369.98632629226404, 6);
    expect(r.newLoanAmount).toBe(256_000);
    expect(r.upfrontCosts).toBe(0);
  });

  it("never breaks even: the lower payment is paid for with a longer loan", () => {
    expect(r.breakEvenMonth).toBeNull();
    expect(r.simpleBreakEvenMonths).toBeNull(); // costs are in the loan, nothing to recover in cash
    expect(r.netAtHorizon).toBeCloseTo(-4235.453082508757, 3);
    expect(r.lifetimeNet).toBeCloseTo(-90476.86318931496, 3);
  });

  it("shows more total interest on the new loan", () => {
    expect(r.currentInterestRemaining).toBeCloseTo(197343.8813090599, 3);
    expect(r.newInterestTotal).toBeCloseTo(281820.7444983749, 3);
  });
});

describe("scenario C: a shorter loan with a higher payment", () => {
  const r = run({
    balance: 200_000,
    currentRatePct: 6,
    currentTerm: 300,
    currentTermUnit: "months",
    newRatePct: 4.75,
    newTerm: 15,
    closingCosts: 3_000,
    horizonYears: 5,
  });

  it("has a higher payment, so no payment-based break-even", () => {
    expect(r.monthlySavings).toBeCloseTo(-267.0610324496056, 6);
    expect(r.simpleBreakEvenMonths).toBeNull();
  });

  it("still comes out ahead after 14 months because far less interest accrues", () => {
    expect(r.breakEvenMonth).toBe(14);
    expect(r.netAtHorizon).toBeCloseTo(12466.900072286284, 3);
    expect(r.lifetimeNet).toBeCloseTo(103561.35051559447, 3);
  });
});

describe("edge cases", () => {
  it("scenario D: 0% loans with no costs are a wash (same cost, different pace)", () => {
    const r = run({
      balance: 12_000,
      currentRatePct: 0,
      currentTerm: 12,
      currentTermUnit: "months",
      newRatePct: 0,
      newTerm: 24,
      newTermUnit: "months",
      closingCosts: 0,
      horizonYears: 1,
    });
    expect(r.currentPayment).toBe(1000);
    expect(r.newPayment).toBe(500);
    expect(r.netAtHorizon).toBeCloseTo(0, 9);
    expect(r.lifetimeNet).toBeCloseTo(0, 9);
    expect(r.breakEvenMonth).toBe(1); // nothing to recover
    expect(r.simpleBreakEvenMonths).toBe(0);
  });

  it("scenario E: the same loan with closing costs loses exactly the costs", () => {
    const r = run({
      balance: 100_000,
      currentRatePct: 5,
      currentTerm: 10,
      newRatePct: 5,
      newTerm: 10,
      closingCosts: 2_000,
      horizonYears: 5,
    });
    expect(r.currentPayment).toBeCloseTo(1060.6551523907553, 6);
    expect(r.monthlySavings).toBeCloseTo(0, 9);
    expect(r.breakEvenMonth).toBeNull();
    expect(r.simpleBreakEvenMonths).toBeNull();
    expect(r.netAtHorizon).toBeCloseTo(-2_000, 6);
    expect(r.lifetimeNet).toBeCloseTo(-2_000, 6);
  });

  it("scenario F: a worse rate never breaks even", () => {
    const r = run({
      balance: 100_000,
      currentRatePct: 4,
      currentTerm: 20,
      newRatePct: 6,
      newTerm: 20,
      closingCosts: 1_000,
      horizonYears: 5,
    });
    expect(r.monthlySavings).toBeCloseTo(-110.45072917876325, 6);
    expect(r.breakEvenMonth).toBeNull();
    expect(r.netAtHorizon).toBeCloseTo(-10602.859434538303, 3);
    expect(r.lifetimeNet).toBeCloseTo(-27508.175002903183, 3);
  });

  it("a horizon beyond both loans equals the lifetime figure", () => {
    const r = run({ horizonYears: 50 });
    expect(r.netAtHorizon).toBeCloseTo(r.lifetimeNet, 6);
  });

  it("accepts terms in months and in years alike", () => {
    expect(run({ currentTerm: 300, currentTermUnit: "months" }).currentPayment).toBeCloseTo(
      run().currentPayment,
      10,
    );
  });

  it("handles one-month loans and a very large balance without breaking", () => {
    const tiny = run({
      currentTerm: 1,
      currentTermUnit: "months",
      newTerm: 1,
      newTermUnit: "months",
    });
    expect(Number.isFinite(tiny.netAtHorizon)).toBe(true);
    const huge = run({ balance: 5_000_000_000, closingCosts: 1e7 });
    expect(Number.isFinite(huge.lifetimeNet)).toBe(true);
  });

  it("costs paid in cash and costs rolled in agree at closing: both start behind by the costs", () => {
    expect(run({ rollCosts: true }).series[0]!.net).toBeCloseTo(-4_500, 9);
    expect(run({ rollCosts: false }).series[0]!.net).toBeCloseTo(-4_500, 9);
  });

  it("rolling costs in raises the new payment and the new balance", () => {
    const cash = run();
    const rolled = run({ rollCosts: true });
    expect(rolled.newLoanAmount).toBe(304_500);
    expect(rolled.newPayment).toBeGreaterThan(cash.newPayment);
  });
});

describe("validateRefinance", () => {
  it("accepts the defaults", () => {
    expect(validateRefinance(base)).toEqual({});
  });

  it("rejects non-positive balances, bad rates, bad terms and negative costs", () => {
    const errors = validateRefinance({
      ...base,
      balance: 0,
      currentRatePct: -1,
      newRatePct: 51,
      currentTerm: 0,
      newTerm: 61,
      closingCosts: -1,
      horizonYears: 0,
    });
    expect(Object.keys(errors).sort()).toEqual(
      [
        "balance",
        "closingCosts",
        "currentRatePct",
        "currentTerm",
        "horizonYears",
        "newRatePct",
        "newTerm",
      ].sort(),
    );
  });

  it("treats NaN (an empty required box) as invalid", () => {
    const out = calculateRefinance({ ...base, balance: Number.NaN });
    expect(out.ok).toBe(false);
  });
});
