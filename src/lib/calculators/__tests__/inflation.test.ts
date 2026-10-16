import { describe, expect, it } from "vitest";
import {
  calculateInflation,
  futureValue,
  impliedRatePct,
  validateInflation,
  type InflationInput,
} from "../inflation";

// Reference (FV = PV x (1 + i)^t):
//   $100 at 3% for 10 years      -> $134.39 ; purchasing power of $100 -> $74.41
//   $1,000 at 2% for 25 years    -> $1,640.61
//   $100 -> $200 over 20 years   -> 3.5265% a year (2^(1/20) - 1)
//   Prices double in ln 2 / ln 1.03 = 23.45 years at 3%

const base: InflationInput = { mode: "future", amount: 100, ratePct: 3, years: 10, endAmount: 0 };

function run(overrides: Partial<InflationInput> = {}) {
  const out = calculateInflation({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("future cost", () => {
  it("$100 at 3% for 10 years", () => {
    const r = run();
    expect(r.headline).toBeCloseTo(134.39, 2);
    expect(r.totalInflationPct).toBeCloseTo(34.39, 2);
  });

  it("$1,000 at 2% for 25 years", () => {
    expect(run({ amount: 1_000, ratePct: 2, years: 25 }).headline).toBeCloseTo(1_640.61, 2);
  });

  it("0% inflation changes nothing", () => {
    const r = run({ ratePct: 0 });
    expect(r.headline).toBe(100);
    expect(r.powerLostPct).toBe(0);
    expect(r.doublingYears).toBeNull();
  });

  it("deflation lowers the future cost", () => {
    expect(run({ ratePct: -2 }).headline).toBeLessThan(100);
  });

  it("higher inflation or a longer period never lowers the cost", () => {
    let prev = 0;
    for (const ratePct of [0, 1, 2, 4, 8, 15]) {
      const v = run({ ratePct }).headline;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    prev = 0;
    for (const years of [1, 5, 10, 30, 60]) {
      const v = run({ years }).headline;
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it("handles fractional years and very long periods", () => {
    expect(run({ years: 0.5 }).headline).toBeCloseTo(100 * Math.pow(1.03, 0.5), 8);
    expect(Number.isFinite(run({ years: 100, ratePct: 10 }).headline)).toBe(true);
  });
});

describe("purchasing power", () => {
  it("$100 loses value: worth $74.41 in today's dollars after 10y at 3%", () => {
    const r = run({ mode: "power" });
    expect(r.headline).toBeCloseTo(74.41, 2);
    expect(r.powerLostPct).toBeCloseTo(25.59, 2);
  });

  it("purchasing power times future cost returns the original amount", () => {
    const power = run({ mode: "power" }).headline;
    const cost = run({ mode: "future" }).headline;
    expect(power * cost).toBeCloseTo(100 * 100, 6);
  });
});

describe("implied rate", () => {
  it("$100 doubling over 20 years is 3.5265% a year", () => {
    const r = run({ mode: "rate", amount: 100, endAmount: 200, years: 20 });
    expect(r.ratePct).toBeCloseTo(3.5265, 4);
    expect(r.headline).toBeCloseTo(200, 6);
  });

  it("is the inverse of futureValue", () => {
    const rate = impliedRatePct(250, futureValue(250, 4.2, 17), 17);
    expect(rate).toBeCloseTo(4.2, 10);
  });

  it("is negative when prices fell", () => {
    expect(run({ mode: "rate", amount: 100, endAmount: 80, years: 5 }).ratePct).toBeLessThan(0);
  });
});

describe("schedule and doubling time", () => {
  it("has a row per year starting at year 0", () => {
    const r = run();
    expect(r.schedule).toHaveLength(11);
    expect(r.schedule[0]).toEqual({ year: 0, futureCost: 100, purchasingPower: 100 });
    expect(r.schedule[10]!.futureCost).toBeCloseTo(134.39, 2);
    expect(r.schedule[10]!.purchasingPower).toBeCloseTo(74.41, 2);
  });

  it("adds a final partial-year row", () => {
    const r = run({ years: 2.5 });
    expect(r.schedule.map((x) => x.year)).toEqual([0, 1, 2, 2.5]);
  });

  it("prices double in 23.45 years at 3%", () => {
    expect(run().doublingYears).toBeCloseTo(23.45, 2);
  });
});

describe("validateInflation", () => {
  it("accepts valid input", () => {
    expect(validateInflation(base)).toEqual({});
  });
  it.each([
    ["amount", { amount: 0 }],
    ["years", { years: 0 }],
    ["years", { years: 101 }],
    ["ratePct", { ratePct: 101 }],
    ["ratePct", { ratePct: -25 }],
    ["endAmount", { mode: "rate" as const, endAmount: 0 }],
    ["amount", { amount: Number.NaN }],
  ])("flags %s", (field, override) => {
    expect(
      validateInflation({ ...base, ...override })[field as keyof InflationInput],
    ).toBeDefined();
  });
  it("ignores the rate in rate mode and the end amount otherwise", () => {
    expect(
      validateInflation({ ...base, mode: "rate", endAmount: 150, ratePct: Number.NaN }),
    ).toEqual({});
    expect(validateInflation({ ...base, endAmount: Number.NaN })).toEqual({});
  });
  it("returns errors instead of a result", () => {
    expect(calculateInflation({ ...base, amount: -1 }).ok).toBe(false);
  });
});
