/**
 * Credit card payoff. Interest accrues monthly at APR / 12 on the balance, and the fixed payment
 * is applied after interest. The final payment is whatever is left.
 */

export type CardMode = "payment" | "target";

export type CreditCardInput = {
  mode: CardMode;
  balance: number;
  aprPct: number;
  /** Used when mode = "payment". */
  monthlyPayment: number;
  /** Used when mode = "target": payoff goal in months. */
  targetMonths: number;
};

export type CreditCardField = keyof CreditCardInput;
export type CreditCardErrors = Partial<Record<CreditCardField, string>>;

export type CardRow = {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
  /** Interest charged from the start through this month. */
  cumulativeInterest: number;
};

export type CreditCardResult = {
  mode: CardMode;
  /** Payment used (entered, or solved for in target mode). */
  monthlyPayment: number;
  /** Interest charged in the first month; a payment at or below this never pays the card off. */
  firstMonthInterest: number;
  /** True when the payment does not reduce the balance, or payoff would take over 100 years. */
  neverPaysOff: boolean;
  months: number | null;
  totalInterest: number;
  totalPaid: number;
  schedule: CardRow[];
};

export type CreditCardOutcome =
  { ok: true; result: CreditCardResult } | { ok: false; errors: CreditCardErrors };

export const MAX_CARD_MONTHS = 1200;

export function validateCreditCard(input: CreditCardInput): CreditCardErrors {
  const errors: CreditCardErrors = {};
  const ok = Number.isFinite;
  if (!ok(input.balance) || input.balance <= 0) errors.balance = "Enter a balance above 0.";
  if (!ok(input.aprPct) || input.aprPct < 0 || input.aprPct > 100) {
    errors.aprPct = "Enter an APR between 0% and 100%.";
  }
  if (input.mode === "payment") {
    if (!ok(input.monthlyPayment) || input.monthlyPayment <= 0) {
      errors.monthlyPayment = "Enter a monthly payment above 0.";
    }
  } else if (
    !Number.isInteger(input.targetMonths) ||
    input.targetMonths < 1 ||
    input.targetMonths > 600
  ) {
    errors.targetMonths = "Enter a whole number of months from 1 to 600.";
  }
  return errors;
}

/** Payment that clears `balance` in exactly `months` payments. */
export function paymentForTarget(balance: number, aprPct: number, months: number): number {
  const r = aprPct / 12 / 100;
  if (r === 0) return balance / months;
  return (balance * r) / (1 - Math.pow(1 + r, -months));
}

export function calculateCreditCard(input: CreditCardInput): CreditCardOutcome {
  const errors = validateCreditCard(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const r = input.aprPct / 12 / 100;
  const firstMonthInterest = input.balance * r;
  const payment =
    input.mode === "target"
      ? paymentForTarget(input.balance, input.aprPct, input.targetMonths)
      : input.monthlyPayment;
  const limit = input.mode === "target" ? input.targetMonths : MAX_CARD_MONTHS;

  // A payment that does not exceed the first month's interest never reduces the balance.
  if (input.mode === "payment" && payment <= firstMonthInterest) {
    return {
      ok: true,
      result: {
        mode: input.mode,
        monthlyPayment: payment,
        firstMonthInterest,
        neverPaysOff: true,
        months: null,
        totalInterest: 0,
        totalPaid: 0,
        schedule: [],
      },
    };
  }

  const schedule: CardRow[] = [];
  let balance = input.balance;
  let totalInterest = 0;
  let totalPaid = 0;

  for (let month = 1; month <= limit && balance > 0; month++) {
    const interest = balance * r;
    // Pay off exactly when the payment covers the rest, or on the target month (absorbs rounding error).
    const owed = balance + interest;
    const paid = payment >= owed || (input.mode === "target" && month === limit) ? owed : payment;
    const closing = paid === owed ? 0 : owed - paid;
    schedule.push({
      month,
      payment: paid,
      interest,
      principal: paid - interest,
      balance: closing,
      cumulativeInterest: totalInterest + interest,
    });
    totalInterest += interest;
    totalPaid += paid;
    balance = closing;
  }

  if (balance > 0) {
    return {
      ok: true,
      result: {
        mode: input.mode,
        monthlyPayment: payment,
        firstMonthInterest,
        neverPaysOff: true,
        months: null,
        totalInterest: 0,
        totalPaid: 0,
        schedule: [],
      },
    };
  }

  return {
    ok: true,
    result: {
      mode: input.mode,
      monthlyPayment: payment,
      firstMonthInterest,
      neverPaysOff: false,
      months: schedule.length,
      totalInterest,
      totalPaid,
      schedule,
    },
  };
}
