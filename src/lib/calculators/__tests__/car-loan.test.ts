import { describe, expect, it } from "vitest";
import { calculateCarLoan, validateCarLoan, type CarLoanInput } from "../car-loan";

// Reference: $30,000 car, $5,000 down, $3,000 trade-in, 7% sales tax, $500 fees, 6% for 60 months.
//   Tax on (price - trade-in): 27,000 x 7% = 1,890 -> financed 24,390 -> $471.53/month
//   Tax on full price:         30,000 x 7% = 2,100 -> financed 24,600 -> $475.59/month
// (payments from the standard EMI formula, evaluated independently)

const base: CarLoanInput = {
  price: 30_000,
  downPayment: 5_000,
  tradeInValue: 3_000,
  tradeInOwed: 0,
  salesTaxPct: 7,
  taxAfterTradeIn: true,
  fees: 500,
  annualRatePct: 6,
  termMonths: 60,
};

function run(overrides: Partial<CarLoanInput> = {}) {
  const out = calculateCarLoan({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("calculateCarLoan", () => {
  it("taxes the price minus trade-in when that rule applies", () => {
    const r = run();
    expect(r.salesTax).toBeCloseTo(1_890, 8);
    expect(r.amountFinanced).toBeCloseTo(24_390, 8);
    expect(r.monthlyPayment).toBeCloseTo(471.53, 2);
  });

  it("taxes the full price otherwise", () => {
    const r = run({ taxAfterTradeIn: false });
    expect(r.salesTax).toBeCloseTo(2_100, 8);
    expect(r.amountFinanced).toBeCloseTo(24_600, 8);
    expect(r.monthlyPayment).toBeCloseTo(475.59, 2);
  });

  it("computes out-the-door price and total cost including interest", () => {
    const r = run();
    expect(r.outTheDoorPrice).toBeCloseTo(32_390, 8);
    expect(r.totalCost).toBeCloseTo(32_390 + r.totalInterest, 8);
    expect(r.loan!.schedule[r.loan!.schedule.length - 1]!.balance).toBe(0);
  });

  it("rolls negative equity from the trade-in into the loan", () => {
    const r = run({ tradeInOwed: 4_000 });
    expect(r.amountFinanced).toBeCloseTo(24_390 + 4_000, 8);
  });

  it("handles 0% financing", () => {
    const r = run({ annualRatePct: 0 });
    expect(r.totalInterest).toBe(0);
    expect(r.monthlyPayment).toBeCloseTo(24_390 / 60, 8);
  });

  it("returns no loan when cash and trade-in cover everything", () => {
    const r = run({ downPayment: 40_000 });
    expect(r.loan).toBeNull();
    expect(r.amountFinanced).toBe(0);
    expect(r.monthlyPayment).toBe(0);
  });

  it("a larger down payment never raises the payment", () => {
    let prev = Infinity;
    for (const downPayment of [0, 2_000, 5_000, 10_000, 20_000]) {
      const m = run({ downPayment }).monthlyPayment;
      expect(m).toBeLessThan(prev);
      prev = m;
    }
  });

  it("a longer term lowers the payment but raises total interest", () => {
    const short = run({ termMonths: 36 });
    const long = run({ termMonths: 84 });
    expect(long.monthlyPayment).toBeLessThan(short.monthlyPayment);
    expect(long.totalInterest).toBeGreaterThan(short.totalInterest);
  });

  it("handles 1-month and 120-month terms", () => {
    expect(run({ termMonths: 1 }).loan!.months).toBe(1);
    expect(run({ termMonths: 120 }).loan!.months).toBe(120);
  });

  it("never taxes a negative amount when the trade-in exceeds the price", () => {
    const r = run({ tradeInValue: 50_000, downPayment: 0 });
    expect(r.salesTax).toBe(0);
  });
});

describe("validateCarLoan", () => {
  it("accepts valid input", () => {
    expect(validateCarLoan(base)).toEqual({});
  });
  it.each([
    ["price", { price: 0 }],
    ["downPayment", { downPayment: -1 }],
    ["tradeInValue", { tradeInValue: -1 }],
    ["tradeInOwed", { tradeInOwed: -1 }],
    ["fees", { fees: -1 }],
    ["salesTaxPct", { salesTaxPct: 31 }],
    ["annualRatePct", { annualRatePct: -1 }],
    ["termMonths", { termMonths: 0 }],
    ["termMonths", { termMonths: 121 }],
    ["termMonths", { termMonths: 60.5 }],
    ["price", { price: Number.NaN }],
  ])("flags %s", (field, override) => {
    expect(validateCarLoan({ ...base, ...override })[field as keyof CarLoanInput]).toBeDefined();
  });
  it("returns errors instead of a result", () => {
    expect(calculateCarLoan({ ...base, price: -5 }).ok).toBe(false);
  });
});
