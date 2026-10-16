import { describe, expect, it } from "vitest";
import {
  calculateCompound,
  effectiveMonthlyRate,
  validateCompound,
  type CompoundInput,
} from "../compound";

// Reference values come from the textbook formulas, evaluated independently:
//   A = P(1 + r/m)^(m t)
//   $10,000 @ 5% for 10y: monthly 16,470.09; annually 16,288.95; daily (365) 16,486.65
//   $10,000 @ 8% quarterly for 5y: 14,859.47
//   $200/month for 10y @ 5% compounded monthly (end of month): 200 * ((1+i)^120 - 1)/i = 31,056.46
//   same deposits at the start of the month (annuity due): 31,185.86

const base: CompoundInput = {
  principal: 10_000,
  annualRatePct: 5,
  years: 10,
  compounding: "monthly",
  monthlyContribution: 0,
  timing: "end",
};

function run(overrides: Partial<CompoundInput> = {}) {
  const out = calculateCompound({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("calculateCompound: lump sum", () => {
  it.each([
    ["monthly", 16_470.09],
    ["annually", 16_288.95],
    ["daily", 16_486.65],
  ] as const)("$10k @ 5% for 10y compounded %s", (compounding, expected) => {
    expect(run({ compounding }).finalBalance).toBeCloseTo(expected, 2);
  });

  it("quarterly: $10k @ 8% for 5y", () => {
    expect(run({ annualRatePct: 8, years: 5, compounding: "quarterly" }).finalBalance).toBeCloseTo(
      14_859.47,
      2,
    );
  });

  it("interest + principal = final balance when there are no deposits", () => {
    const r = run();
    expect(r.principal + r.totalInterest).toBeCloseTo(r.finalBalance, 8);
    expect(r.totalContributions).toBe(0);
  });

  it("0% interest leaves the balance unchanged", () => {
    const r = run({ annualRatePct: 0 });
    expect(r.finalBalance).toBe(10_000);
    expect(r.totalInterest).toBe(0);
  });

  it("more frequent compounding never earns less", () => {
    const order = ["annually", "quarterly", "monthly", "daily"] as const;
    let prev = 0;
    for (const compounding of order) {
      const v = run({ compounding }).finalBalance;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("calculateCompound: regular deposits", () => {
  it("end-of-month deposits match the annuity formula", () => {
    const r = run({ principal: 0, monthlyContribution: 200 });
    expect(r.finalBalance).toBeCloseTo(31_056.46, 2);
    expect(r.totalContributions).toBe(24_000);
  });

  it("start-of-month deposits match the annuity-due formula", () => {
    const r = run({ principal: 0, monthlyContribution: 200, timing: "start" });
    expect(r.finalBalance).toBeCloseTo(31_185.86, 2);
  });

  it("lump sum and deposits combine additively", () => {
    const r = run({ monthlyContribution: 200 });
    expect(r.finalBalance).toBeCloseTo(16_470.09 + 31_056.46, 2);
    expect(r.totalContributions).toBe(24_000);
    expect(r.principal + r.totalContributions + r.totalInterest).toBeCloseTo(r.finalBalance, 6);
  });

  it("deposits at the start of the month never earn less than at the end", () => {
    const end = run({ monthlyContribution: 300 }).finalBalance;
    const start = run({ monthlyContribution: 300, timing: "start" }).finalBalance;
    expect(start).toBeGreaterThan(end);
  });

  it("0% interest just adds up the deposits", () => {
    const r = run({ annualRatePct: 0, monthlyContribution: 100, years: 2 });
    expect(r.finalBalance).toBe(10_000 + 2_400);
  });

  it("year-by-year schedule reconciles with the totals", () => {
    const r = run({ monthlyContribution: 250, years: 7 });
    expect(r.schedule).toHaveLength(7);
    expect(r.schedule.reduce((s, y) => s + y.contributions, 0)).toBeCloseTo(
      r.totalContributions,
      6,
    );
    expect(r.schedule.reduce((s, y) => s + y.interest, 0)).toBeCloseTo(r.totalInterest, 6);
    const last = r.schedule[6]!;
    expect(last.balance).toBeCloseTo(r.finalBalance, 8);
    expect(last.totalDeposited + last.cumulativeInterest).toBeCloseTo(last.balance, 6);
  });

  it("handles a short period (3 months) with a partial first year", () => {
    const r = run({ years: 0.25, monthlyContribution: 100 });
    expect(r.months).toBe(3);
    expect(r.schedule).toHaveLength(1);
    expect(r.totalContributions).toBe(300);
  });

  it("handles a long period (100 years) and large amounts", () => {
    const r = run({ years: 100, principal: 1_000_000_000, monthlyContribution: 10_000 });
    expect(Number.isFinite(r.finalBalance)).toBe(true);
    expect(r.schedule).toHaveLength(100);
  });
});

describe("effectiveMonthlyRate", () => {
  it("compounds back to the nominal periodic rate over a year", () => {
    expect(Math.pow(1 + effectiveMonthlyRate(12, "monthly"), 12)).toBeCloseTo(1.12682503, 7);
    expect(Math.pow(1 + effectiveMonthlyRate(8, "quarterly"), 12)).toBeCloseTo(1.08243216, 7);
  });
});

describe("validateCompound", () => {
  it("accepts valid input", () => {
    expect(validateCompound(base)).toEqual({});
  });
  it.each([
    ["principal", { principal: -1 }],
    ["monthlyContribution", { monthlyContribution: -1 }],
    ["annualRatePct", { annualRatePct: -2 }],
    ["annualRatePct", { annualRatePct: 101 }],
    ["years", { years: 0 }],
    ["years", { years: 101 }],
    ["principal", { principal: 0, monthlyContribution: 0 }],
  ])("flags %s", (field, override) => {
    expect(validateCompound({ ...base, ...override })[field as keyof CompoundInput]).toBeDefined();
  });
  it("returns errors instead of a result", () => {
    expect(calculateCompound({ ...base, years: Number.NaN }).ok).toBe(false);
  });
});
