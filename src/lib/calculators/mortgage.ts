import { amortize, type AmortizationResult, type ScheduleRow } from "./amortization";

export type MortgageInput = {
  homePrice: number;
  /** Down payment in dollars. */
  downPayment: number;
  annualRatePct: number;
  termYears: number;
  /** Annual property tax as a percent of home price. */
  propertyTaxPct: number;
  /** Annual home insurance premium in dollars. */
  insuranceAnnual: number;
  /** Monthly HOA dues in dollars. */
  hoaMonthly: number;
  /** Annual PMI rate as a percent of the original loan; applies while the balance exceeds 80% of the home price. */
  pmiRatePct: number;
  extraMonthly: number;
  extraYearly: number;
  oneTimeExtra: number;
  /** 1-based payment number in which the one-time extra is paid. */
  oneTimeMonth: number;
};

export type MortgageField = keyof MortgageInput;
export type MortgageErrors = Partial<Record<MortgageField, string>>;

export type MortgageRow = ScheduleRow & {
  /** PMI charged this month (0 once the balance falls to 80% of the home price). */
  pmi: number;
};

export type MortgageResult = {
  loanAmount: number;
  downPaymentPct: number;
  /** Principal and interest only, before extra payments. */
  monthlyPrincipalInterest: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  monthlyHoa: number;
  /** PMI in the first month. */
  monthlyPmi: number;
  /** First-month total: P&I + tax + insurance + HOA + PMI. */
  monthlyTotal: number;
  /** Payment number after which PMI stops, or null if no PMI applies. */
  pmiEndsAfterMonth: number | null;
  months: number;
  totalInterest: number;
  /** Sum of principal and interest payments. */
  totalPaid: number;
  schedule: MortgageRow[];
  /** What the loan would cost without any extra payments. */
  baseline: Pick<AmortizationResult, "months" | "totalInterest" | "totalPaid">;
  interestSaved: number;
  monthsSaved: number;
};

export type MortgageOutcome =
  { ok: true; result: MortgageResult } | { ok: false; errors: MortgageErrors };

export const MAX_TERM_YEARS = 50;
export const PMI_LTV_THRESHOLD = 0.8;

export function validateMortgage(input: MortgageInput): MortgageErrors {
  const errors: MortgageErrors = {};
  const num = (v: number) => Number.isFinite(v);

  if (!num(input.homePrice) || input.homePrice <= 0)
    errors.homePrice = "Enter a home price above 0.";
  if (!num(input.downPayment) || input.downPayment < 0) {
    errors.downPayment = "Enter a down payment of 0 or more.";
  } else if (num(input.homePrice) && input.downPayment >= input.homePrice) {
    errors.downPayment = "Down payment must be less than the home price.";
  }
  if (!num(input.annualRatePct) || input.annualRatePct < 0 || input.annualRatePct > 50) {
    errors.annualRatePct = "Enter a rate between 0% and 50%.";
  }
  if (!num(input.termYears) || input.termYears < 1 || input.termYears > MAX_TERM_YEARS) {
    errors.termYears = `Enter a term between 1 and ${MAX_TERM_YEARS} years.`;
  }
  const nonNegative: Array<[MortgageField, string]> = [
    ["propertyTaxPct", "Property tax"],
    ["insuranceAnnual", "Insurance"],
    ["hoaMonthly", "HOA"],
    ["pmiRatePct", "PMI"],
    ["extraMonthly", "Extra monthly payment"],
    ["extraYearly", "Extra yearly payment"],
    ["oneTimeExtra", "One-time payment"],
  ];
  for (const [field, name] of nonNegative) {
    if (!num(input[field]) || input[field] < 0) errors[field] = `${name} cannot be negative.`;
  }
  if (num(input.oneTimeExtra) && input.oneTimeExtra > 0) {
    if (!Number.isInteger(input.oneTimeMonth) || input.oneTimeMonth < 1) {
      errors.oneTimeMonth = "Enter a payment number of 1 or more.";
    }
  }
  return errors;
}

export function calculateMortgage(input: MortgageInput): MortgageOutcome {
  const errors = validateMortgage(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const loanAmount = input.homePrice - input.downPayment;
  const termMonths = Math.round(input.termYears * 12);

  const base = {
    principal: loanAmount,
    annualRatePct: input.annualRatePct,
    termMonths,
  };
  const withExtras = amortize({
    ...base,
    extraMonthly: input.extraMonthly,
    extraYearly: input.extraYearly,
    oneTime:
      input.oneTimeExtra > 0
        ? { amount: input.oneTimeExtra, month: input.oneTimeMonth }
        : undefined,
  });
  const baseline = amortize(base);

  const monthlyPmiAmount = (loanAmount * input.pmiRatePct) / 100 / 12;
  const pmiLimit = input.homePrice * PMI_LTV_THRESHOLD;
  let pmiEndsAfterMonth: number | null = null;
  const schedule: MortgageRow[] = withExtras.schedule.map((row) => {
    const charged = input.pmiRatePct > 0 && row.openingBalance > pmiLimit;
    if (charged) pmiEndsAfterMonth = row.month;
    return { ...row, pmi: charged ? monthlyPmiAmount : 0 };
  });

  const monthlyPropertyTax = (input.homePrice * input.propertyTaxPct) / 100 / 12;
  const monthlyInsurance = input.insuranceAnnual / 12;
  const monthlyPmi = schedule[0]?.pmi ?? 0;

  return {
    ok: true,
    result: {
      loanAmount,
      downPaymentPct: (input.downPayment / input.homePrice) * 100,
      monthlyPrincipalInterest: withExtras.monthlyPayment,
      monthlyPropertyTax,
      monthlyInsurance,
      monthlyHoa: input.hoaMonthly,
      monthlyPmi,
      monthlyTotal:
        withExtras.monthlyPayment +
        monthlyPropertyTax +
        monthlyInsurance +
        input.hoaMonthly +
        monthlyPmi,
      pmiEndsAfterMonth,
      months: withExtras.months,
      totalInterest: withExtras.totalInterest,
      totalPaid: withExtras.totalPaid,
      schedule,
      baseline: {
        months: baseline.months,
        totalInterest: baseline.totalInterest,
        totalPaid: baseline.totalPaid,
      },
      interestSaved: baseline.totalInterest - withExtras.totalInterest,
      monthsSaved: baseline.months - withExtras.months,
    },
  };
}

/** Convert a down payment given as a percent of price into dollars. */
export function downPaymentFromPercent(homePrice: number, percent: number): number {
  return (homePrice * percent) / 100;
}

/** Calendar month/year of the nth payment (1-based), given the first payment's month (1-12) and year. */
export function paymentDate(
  firstMonth: number,
  firstYear: number,
  paymentNumber: number,
): { month: number; year: number } {
  const index = firstYear * 12 + (firstMonth - 1) + (paymentNumber - 1);
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}
