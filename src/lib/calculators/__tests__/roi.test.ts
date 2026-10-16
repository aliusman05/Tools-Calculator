import { describe, expect, it } from "vitest";
import { calculateRoi, roiYears, validateRoi, type RoiInput } from "../roi";

// Reference:
//   $10,000 -> $15,000 over 5y: ROI 50%, CAGR = 1.5^(1/5) - 1 = 8.4472%
//   $1,000 -> $2,000 over 10y:  CAGR = 2^(1/10) - 1 = 7.1773%
//   $10,000 -> $6,000 over 3y:  ROI -40%, CAGR = 0.6^(1/3) - 1 = -15.6567%
//   $1,000 -> $1,100 over 6 months: CAGR = 1.1^2 - 1 = 21%

const base: RoiInput = { initial: 10_000, final: 15_000, time: 5, unit: "years" };

function run(overrides: Partial<RoiInput> = {}) {
  const out = calculateRoi({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("ROI", () => {
  it("$10k -> $15k is 50%", () => {
    const r = run();
    expect(r.gain).toBe(5_000);
    expect(r.roiPct).toBeCloseTo(50, 10);
  });

  it("a loss is negative", () => {
    const r = run({ final: 6_000, time: 3 });
    expect(r.gain).toBe(-4_000);
    expect(r.roiPct).toBeCloseTo(-40, 10);
  });

  it("a total loss is -100%", () => {
    const r = run({ final: 0 });
    expect(r.roiPct).toBe(-100);
    expect(r.cagrPct).toBeCloseTo(-100, 10);
  });

  it("no change is 0%", () => {
    const r = run({ final: 10_000 });
    expect(r.roiPct).toBe(0);
    expect(r.cagrPct).toBeCloseTo(0, 10);
    expect(r.doublingYears).toBeNull();
  });

  it("computes ROI alone when no period is given", () => {
    const r = run({ time: 0 });
    expect(r.roiPct).toBeCloseTo(50, 10);
    expect(r.cagrPct).toBeNull();
    expect(r.simpleAnnualPct).toBeNull();
    expect(r.series).toEqual([]);
  });
});

describe("CAGR", () => {
  it("$10k -> $15k over 5 years", () => {
    expect(run().cagrPct).toBeCloseTo(8.4472, 4);
  });

  it("$1,000 -> $2,000 over 10 years", () => {
    expect(run({ initial: 1_000, final: 2_000, time: 10 }).cagrPct).toBeCloseTo(7.1773, 4);
  });

  it("negative for losses", () => {
    expect(run({ final: 6_000, time: 3 }).cagrPct).toBeCloseTo(-15.6567, 4);
  });

  it("converts months and days to years", () => {
    expect(run({ initial: 1_000, final: 1_100, time: 6, unit: "months" }).cagrPct).toBeCloseTo(
      21,
      8,
    );
    expect(run({ initial: 1_000, final: 1_100, time: 365, unit: "days" }).cagrPct).toBeCloseTo(
      10,
      8,
    );
  });

  it("compounding the CAGR over the period reproduces the final value", () => {
    const r = run({ initial: 2_500, final: 9_100, time: 7.5 });
    expect(2_500 * Math.pow(1 + r.cagrPct! / 100, 7.5)).toBeCloseTo(9_100, 6);
  });

  it("simple annual return is ROI / years and never below CAGR for gains", () => {
    const r = run();
    expect(r.simpleAnnualPct).toBeCloseTo(10, 10);
    expect(r.simpleAnnualPct!).toBeGreaterThan(r.cagrPct!);
  });

  it("doubling time is ln 2 / ln(1 + CAGR)", () => {
    expect(run().doublingYears).toBeCloseTo(8.5477, 3);
  });

  it("handles a very short period and a very long one", () => {
    expect(Number.isFinite(run({ time: 1, unit: "days" }).cagrPct!)).toBe(true);
    expect(run({ initial: 100, final: 1e9, time: 100 }).cagrPct!).toBeGreaterThan(0);
  });
});

describe("growth series", () => {
  it("starts at the initial value and ends at the final value", () => {
    const r = run();
    expect(r.series[0]).toEqual({ year: 0, compound: 10_000, straightLine: 10_000 });
    const last = r.series[r.series.length - 1]!;
    expect(last.year).toBe(5);
    expect(last.compound).toBeCloseTo(15_000, 6);
    expect(last.straightLine).toBeCloseTo(15_000, 6);
  });

  it("compound growth sits below the straight line in between for gains", () => {
    const r = run();
    const mid = r.series[Math.floor(r.series.length / 2)]!;
    expect(mid.compound).toBeLessThan(mid.straightLine);
  });
});

describe("validateRoi", () => {
  it("accepts valid input", () => {
    expect(validateRoi(base)).toEqual({});
  });
  it.each([
    ["initial", { initial: 0 }],
    ["initial", { initial: -5 }],
    ["final", { final: -1 }],
    ["time", { time: -1 }],
    ["time", { time: 201 }],
    ["initial", { initial: Number.NaN }],
  ])("flags %s", (field, override) => {
    expect(validateRoi({ ...base, ...override })[field as keyof RoiInput]).toBeDefined();
  });
  it("returns errors instead of a result", () => {
    expect(calculateRoi({ ...base, initial: 0 }).ok).toBe(false);
  });
  it("converts units", () => {
    expect(roiYears(18, "months")).toBe(1.5);
    expect(roiYears(730, "days")).toBe(2);
  });
});
