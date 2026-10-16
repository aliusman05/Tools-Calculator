/**
 * Savings goal math. Assumes the stated annual rate is compounded monthly and deposits are made
 * at the end of each month.
 */

export type SavingsGoalMode = "contribution" | "time";

export type SavingsGoalInput = {
  mode: SavingsGoalMode;
  target: number;
  current: number;
  annualRatePct: number;
  /** Used when mode = "contribution": years until the goal date. */
  years: number;
  /** Used when mode = "time": amount saved each month. */
  monthlyContribution: number;
};

export type SavingsGoalField = keyof SavingsGoalInput;
export type SavingsGoalErrors = Partial<Record<SavingsGoalField, string>>;

export type SavingsYearRow = {
  year: number;
  balance: number;
  totalDeposited: number;
  interest: number;
};

export type SavingsGoalResult = {
  mode: SavingsGoalMode;
  /** Monthly deposit required (contribution mode) or provided (time mode). */
  monthlyContribution: number;
  /** Months until the balance reaches the target; null if it never will within the limit. */
  months: number | null;
  /** True when the current savings alone already reach the target in time. */
  alreadyThere: boolean;
  totalDeposited: number;
  interestEarned: number;
  finalBalance: number;
  schedule: SavingsYearRow[];
};

export type SavingsGoalOutcome =
  { ok: true; result: SavingsGoalResult } | { ok: false; errors: SavingsGoalErrors };

export const MAX_GOAL_MONTHS = 1200;

export function validateSavingsGoal(input: SavingsGoalInput): SavingsGoalErrors {
  const errors: SavingsGoalErrors = {};
  const ok = Number.isFinite;
  if (!ok(input.target) || input.target <= 0) errors.target = "Enter a goal above 0.";
  if (!ok(input.current) || input.current < 0)
    errors.current = "Current savings cannot be negative.";
  if (!ok(input.annualRatePct) || input.annualRatePct < 0 || input.annualRatePct > 50) {
    errors.annualRatePct = "Enter a rate between 0% and 50%.";
  }
  if (input.mode === "contribution") {
    if (!ok(input.years) || Math.round(input.years * 12) < 1 || input.years > 100) {
      errors.years = "Enter a time between 1 month and 100 years.";
    }
  } else if (!ok(input.monthlyContribution) || input.monthlyContribution < 0) {
    errors.monthlyContribution = "Monthly saving cannot be negative.";
  }
  return errors;
}

/** Deposit needed each month to turn `current` into `target` in `months` months. 0 if already on track. */
export function requiredMonthlyContribution(
  target: number,
  current: number,
  annualRatePct: number,
  months: number,
): number {
  const i = annualRatePct / 12 / 100;
  const growth = Math.pow(1 + i, months);
  const shortfall = target - current * growth;
  if (shortfall <= 0) return 0;
  return i === 0 ? shortfall / months : (shortfall * i) / (growth - 1);
}

/** Whole months needed to reach `target`, or null if it cannot happen within MAX_GOAL_MONTHS. */
export function monthsToGoal(
  target: number,
  current: number,
  monthly: number,
  annualRatePct: number,
): number | null {
  if (current >= target) return 0;
  const i = annualRatePct / 12 / 100;
  let exact: number;
  if (i === 0) {
    if (monthly <= 0) return null;
    exact = (target - current) / monthly;
  } else {
    const denominator = current * i + monthly;
    if (denominator <= 0) return null;
    exact = Math.log((target * i + monthly) / denominator) / Math.log(1 + i);
  }
  // Guard against floating-point error pushing an exact answer just over a whole number.
  const months = Math.ceil(exact - 1e-9);
  return months > MAX_GOAL_MONTHS ? null : Math.max(months, 0);
}

function buildSchedule(
  current: number,
  monthly: number,
  annualRatePct: number,
  months: number,
): { schedule: SavingsYearRow[]; balance: number; deposited: number; interest: number } {
  const i = annualRatePct / 12 / 100;
  let balance = current;
  let deposited = current;
  let interest = 0;
  const schedule: SavingsYearRow[] = [];
  for (let month = 1; month <= months; month++) {
    const earned = balance * i;
    balance += earned + monthly;
    interest += earned;
    deposited += monthly;
    if (month % 12 === 0 || month === months) {
      schedule.push({ year: Math.ceil(month / 12), balance, totalDeposited: deposited, interest });
    }
  }
  return { schedule, balance, deposited, interest };
}

export function calculateSavingsGoal(input: SavingsGoalInput): SavingsGoalOutcome {
  const errors = validateSavingsGoal(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  let monthly: number;
  let months: number | null;
  if (input.mode === "contribution") {
    months = Math.round(input.years * 12);
    monthly = requiredMonthlyContribution(input.target, input.current, input.annualRatePct, months);
  } else {
    monthly = input.monthlyContribution;
    months = monthsToGoal(input.target, input.current, monthly, input.annualRatePct);
  }

  if (months === null) {
    return {
      ok: true,
      result: {
        mode: input.mode,
        monthlyContribution: monthly,
        months: null,
        alreadyThere: false,
        totalDeposited: input.current,
        interestEarned: 0,
        finalBalance: input.current,
        schedule: [],
      },
    };
  }

  const built = buildSchedule(input.current, monthly, input.annualRatePct, months);
  return {
    ok: true,
    result: {
      mode: input.mode,
      monthlyContribution: monthly,
      months,
      alreadyThere: input.mode === "contribution" ? monthly === 0 : months === 0,
      totalDeposited: built.deposited,
      interestEarned: built.interest,
      finalBalance: built.balance,
      schedule: built.schedule,
    },
  };
}
