/**
 * Debt payoff planner: snowball (smallest balance first) vs avalanche (highest APR first).
 *
 * Each month interest accrues on every debt, every debt receives at least its minimum payment,
 * and the rest of a fixed monthly budget (sum of minimums + extra) goes to the current target
 * debt, spilling over to the next. When a debt is paid off its minimum "rolls over" into the
 * budget, which is what makes both methods faster than paying minimums alone.
 */

export type Debt = {
  name: string;
  balance: number;
  aprPct: number;
  minPayment: number;
};

export type DebtPlanInput = {
  debts: Debt[];
  /** Extra amount paid each month on top of all the minimums. */
  extraMonthly: number;
};

export type DebtPlanErrors = {
  debts?: string;
  extraMonthly?: string;
  /** Per-debt messages, keyed by index. */
  debtFields?: Record<number, Partial<Record<keyof Debt, string>>>;
};

export type Strategy = "snowball" | "avalanche" | "minimum";

export type PayoffEvent = { name: string; month: number };

export type StrategyResult = {
  strategy: Strategy;
  /** Months until every debt is gone; null if not paid off within MAX_PLAN_MONTHS. */
  months: number | null;
  totalInterest: number;
  totalPaid: number;
  /** In the order the debts were cleared. */
  payoffOrder: PayoffEvent[];
  /** Total remaining balance at the end of each month; index 0 is the starting balance. */
  balanceByMonth: number[];
};

export type DebtPlanResult = {
  totalBalance: number;
  totalMinimum: number;
  snowball: StrategyResult;
  avalanche: StrategyResult;
  /** Paying only the minimums on each debt, with no rollover and no extra. */
  minimumOnly: StrategyResult;
  /** Interest avoided by the avalanche plan compared with the snowball plan (>= 0 in practice). */
  avalancheAdvantage: number;
};

export type DebtPlanOutcome =
  { ok: true; result: DebtPlanResult } | { ok: false; errors: DebtPlanErrors };

export const MAX_PLAN_MONTHS = 1200;
export const MAX_DEBTS = 10;
const EPSILON = 1e-9;

export function validateDebtPlan(input: DebtPlanInput): DebtPlanErrors {
  const errors: DebtPlanErrors = {};
  if (input.debts.length === 0) errors.debts = "Add at least one debt.";
  if (input.debts.length > MAX_DEBTS) errors.debts = `You can compare up to ${MAX_DEBTS} debts.`;
  if (!Number.isFinite(input.extraMonthly) || input.extraMonthly < 0) {
    errors.extraMonthly = "Extra payment cannot be negative.";
  }
  input.debts.forEach((d, i) => {
    const e: Partial<Record<keyof Debt, string>> = {};
    if (!Number.isFinite(d.balance) || d.balance <= 0) e.balance = "Enter a balance above 0.";
    if (!Number.isFinite(d.aprPct) || d.aprPct < 0 || d.aprPct > 100)
      e.aprPct = "Enter 0% to 100%.";
    if (!Number.isFinite(d.minPayment) || d.minPayment < 0) e.minPayment = "Cannot be negative.";
    if (Object.keys(e).length > 0) (errors.debtFields ??= {})[i] = e;
  });
  return errors;
}

type Order = (a: WorkingDebt, b: WorkingDebt) => number;
type WorkingDebt = Debt & { remaining: number; paidOffMonth: number | null };

const bySnowball: Order = (a, b) => a.remaining - b.remaining || b.aprPct - a.aprPct;
const byAvalanche: Order = (a, b) => b.aprPct - a.aprPct || a.remaining - b.remaining;

function simulate(input: DebtPlanInput, strategy: Strategy): StrategyResult {
  const debts: WorkingDebt[] = input.debts.map((d) => ({
    ...d,
    name: d.name,
    remaining: d.balance,
    paidOffMonth: null,
  }));
  const rollover = strategy !== "minimum";
  const budget =
    input.debts.reduce((s, d) => s + d.minPayment, 0) + (rollover ? input.extraMonthly : 0);
  const order = strategy === "snowball" ? bySnowball : byAvalanche;

  const balanceByMonth = [debts.reduce((s, d) => s + d.remaining, 0)];
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;

  while (debts.some((d) => d.remaining > EPSILON) && month < MAX_PLAN_MONTHS) {
    month++;
    let available = budget;

    for (const d of debts) {
      if (d.remaining <= EPSILON) continue;
      const interest = (d.remaining * d.aprPct) / 12 / 100;
      d.remaining += interest;
      totalInterest += interest;
      const pay = Math.min(d.minPayment, d.remaining);
      d.remaining -= pay;
      totalPaid += pay;
      available -= pay;
    }

    if (rollover) {
      // Direct leftover money to the highest-priority debt that still has a balance.
      for (const d of [...debts].sort(order)) {
        if (available <= EPSILON) break;
        if (d.remaining <= EPSILON) continue;
        const pay = Math.min(available, d.remaining);
        d.remaining -= pay;
        totalPaid += pay;
        available -= pay;
      }
    }

    for (const d of debts) {
      if (d.remaining <= EPSILON) {
        d.remaining = 0;
        d.paidOffMonth ??= month;
      }
    }
    balanceByMonth.push(debts.reduce((s, d) => s + d.remaining, 0));
  }

  const done = debts.every((d) => d.remaining === 0);
  return {
    strategy,
    months: done ? month : null,
    totalInterest,
    totalPaid,
    payoffOrder: debts
      .filter((d) => d.paidOffMonth !== null)
      .map((d) => ({ name: d.name, month: d.paidOffMonth as number }))
      .sort((a, b) => a.month - b.month),
    balanceByMonth,
  };
}

export function calculateDebtPlan(input: DebtPlanInput): DebtPlanOutcome {
  const errors = validateDebtPlan(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const snowball = simulate(input, "snowball");
  const avalanche = simulate(input, "avalanche");
  const minimumOnly = simulate(input, "minimum");

  return {
    ok: true,
    result: {
      totalBalance: input.debts.reduce((s, d) => s + d.balance, 0),
      totalMinimum: input.debts.reduce((s, d) => s + d.minPayment, 0),
      snowball,
      avalanche,
      minimumOnly,
      avalancheAdvantage: snowball.totalInterest - avalanche.totalInterest,
    },
  };
}
