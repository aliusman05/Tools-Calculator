import { amortize, type AmortizationResult } from "./amortization";

export type CarLoanInput = {
  price: number;
  downPayment: number;
  tradeInValue: number;
  /** Loan balance still owed on the trade-in; rolled into the new loan. */
  tradeInOwed: number;
  salesTaxPct: number;
  /** True when sales tax applies only to the price minus the trade-in value (common in many states). */
  taxAfterTradeIn: boolean;
  /** Title, registration, documentation and similar fees paid up front or financed. */
  fees: number;
  annualRatePct: number;
  termMonths: number;
};

export type CarLoanField = keyof CarLoanInput;
export type CarLoanErrors = Partial<Record<CarLoanField, string>>;

export type CarLoanResult = {
  salesTax: number;
  /** Price + sales tax + fees. */
  outTheDoorPrice: number;
  amountFinanced: number;
  /** Null when the down payment and trade-in cover everything. */
  loan: AmortizationResult | null;
  monthlyPayment: number;
  totalInterest: number;
  /** Out-the-door price plus all the interest paid on the loan. */
  totalCost: number;
};

export type CarLoanOutcome =
  { ok: true; result: CarLoanResult } | { ok: false; errors: CarLoanErrors };

export const MAX_CAR_TERM = 120;

export function validateCarLoan(input: CarLoanInput): CarLoanErrors {
  const errors: CarLoanErrors = {};
  const ok = Number.isFinite;
  if (!ok(input.price) || input.price <= 0) errors.price = "Enter a vehicle price above 0.";
  for (const [field, label] of [
    ["downPayment", "Down payment"],
    ["tradeInValue", "Trade-in value"],
    ["tradeInOwed", "Amount owed"],
    ["fees", "Fees"],
  ] as const) {
    if (!ok(input[field]) || input[field] < 0) errors[field] = `${label} cannot be negative.`;
  }
  if (!ok(input.salesTaxPct) || input.salesTaxPct < 0 || input.salesTaxPct > 30) {
    errors.salesTaxPct = "Enter a sales tax between 0% and 30%.";
  }
  if (!ok(input.annualRatePct) || input.annualRatePct < 0 || input.annualRatePct > 50) {
    errors.annualRatePct = "Enter a rate between 0% and 50%.";
  }
  if (
    !Number.isInteger(input.termMonths) ||
    input.termMonths < 1 ||
    input.termMonths > MAX_CAR_TERM
  ) {
    errors.termMonths = `Enter a whole number of months from 1 to ${MAX_CAR_TERM}.`;
  }
  return errors;
}

export function calculateCarLoan(input: CarLoanInput): CarLoanOutcome {
  const errors = validateCarLoan(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const taxable = Math.max(0, input.price - (input.taxAfterTradeIn ? input.tradeInValue : 0));
  const salesTax = (taxable * input.salesTaxPct) / 100;
  const outTheDoorPrice = input.price + salesTax + input.fees;
  const amountFinanced =
    outTheDoorPrice - input.downPayment - input.tradeInValue + input.tradeInOwed;

  if (amountFinanced <= 0) {
    return {
      ok: true,
      result: {
        salesTax,
        outTheDoorPrice,
        amountFinanced: 0,
        loan: null,
        monthlyPayment: 0,
        totalInterest: 0,
        totalCost: outTheDoorPrice,
      },
    };
  }

  const loan = amortize({
    principal: amountFinanced,
    annualRatePct: input.annualRatePct,
    termMonths: input.termMonths,
  });

  return {
    ok: true,
    result: {
      salesTax,
      outTheDoorPrice,
      amountFinanced,
      loan,
      monthlyPayment: loan.monthlyPayment,
      totalInterest: loan.totalInterest,
      totalCost: outTheDoorPrice + loan.totalInterest,
    },
  };
}
