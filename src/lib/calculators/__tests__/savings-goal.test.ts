import { describe, expect, it } from "vitest";
import {
  calculateSavingsGoal,
  monthsToGoal,
  requiredMonthlyContribution,
  validateSavingsGoal,
  type SavingsGoalInput,
} from "../savings-goal";

// Reference values (annual rate compounded monthly, deposits at month end), derived independently:
//   Goal $50,000, have $5,000, 4%, 10 years -> $288.94 per month
//   Goal $20,000, have $1,000, $300/month, 4% -> 56.98 months -> 57
//   Goal $20,000, have $0, $300/month, 0% -> 66.67 months -> 67

const base: SavingsGoalInput = {
  mode: "contribution",
  target: 50_000,
  current: 5_000,
  annualRatePct: 4,
  years: 10,
  monthlyContribution: 0,
};

function run(overrides: Partial<SavingsGoalInput> = {}) {
  const out = calculateSavingsGoal({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

/** Brute-force month-by-month simulation, independent of the closed-form solution. */
function simulate(current: number, monthly: number, ratePct: number, months: number): number {
  let balance = current;
  for (let m = 0; m < months; m++) balance = balance * (1 + ratePct / 1200) + monthly;
  return balance;
}

describe("required contribution", () => {
  it("$50k goal, $5k saved, 4%, 10 years -> $288.94/month", () => {
    expect(run().monthlyContribution).toBeCloseTo(288.94, 2);
  });

  it("the computed deposit actually reaches the goal (brute-force check)", () => {
    const r = run();
    expect(simulate(5_000, r.monthlyContribution, 4, 120)).toBeCloseTo(50_000, 6);
    expect(r.finalBalance).toBeCloseTo(50_000, 6);
  });

  it("0% interest: shortfall spread evenly", () => {
    const r = run({ annualRatePct: 0, years: 5, current: 0, target: 12_000 });
    expect(r.monthlyContribution).toBe(200);
    expect(r.interestEarned).toBe(0);
  });

  it("needs nothing when current savings already grow past the goal", () => {
    const r = run({ current: 100_000 });
    expect(r.monthlyContribution).toBe(0);
    expect(r.alreadyThere).toBe(true);
  });

  it("a higher rate never raises the required deposit", () => {
    let prev = Infinity;
    for (const rate of [0, 1, 3, 5, 8, 12]) {
      const v = requiredMonthlyContribution(100_000, 2_000, rate, 180);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });

  it("a shorter timeline never lowers the required deposit", () => {
    let prev = 0;
    for (const months of [240, 120, 60, 24, 12, 6, 1]) {
      const v = requiredMonthlyContribution(30_000, 1_000, 3, months);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("handles a 1-month goal", () => {
    const r = run({ years: 1 / 12, current: 0, target: 1_000, annualRatePct: 0 });
    expect(r.monthlyContribution).toBe(1_000);
  });

  it("splits the final balance into deposits and interest", () => {
    const r = run();
    expect(r.totalDeposited + r.interestEarned).toBeCloseTo(r.finalBalance, 6);
    expect(r.schedule).toHaveLength(10);
  });
});

describe("time to goal", () => {
  const time = (o: Partial<SavingsGoalInput>) =>
    run({ mode: "time", target: 20_000, current: 1_000, monthlyContribution: 300, years: 0, ...o });

  it("$300/month from $1k to $20k at 4% -> 57 months", () => {
    expect(time({}).months).toBe(57);
  });

  it("the answer is the first month that reaches the goal (brute-force check)", () => {
    const months = time({}).months!;
    expect(simulate(1_000, 300, 4, months)).toBeGreaterThanOrEqual(20_000);
    expect(simulate(1_000, 300, 4, months - 1)).toBeLessThan(20_000);
  });

  it("0% interest rounds up: 20,000 / 300 -> 67 months", () => {
    expect(time({ current: 0, annualRatePct: 0 }).months).toBe(67);
  });

  it("returns 0 months if the goal is already met", () => {
    const r = time({ current: 25_000 });
    expect(r.months).toBe(0);
    expect(r.alreadyThere).toBe(true);
  });

  it("works with no deposits when interest alone gets there", () => {
    // 10,000 -> 20,000 at 6%: ln(2)/ln(1.005) = 138.98 -> 139 months
    expect(time({ current: 10_000, monthlyContribution: 0, annualRatePct: 6 }).months).toBe(139);
  });

  it("is unreachable with no deposits, no interest and a shortfall", () => {
    const r = time({ monthlyContribution: 0, annualRatePct: 0 });
    expect(r.months).toBeNull();
    expect(r.schedule).toEqual([]);
  });

  it("is unreachable with no savings, no deposits and a positive rate (nothing to grow)", () => {
    expect(monthsToGoal(5_000, 0, 0, 5)).toBeNull();
  });

  it("is unreachable when it would take more than 100 years", () => {
    expect(monthsToGoal(1_000_000, 0, 1, 0)).toBeNull();
  });

  it("saving more never takes longer", () => {
    let prev = Infinity;
    for (const pmt of [50, 100, 200, 400, 800, 1600]) {
      const m = monthsToGoal(20_000, 1_000, pmt, 4)!;
      expect(m).toBeLessThanOrEqual(prev);
      prev = m;
    }
  });
});

describe("validateSavingsGoal", () => {
  it("accepts valid input", () => {
    expect(validateSavingsGoal(base)).toEqual({});
  });
  it.each([
    ["target", { target: 0 }],
    ["current", { current: -1 }],
    ["annualRatePct", { annualRatePct: 60 }],
    ["years", { years: 0 }],
    ["monthlyContribution", { mode: "time" as const, monthlyContribution: -5 }],
  ])("flags %s", (field, override) => {
    expect(
      validateSavingsGoal({ ...base, ...override })[field as keyof SavingsGoalInput],
    ).toBeDefined();
  });
  it("ignores fields that do not apply to the current mode", () => {
    expect(
      validateSavingsGoal({ ...base, mode: "time", years: 0, monthlyContribution: 100 }),
    ).toEqual({});
  });
  it("returns errors instead of a result", () => {
    expect(calculateSavingsGoal({ ...base, target: Number.NaN }).ok).toBe(false);
  });
});
