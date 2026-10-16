import { describe, expect, it } from "vitest";
import {
  calculateSimpleInterest,
  compoundAmount,
  simpleInterest,
  toYears,
  validateSimpleInterest,
  type SimpleInterestInput,
} from "../simple-interest";

// Reference (I = P x R x T):
//   $5,000 @ 6% for 3 years = $900 -> total $5,900
//   $5,000 @ 4% for 18 months = $300
//   $10,000 @ 6% for 90 days (365-day year) = $147.95

const base: SimpleInterestInput = {
  principal: 5_000,
  annualRatePct: 6,
  time: 3,
  unit: "years",
  compareWith: "annually",
};

function run(overrides: Partial<SimpleInterestInput> = {}) {
  const out = calculateSimpleInterest({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("simpleInterest", () => {
  it("$5,000 @ 6% for 3 years", () => {
    const r = run();
    expect(r.interest).toBeCloseTo(900, 8);
    expect(r.total).toBeCloseTo(5_900, 8);
  });

  it("months: $5,000 @ 4% for 18 months", () => {
    expect(run({ annualRatePct: 4, time: 18, unit: "months" }).interest).toBeCloseTo(300, 8);
  });

  it("days: $10,000 @ 6% for 90 days", () => {
    expect(run({ principal: 10_000, time: 90, unit: "days" }).interest).toBeCloseTo(147.95, 2);
  });

  it("0% rate earns nothing", () => {
    const r = run({ annualRatePct: 0 });
    expect(r.interest).toBe(0);
    expect(r.compoundInterest).toBe(0);
    expect(r.difference).toBe(0);
  });

  it("is linear in time and in rate", () => {
    expect(simpleInterest(1_000, 5, 4)).toBeCloseTo(2 * simpleInterest(1_000, 5, 2), 10);
    expect(simpleInterest(1_000, 10, 3)).toBeCloseTo(2 * simpleInterest(1_000, 5, 3), 10);
  });

  it("handles very large principals and long times", () => {
    const r = run({ principal: 1e12, time: 100 });
    expect(r.interest).toBeCloseTo(6e12, 0);
  });
});

describe("comparison with compound interest", () => {
  it("annual compounding: $5,000 @ 6% for 3y -> 5,955.08", () => {
    // 5000 * 1.06^3 = 5955.08
    const r = run();
    expect(r.compoundTotal).toBeCloseTo(5_955.08, 2);
    expect(r.difference).toBeCloseTo(55.08, 2);
  });

  it("compound is never less than simple for the same period over a year", () => {
    for (const compareWith of ["annually", "quarterly", "monthly", "daily"] as const) {
      const r = run({ time: 5, compareWith });
      expect(r.compoundInterest).toBeGreaterThanOrEqual(r.interest);
    }
  });

  it("matches within the first year at annual compounding", () => {
    const r = run({ time: 1 });
    expect(r.compoundInterest).toBeCloseTo(r.interest, 8);
  });

  it("series starts at the principal and ends at the totals", () => {
    const r = run({ time: 10 });
    expect(r.series[0]).toEqual({ year: 0, simple: 5_000, compound: 5_000 });
    const last = r.series[r.series.length - 1]!;
    expect(last.year).toBe(10);
    expect(last.simple).toBeCloseTo(r.total, 8);
    expect(last.compound).toBeCloseTo(r.compoundTotal, 8);
  });

  it("builds a series for periods shorter than a year", () => {
    const r = run({ time: 90, unit: "days" });
    expect(r.series.length).toBeGreaterThan(2);
    expect(r.series[r.series.length - 1]!.simple).toBeCloseTo(r.total, 8);
  });
});

describe("helpers and validation", () => {
  it("converts units to years", () => {
    expect(toYears(2, "years")).toBe(2);
    expect(toYears(18, "months")).toBe(1.5);
    expect(toYears(730, "days")).toBe(2);
  });

  it("compoundAmount reproduces the textbook formula", () => {
    expect(compoundAmount(10_000, 5, 10, "monthly")).toBeCloseTo(16_470.09, 2);
  });

  it("accepts valid input", () => {
    expect(validateSimpleInterest(base)).toEqual({});
  });

  it.each([
    ["principal", { principal: 0 }],
    ["annualRatePct", { annualRatePct: -1 }],
    ["annualRatePct", { annualRatePct: 150 }],
    ["time", { time: 0 }],
    ["time", { time: 101 }],
    ["time", { time: 40_000, unit: "days" as const }],
  ])("flags %s", (field, override) => {
    expect(
      validateSimpleInterest({ ...base, ...override })[field as keyof SimpleInterestInput],
    ).toBeDefined();
  });

  it("returns errors instead of a result", () => {
    expect(calculateSimpleInterest({ ...base, principal: Number.NaN }).ok).toBe(false);
  });
});
