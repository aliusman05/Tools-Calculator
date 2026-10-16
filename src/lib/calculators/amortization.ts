/**
 * Generic fixed-rate amortization engine. Pure math: no React, no DOM.
 *
 * Money is kept as unrounded floating-point dollars; rounding happens only when values are
 * displayed. The final payment is the remaining balance plus interest, so the balance ends at
 * exactly 0.
 */

export type AmortizationInput = {
  /** Amount borrowed, in dollars. */
  principal: number;
  /** Nominal annual rate in percent, e.g. 6.5 for 6.5%. */
  annualRatePct: number;
  /** Term in months. Must be a positive integer. */
  termMonths: number;
  /** Extra principal paid every month. */
  extraMonthly?: number;
  /** Extra principal paid at the end of every 12th month (months 12, 24, ...). */
  extraYearly?: number;
  /** One-time extra principal paid in the given 1-based month. */
  oneTime?: { amount: number; month: number };
};

export type ScheduleRow = {
  /** 1-based payment number. */
  month: number;
  /** Balance before this payment. */
  openingBalance: number;
  /** Total paid this month: interest + all principal (scheduled + extra). */
  payment: number;
  /** Total principal repaid, including extra. */
  principal: number;
  interest: number;
  /** Portion of `principal` that was extra. */
  extra: number;
  /** Balance after this payment. Exactly 0 on the last row. */
  balance: number;
};

export type AmortizationResult = {
  /** Scheduled payment (principal + interest) before any extra payments. */
  monthlyPayment: number;
  schedule: ScheduleRow[];
  /** Number of payments actually made. */
  months: number;
  totalInterest: number;
  /** Sum of all payments (principal + interest). */
  totalPaid: number;
};

function assertValid(input: AmortizationInput): void {
  const { principal, annualRatePct, termMonths } = input;
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new RangeError("principal must be a positive number");
  }
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) {
    throw new RangeError("annualRatePct must be zero or greater");
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new RangeError("termMonths must be a positive integer");
  }
  const extras = [input.extraMonthly ?? 0, input.extraYearly ?? 0, input.oneTime?.amount ?? 0];
  if (extras.some((x) => !Number.isFinite(x) || x < 0)) {
    throw new RangeError("extra payments must be zero or greater");
  }
  if (input.oneTime && (!Number.isInteger(input.oneTime.month) || input.oneTime.month < 1)) {
    throw new RangeError("oneTime.month must be a positive integer");
  }
}

/** Level monthly payment: M = P * r(1+r)^n / ((1+r)^n - 1), or P / n when r = 0. */
export function monthlyPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  assertValid({ principal, annualRatePct, termMonths });
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / termMonths;
  const growth = Math.pow(1 + r, termMonths);
  return (principal * r * growth) / (growth - 1);
}

export function amortize(input: AmortizationInput): AmortizationResult {
  assertValid(input);
  const { principal, annualRatePct, termMonths } = input;
  const r = annualRatePct / 12 / 100;
  const payment = monthlyPayment(principal, annualRatePct, termMonths);

  const schedule: ScheduleRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;

  for (let month = 1; month <= termMonths && balance > 0; month++) {
    const interest = balance * r;
    const scheduledPrincipal = payment - interest;
    const extra =
      (input.extraMonthly ?? 0) +
      (month % 12 === 0 ? (input.extraYearly ?? 0) : 0) +
      (input.oneTime && input.oneTime.month === month ? input.oneTime.amount : 0);

    const isLastScheduled = month === termMonths;
    const wanted = scheduledPrincipal + extra;
    // Pay off exactly when this is the last scheduled month or the payment would cover the rest.
    const principalPaid = isLastScheduled || wanted >= balance ? balance : wanted;
    const extraApplied = Math.min(extra, Math.max(0, principalPaid - scheduledPrincipal));
    const closing = principalPaid === balance ? 0 : balance - principalPaid;

    schedule.push({
      month,
      openingBalance: balance,
      payment: interest + principalPaid,
      principal: principalPaid,
      interest,
      extra: extraApplied,
      balance: closing,
    });
    totalInterest += interest;
    totalPaid += interest + principalPaid;
    balance = closing;
  }

  return {
    monthlyPayment: payment,
    schedule,
    months: schedule.length,
    totalInterest,
    totalPaid,
  };
}

export type YearRow = {
  year: number;
  payment: number;
  principal: number;
  interest: number;
  extra: number;
  /** Balance at the end of the year. */
  balance: number;
};

/** Roll monthly rows up into loan years (months 1-12 = year 1, and so on). */
export function aggregateByYear(schedule: readonly ScheduleRow[]): YearRow[] {
  const years: YearRow[] = [];
  for (const row of schedule) {
    const year = Math.ceil(row.month / 12);
    let y = years[year - 1];
    if (!y) {
      y = { year, payment: 0, principal: 0, interest: 0, extra: 0, balance: 0 };
      years[year - 1] = y;
    }
    y.payment += row.payment;
    y.principal += row.principal;
    y.interest += row.interest;
    y.extra += row.extra;
    y.balance = row.balance;
  }
  return years;
}

export type BalancePoint = {
  /** Loan year; 0 is the start of the loan. */
  year: number;
  /** Remaining balance at the end of the year. */
  balance: number;
  /** Interest paid from the start of the loan through the end of the year. */
  cumulativeInterest: number;
};

/** Year-by-year balance and running interest, starting from year 0, for charts. */
export function balanceSeries(principal: number, schedule: readonly ScheduleRow[]): BalancePoint[] {
  const points: BalancePoint[] = [{ year: 0, balance: principal, cumulativeInterest: 0 }];
  let cumulativeInterest = 0;
  for (const y of aggregateByYear(schedule)) {
    cumulativeInterest += y.interest;
    points.push({ year: y.year, balance: y.balance, cumulativeInterest });
  }
  return points;
}
