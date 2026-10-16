import { describe, expect, it } from "vitest";
import { calculateRetirement, validateRetirement, type RetirementInput } from "../retirement";

// Reference values (independent closed forms, annual return 7% -> monthly rate (1.07)^(1/12) - 1):
//   $50,000 lump sum for 30y at 7%              = 50,000 x 1.07^30           = 380,612.75
//   $10,000/year as 360 month-end deposits      = (10000/12) x ((1+i)^360-1)/i = 974,543.84
//   $1,000,000 in 30y at 2.5% inflation          = 1,000,000 / 1.025^30        = 476,742.69

const base: RetirementInput = {
  currentAge: 35,
  retirementAge: 65,
  currentBalance: 0,
  salary: 100_000,
  contributionPct: 10,
  matchPct: 50,
  matchLimitPct: 6,
  returnPct: 7,
  salaryGrowthPct: 0,
  inflationPct: 2.5,
  withdrawalPct: 4,
};

function run(overrides: Partial<RetirementInput> = {}) {
  const out = calculateRetirement({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("calculateRetirement: growth", () => {
  it("grows a lump sum like compound interest", () => {
    const r = run({ currentBalance: 50_000, contributionPct: 0, matchPct: 0 });
    expect(r.balanceAtRetirement).toBeCloseTo(380_612.75, 1);
    expect(r.employeeContributions).toBe(0);
    expect(r.growth).toBeCloseTo(380_612.75 - 50_000, 1);
  });

  it("matches the annuity formula for level contributions (no match, no raises)", () => {
    const r = run({ matchPct: 0 });
    expect(r.employeeContributions).toBeCloseTo(300_000, 6);
    expect(r.balanceAtRetirement).toBeCloseTo(974_543.84, 1);
  });

  it("splits the balance into contributions and growth", () => {
    const r = run({ currentBalance: 25_000, salaryGrowthPct: 3 });
    expect(25_000 + r.employeeContributions + r.employerContributions + r.growth).toBeCloseTo(
      r.balanceAtRetirement,
      4,
    );
  });

  it("0% return just adds up the money put in", () => {
    const r = run({ returnPct: 0, currentBalance: 10_000 });
    expect(r.growth).toBeCloseTo(0, 8);
    expect(r.balanceAtRetirement).toBeCloseTo(
      10_000 + r.employeeContributions + r.employerContributions,
      6,
    );
  });

  it("a higher return never gives a lower balance", () => {
    let prev = 0;
    for (const returnPct of [0, 2, 4, 6, 8, 10]) {
      const b = run({ returnPct }).balanceAtRetirement;
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it("retiring later never gives a lower balance", () => {
    let prev = 0;
    for (const retirementAge of [40, 50, 60, 67, 75]) {
      const b = run({ retirementAge }).balanceAtRetirement;
      expect(b).toBeGreaterThan(prev);
      prev = b;
    }
  });
});

describe("calculateRetirement: employer match and salary growth", () => {
  it("50% match up to 6% of salary adds $3,000 a year on a $100k salary", () => {
    const r = run();
    expect(r.employerContributions).toBeCloseTo(3_000 * 30, 6);
    expect(r.matchCaptured).toBe(true);
  });

  it("caps the match at the limit", () => {
    const high = run({ contributionPct: 15 }).employerContributions;
    expect(high).toBeCloseTo(3_000 * 30, 6);
  });

  it("only matches what is contributed when below the limit", () => {
    const r = run({ contributionPct: 3 });
    expect(r.employerContributions).toBeCloseTo(0.5 * 0.03 * 100_000 * 30, 6);
    expect(r.matchCaptured).toBe(false);
  });

  it("a 100% match doubles contributions up to the limit", () => {
    const r = run({ matchPct: 100, contributionPct: 6 });
    expect(r.employerContributions).toBeCloseTo(r.employeeContributions, 6);
  });

  it("salary growth raises contributions year by year", () => {
    const r = run({ salaryGrowthPct: 3 });
    // sum of 10,000 x 1.03^k for k = 0..29
    const expected = (10_000 * (Math.pow(1.03, 30) - 1)) / 0.03;
    expect(r.employeeContributions).toBeCloseTo(expected, 4);
    expect(r.schedule[1]!.salary).toBeCloseTo(103_000, 6);
  });
});

describe("calculateRetirement: inflation and income", () => {
  it("expresses the balance in today's dollars", () => {
    const r = run({ currentBalance: 50_000, contributionPct: 0, matchPct: 0 });
    expect(r.realBalance).toBeCloseTo(r.balanceAtRetirement / Math.pow(1.025, 30), 6);
  });

  it("converts $1,000,000 at 2.5% inflation over 30y", () => {
    const r = run({ currentBalance: 1_000_000, contributionPct: 0, matchPct: 0, returnPct: 0 });
    expect(r.realBalance).toBeCloseTo(476_742.69, 1);
  });

  it("illustrates the 4% rule", () => {
    const r = run();
    expect(r.annualIncome).toBeCloseTo(r.balanceAtRetirement * 0.04, 8);
    expect(r.monthlyIncomeReal).toBeCloseTo(r.annualIncomeReal / 12, 8);
  });

  it("schedule has one row per year, ending at retirement age with the final balance", () => {
    const r = run();
    expect(r.schedule).toHaveLength(30);
    expect(r.schedule[0]!.age).toBe(36);
    expect(r.schedule[29]!.age).toBe(65);
    expect(r.schedule[29]!.balance).toBeCloseTo(r.balanceAtRetirement, 8);
    expect(r.schedule[29]!.realBalance).toBeCloseTo(r.realBalance, 8);
  });

  it("handles a one-year horizon and zero salary", () => {
    expect(run({ retirementAge: 36 }).schedule).toHaveLength(1);
    const r = run({ salary: 0, currentBalance: 1_000 });
    expect(r.employeeContributions).toBe(0);
  });
});

describe("validateRetirement", () => {
  it("accepts valid input", () => {
    expect(validateRetirement(base)).toEqual({});
  });
  it.each([
    ["currentAge", { currentAge: 10 }],
    ["currentAge", { currentAge: 35.5 }],
    ["retirementAge", { retirementAge: 35 }],
    ["retirementAge", { retirementAge: 101 }],
    ["currentBalance", { currentBalance: -1 }],
    ["salary", { salary: -1 }],
    ["contributionPct", { contributionPct: 101 }],
    ["matchPct", { matchPct: -1 }],
    ["matchLimitPct", { matchLimitPct: 101 }],
    ["returnPct", { returnPct: 80 }],
    ["salaryGrowthPct", { salaryGrowthPct: 90 }],
    ["inflationPct", { inflationPct: 90 }],
    ["withdrawalPct", { withdrawalPct: -1 }],
    ["salary", { salary: Number.NaN }],
  ])("flags %s", (field, override) => {
    expect(
      validateRetirement({ ...base, ...override })[field as keyof RetirementInput],
    ).toBeDefined();
  });
  it("returns errors instead of a result", () => {
    expect(calculateRetirement({ ...base, currentAge: 70 }).ok).toBe(false);
  });
});
