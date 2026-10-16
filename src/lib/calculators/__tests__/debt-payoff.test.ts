import { describe, expect, it } from "vitest";
import { calculateDebtPlan, validateDebtPlan, type Debt, type DebtPlanInput } from "../debt-payoff";
import { calculateCreditCard } from "../credit-card";

// Reference plan (pinned from an independent month-by-month simulation):
//   Card $2,000 @ 24% min $60, Car $5,000 @ 7% min $150, Store $500 @ 18% min $25, +$100 extra.
//   Snowball:  26 months, interest $902.46, order Store (5), Card (16), Car (26)
//   Avalanche: 26 months, interest $875.71, order Card (15), Store (16), Car (26)
//   Minimums only: 56 months, interest $2,004.03

const debts: Debt[] = [
  { name: "Card", balance: 2_000, aprPct: 24, minPayment: 60 },
  { name: "Car", balance: 5_000, aprPct: 7, minPayment: 150 },
  { name: "Store", balance: 500, aprPct: 18, minPayment: 25 },
];

function run(input: DebtPlanInput) {
  const out = calculateDebtPlan(input);
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

const plan: DebtPlanInput = { debts, extraMonthly: 100 };

describe("reference plan", () => {
  const r = run(plan);

  it("snowball matches the reference", () => {
    expect(r.snowball.months).toBe(26);
    expect(r.snowball.totalInterest).toBeCloseTo(902.46, 2);
    expect(r.snowball.payoffOrder).toEqual([
      { name: "Store", month: 5 },
      { name: "Card", month: 16 },
      { name: "Car", month: 26 },
    ]);
  });

  it("avalanche matches the reference", () => {
    expect(r.avalanche.months).toBe(26);
    expect(r.avalanche.totalInterest).toBeCloseTo(875.71, 2);
    expect(r.avalanche.payoffOrder).toEqual([
      { name: "Card", month: 15 },
      { name: "Store", month: 16 },
      { name: "Car", month: 26 },
    ]);
  });

  it("minimum-only matches the reference", () => {
    expect(r.minimumOnly.months).toBe(56);
    expect(r.minimumOnly.totalInterest).toBeCloseTo(2_004.03, 2);
  });

  it("reports totals and the avalanche advantage", () => {
    expect(r.totalBalance).toBe(7_500);
    expect(r.totalMinimum).toBe(235);
    expect(r.avalancheAdvantage).toBeCloseTo(902.46 - 875.71, 2);
  });
});

describe("invariants", () => {
  const scenarios: DebtPlanInput[] = [
    plan,
    { debts, extraMonthly: 0 },
    { debts, extraMonthly: 1_000 },
    {
      debts: [
        { name: "A", balance: 15_000, aprPct: 29.9, minPayment: 300 },
        { name: "B", balance: 800, aprPct: 5, minPayment: 40 },
        { name: "C", balance: 3_200, aprPct: 14, minPayment: 90 },
        { name: "D", balance: 9_000, aprPct: 21, minPayment: 200 },
      ],
      extraMonthly: 250,
    },
  ];

  it.each(scenarios.map((s, i) => [i, s] as const))(
    "scenario %i: payments equal balance plus interest",
    (_i, s) => {
      const r = run(s);
      expect(r.snowball.months).not.toBeNull();
      expect(r.avalanche.months).not.toBeNull();
      // Minimums alone can fail to cover the interest (scenario 3), in which case there is no payoff.
      for (const strategy of [r.snowball, r.avalanche, r.minimumOnly].filter(
        (x) => x.months !== null,
      )) {
        expect(strategy.totalPaid).toBeCloseTo(r.totalBalance + strategy.totalInterest, 6);
        expect(strategy.balanceByMonth[0]).toBeCloseTo(r.totalBalance, 8);
        expect(strategy.balanceByMonth[strategy.balanceByMonth.length - 1]).toBe(0);
        expect(strategy.balanceByMonth).toHaveLength(strategy.months! + 1);
        expect(strategy.payoffOrder).toHaveLength(s.debts.length);
      }
    },
  );

  it.each(scenarios.map((s, i) => [i, s] as const))(
    "scenario %i: avalanche never costs more interest than snowball",
    (_i, s) => {
      const r = run(s);
      expect(r.avalanche.totalInterest).toBeLessThanOrEqual(r.snowball.totalInterest + 1e-6);
      expect(r.avalancheAdvantage).toBeGreaterThanOrEqual(-1e-6);
    },
  );

  it.each(scenarios.map((s, i) => [i, s] as const))(
    "scenario %i: both methods beat minimums only",
    (_i, s) => {
      const r = run(s);
      expect(r.snowball.totalInterest).toBeLessThanOrEqual(r.minimumOnly.totalInterest + 1e-6);
      if (r.minimumOnly.months !== null) {
        expect(r.avalanche.months!).toBeLessThanOrEqual(r.minimumOnly.months);
      }
    },
  );

  it("scenario 3 shows why minimums alone can fail", () => {
    expect(run(scenarios[3]!).minimumOnly.months).toBeNull();
  });

  it("snowball clears the smallest balance first and avalanche the highest APR first", () => {
    const r = run(plan);
    expect(r.snowball.payoffOrder[0]!.name).toBe("Store");
    expect(r.avalanche.payoffOrder[0]!.name).toBe("Card");
  });

  it("more extra money never takes longer or costs more", () => {
    let prevMonths = Infinity;
    let prevInterest = Infinity;
    for (const extraMonthly of [0, 25, 100, 300, 1_000]) {
      const r = run({ debts, extraMonthly }).avalanche;
      expect(r.months!).toBeLessThanOrEqual(prevMonths);
      expect(r.totalInterest).toBeLessThanOrEqual(prevInterest);
      prevMonths = r.months!;
      prevInterest = r.totalInterest;
    }
  });
});

describe("edge cases", () => {
  it("with one debt, both methods match the credit card calculator", () => {
    const single: DebtPlanInput = {
      debts: [{ name: "Card", balance: 5_000, aprPct: 18, minPayment: 200 }],
      extraMonthly: 0,
    };
    const r = run(single);
    const card = calculateCreditCard({
      mode: "payment",
      balance: 5_000,
      aprPct: 18,
      monthlyPayment: 200,
      targetMonths: 0,
    });
    if (!card.ok) throw new Error("card");
    for (const s of [r.snowball, r.avalanche, r.minimumOnly]) {
      expect(s.months).toBe(card.result.months);
      expect(s.totalInterest).toBeCloseTo(card.result.totalInterest, 6);
    }
  });

  it("at 0% interest the budget clears the debts in ceil(total / budget) months", () => {
    const zero: DebtPlanInput = {
      debts: [
        { name: "A", balance: 1_000, aprPct: 0, minPayment: 50 },
        { name: "B", balance: 500, aprPct: 0, minPayment: 25 },
      ],
      extraMonthly: 25,
    };
    const r = run(zero);
    expect(r.snowball.months).toBe(15); // 1,500 / 100
    expect(r.snowball.totalInterest).toBe(0);
    // B gets its $25 minimum plus the $25 extra, plus the $25 of spare budget once A is covered: 50/month.
    expect(r.snowball.payoffOrder[0]).toEqual({ name: "B", month: 10 });
    expect(r.minimumOnly.months).toBe(20); // 1,000 / 50 with no rollover
  });

  it("handles a debt smaller than its minimum payment", () => {
    const r = run({
      debts: [{ name: "Tiny", balance: 20, aprPct: 20, minPayment: 100 }],
      extraMonthly: 0,
    });
    expect(r.snowball.months).toBe(1);
    expect(r.snowball.totalPaid).toBeCloseTo(20 + (20 * 0.2) / 12, 8);
  });

  it("returns null months when minimums do not cover the interest", () => {
    const r = run({
      debts: [{ name: "Trap", balance: 10_000, aprPct: 24, minPayment: 100 }],
      extraMonthly: 0,
    });
    expect(r.minimumOnly.months).toBeNull();
    expect(r.snowball.months).toBeNull();
  });

  it("an extra payment can rescue a plan whose minimums are too low", () => {
    const r = run({
      debts: [{ name: "Trap", balance: 10_000, aprPct: 24, minPayment: 100 }],
      extraMonthly: 400,
    });
    expect(r.snowball.months).not.toBeNull();
    expect(r.minimumOnly.months).toBeNull();
  });

  it("handles large balances", () => {
    const r = run({
      debts: [{ name: "Big", balance: 5e7, aprPct: 6, minPayment: 400_000 }],
      extraMonthly: 0,
    });
    expect(r.snowball.months).not.toBeNull();
  });
});

describe("validateDebtPlan", () => {
  it("accepts valid input", () => {
    expect(validateDebtPlan(plan)).toEqual({});
  });
  it("requires at least one debt and at most ten", () => {
    expect(validateDebtPlan({ debts: [], extraMonthly: 0 }).debts).toBeDefined();
    const many = Array.from({ length: 11 }, (_, i) => ({
      name: `D${i}`,
      balance: 100,
      aprPct: 10,
      minPayment: 10,
    }));
    expect(validateDebtPlan({ debts: many, extraMonthly: 0 }).debts).toBeDefined();
  });
  it("flags negative extra", () => {
    expect(validateDebtPlan({ debts, extraMonthly: -1 }).extraMonthly).toBeDefined();
  });
  it("reports problems per debt", () => {
    const errors = validateDebtPlan({
      debts: [
        { name: "ok", balance: 100, aprPct: 10, minPayment: 10 },
        { name: "bad", balance: 0, aprPct: 150, minPayment: -1 },
      ],
      extraMonthly: 0,
    });
    expect(errors.debtFields?.[0]).toBeUndefined();
    expect(Object.keys(errors.debtFields![1]!).sort()).toEqual(["aprPct", "balance", "minPayment"]);
  });
  it("returns errors instead of a result", () => {
    expect(calculateDebtPlan({ debts: [], extraMonthly: 0 }).ok).toBe(false);
  });
});
