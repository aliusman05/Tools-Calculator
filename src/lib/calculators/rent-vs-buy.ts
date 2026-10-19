import { amortize } from "./amortization";

/**
 * Rent vs buy. Pure math: no React, no DOM.
 *
 * Both choices are simulated month by month with the same monthly budget. Whichever choice costs less
 * in a given month invests the difference, and the renter also invests the cash the buyer would spend
 * at closing (down payment and buying costs). At the end of the comparison the buyer sells the home.
 * The result is the difference in net worth.
 *
 *   owner outflow  = mortgage payment + property tax + insurance + maintenance + other monthly costs
 *   renter outflow = rent + renters insurance
 *   buyer net worth  = sale price - selling costs - loan balance + invested surplus
 *   renter net worth = invested down payment and buying costs + invested surplus
 *
 * Every assumption is an input. Not modelled: income tax effects (mortgage interest and property tax
 * deductions, capital gains, tax on investment returns), mortgage insurance, refinancing, moving
 * costs, and any change in income or household needs.
 */

export type RentVsBuyInput = {
  homePrice: number;
  downPaymentPct: number;
  mortgageRatePct: number;
  mortgageTermYears: number;
  /** Closing and other costs of buying, as a percent of the price, paid in cash. */
  buyingCostsPct: number;
  /** Yearly property tax as a percent of the home's value. */
  propertyTaxPct: number;
  homeInsuranceYearly: number;
  /** Yearly upkeep as a percent of the home's value. */
  maintenancePct: number;
  /** HOA dues, mortgage insurance and anything else paid monthly by an owner. */
  otherMonthlyCosts: number;
  /** Yearly change in the home's value. */
  appreciationPct: number;
  /** Agent and closing costs when selling, as a percent of the sale price. */
  sellingCostsPct: number;
  monthlyRent: number;
  rentGrowthPct: number;
  rentersInsuranceYearly: number;
  /** Yearly return on money that is invested instead of spent on housing. */
  investmentReturnPct: number;
  /** Yearly increase in insurance and other fixed monthly costs. */
  costGrowthPct: number;
  /** How long the comparison runs before the home is sold. */
  years: number;
};

export type RentVsBuyField = keyof RentVsBuyInput;
export type RentVsBuyErrors = Partial<Record<RentVsBuyField, string>>;

export type MonthOne = {
  mortgage: number;
  propertyTax: number;
  insurance: number;
  maintenance: number;
  other: number;
  ownerTotal: number;
  rent: number;
  rentersInsurance: number;
  renterTotal: number;
};

export type AdvantagePoint = {
  /** Years from the start; 0 is the day of purchase. */
  year: number;
  /** Buyer net worth minus renter net worth if the home were sold at that point. */
  advantage: number;
};

export type RentVsBuyResult = {
  loanAmount: number;
  downPayment: number;
  buyingCosts: number;
  /** Cash the buyer needs at closing. */
  cashAtClosing: number;
  mortgagePayment: number;
  monthOne: MonthOne;
  horizonMonths: number;
  homeValue: number;
  sellingCosts: number;
  loanBalance: number;
  buyerInvested: number;
  renterInvested: number;
  buyerNetWorth: number;
  renterNetWorth: number;
  /** Buyer minus renter at the end. Positive means buying comes out ahead. */
  advantage: number;
  /**
   * First month from which buying stays ahead for the rest of the comparison window (at least 30
   * years). null if buying never gets and stays ahead.
   */
  breakEvenMonth: number | null;
  series: AdvantagePoint[];
};

export type RentVsBuyOutcome =
  { ok: true; result: RentVsBuyResult } | { ok: false; errors: RentVsBuyErrors };

export const MAX_COMPARISON_YEARS = 40;
const WINDOW_MONTHS = 360;
/** Differences below a hundredth of a cent are floating-point noise, not a real gap. */
const EPSILON = 1e-6;

const num = (v: number) => Number.isFinite(v);

export function validateRentVsBuy(input: RentVsBuyInput): RentVsBuyErrors {
  const e: RentVsBuyErrors = {};
  const within = (v: number, lo: number, hi: number) => num(v) && v >= lo && v <= hi;
  if (!num(input.homePrice) || input.homePrice <= 0) e.homePrice = "Enter a home price above 0.";
  if (!within(input.downPaymentPct, 0, 100)) e.downPaymentPct = "Enter a percent from 0 to 100.";
  if (!within(input.mortgageRatePct, 0, 50)) e.mortgageRatePct = "Enter a rate between 0% and 50%.";
  if (!within(input.mortgageTermYears, 1, 40)) e.mortgageTermYears = "Enter 1 to 40 years.";
  if (!within(input.buyingCostsPct, 0, 20)) e.buyingCostsPct = "Enter a percent from 0 to 20.";
  if (!within(input.propertyTaxPct, 0, 10)) e.propertyTaxPct = "Enter a percent from 0 to 10.";
  if (!num(input.homeInsuranceYearly) || input.homeInsuranceYearly < 0) {
    e.homeInsuranceYearly = "Insurance cannot be negative.";
  }
  if (!within(input.maintenancePct, 0, 10)) e.maintenancePct = "Enter a percent from 0 to 10.";
  if (!num(input.otherMonthlyCosts) || input.otherMonthlyCosts < 0) {
    e.otherMonthlyCosts = "Other costs cannot be negative.";
  }
  if (!within(input.appreciationPct, -20, 20))
    e.appreciationPct = "Enter a percent from -20 to 20.";
  if (!within(input.sellingCostsPct, 0, 20)) e.sellingCostsPct = "Enter a percent from 0 to 20.";
  if (!num(input.monthlyRent) || input.monthlyRent <= 0) e.monthlyRent = "Enter a rent above 0.";
  if (!within(input.rentGrowthPct, -20, 30)) e.rentGrowthPct = "Enter a percent from -20 to 30.";
  if (!num(input.rentersInsuranceYearly) || input.rentersInsuranceYearly < 0) {
    e.rentersInsuranceYearly = "Insurance cannot be negative.";
  }
  if (!within(input.investmentReturnPct, -20, 30)) {
    e.investmentReturnPct = "Enter a percent from -20 to 30.";
  }
  if (!within(input.costGrowthPct, -10, 20)) e.costGrowthPct = "Enter a percent from -10 to 20.";
  if (!within(input.years, 1, MAX_COMPARISON_YEARS)) {
    e.years = `Enter 1 to ${MAX_COMPARISON_YEARS} years.`;
  }
  return e;
}

type Month = {
  advantage: number;
  homeValue: number;
  loanBalance: number;
  buyerInvested: number;
  renterInvested: number;
  ownerOutflow: number;
  renterOutflow: number;
};

type Sim = {
  loanAmount: number;
  downPayment: number;
  buyingCosts: number;
  mortgagePayment: number;
  monthOne: MonthOne;
  /** Index 0 is the day of purchase. */
  months: Month[];
};

/** Runs the model for `length` months. Assumes the input is valid. */
function simulate(input: RentVsBuyInput, length: number): Sim {
  const loanAmount = input.homePrice * (1 - input.downPaymentPct / 100);
  const downPayment = input.homePrice - loanAmount;
  const buyingCosts = input.homePrice * (input.buyingCostsPct / 100);
  const termMonths = Math.round(input.mortgageTermYears * 12);

  const loan =
    loanAmount > 0
      ? amortize({ principal: loanAmount, annualRatePct: input.mortgageRatePct, termMonths })
      : null;
  const mortgagePayment = loan ? loan.monthlyPayment : 0;

  const monthlyReturn = Math.pow(1 + input.investmentReturnPct / 100, 1 / 12) - 1;
  const homeValueAt = (m: number) =>
    input.homePrice * Math.pow(1 + input.appreciationPct / 100, m / 12);

  let renterInvested = downPayment + buyingCosts;
  let buyerInvested = 0;
  const months: Month[] = [
    {
      advantage: -(input.homePrice * (input.sellingCostsPct / 100)) - buyingCosts,
      homeValue: input.homePrice,
      loanBalance: loanAmount,
      buyerInvested: 0,
      renterInvested,
      ownerOutflow: 0,
      renterOutflow: 0,
    },
  ];
  let monthOne: MonthOne | null = null;

  for (let m = 1; m <= length; m++) {
    const yearStep = Math.floor((m - 1) / 12);
    const startValue = homeValueAt(m - 1);
    const costGrowth = Math.pow(1 + input.costGrowthPct / 100, yearStep);

    const row = loan?.schedule[m - 1];
    const mortgage = row ? row.payment : 0;
    const propertyTax = (input.propertyTaxPct / 100 / 12) * startValue;
    const insurance = (input.homeInsuranceYearly / 12) * costGrowth;
    const maintenance = (input.maintenancePct / 100 / 12) * startValue;
    const other = input.otherMonthlyCosts * costGrowth;
    const ownerOutflow = mortgage + propertyTax + insurance + maintenance + other;

    const rent = input.monthlyRent * Math.pow(1 + input.rentGrowthPct / 100, yearStep);
    const rentersInsurance = (input.rentersInsuranceYearly / 12) * costGrowth;
    const renterOutflow = rent + rentersInsurance;

    if (m === 1) {
      monthOne = {
        mortgage,
        propertyTax,
        insurance,
        maintenance,
        other,
        ownerTotal: ownerOutflow,
        rent,
        rentersInsurance,
        renterTotal: renterOutflow,
      };
    }

    const gap = ownerOutflow - renterOutflow;
    renterInvested = renterInvested * (1 + monthlyReturn) + (gap > 0 ? gap : 0);
    buyerInvested = buyerInvested * (1 + monthlyReturn) + (gap < 0 ? -gap : 0);

    const homeValue = homeValueAt(m);
    const loanBalance = row ? row.balance : 0;
    const buyerNetWorth =
      homeValue * (1 - input.sellingCostsPct / 100) - loanBalance + buyerInvested;
    months.push({
      advantage: buyerNetWorth - renterInvested,
      homeValue,
      loanBalance,
      buyerInvested,
      renterInvested,
      ownerOutflow,
      renterOutflow,
    });
  }

  return {
    loanAmount,
    downPayment,
    buyingCosts,
    mortgagePayment,
    monthOne: monthOne as MonthOne,
    months,
  };
}

export function calculateRentVsBuy(input: RentVsBuyInput): RentVsBuyOutcome {
  const errors = validateRentVsBuy(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const horizonMonths = Math.round(input.years * 12);
  const length = Math.max(horizonMonths, WINDOW_MONTHS);
  const sim = simulate(input, length);
  const end = sim.months[horizonMonths]!;

  // Sustained break-even: the first month after the last month in which renting was ahead.
  let breakEvenMonth: number | null = 1;
  for (let m = length; m >= 1; m--) {
    if (sim.months[m]!.advantage < -EPSILON) {
      breakEvenMonth = m === length ? null : m + 1;
      break;
    }
  }

  const series: AdvantagePoint[] = [];
  for (let m = 0; m <= length; m += 12) {
    series.push({ year: m / 12, advantage: sim.months[m]!.advantage });
  }

  return {
    ok: true,
    result: {
      loanAmount: sim.loanAmount,
      downPayment: sim.downPayment,
      buyingCosts: sim.buyingCosts,
      cashAtClosing: sim.downPayment + sim.buyingCosts,
      mortgagePayment: sim.mortgagePayment,
      monthOne: sim.monthOne,
      horizonMonths,
      homeValue: end.homeValue,
      sellingCosts: end.homeValue * (input.sellingCostsPct / 100),
      loanBalance: end.loanBalance,
      buyerInvested: end.buyerInvested,
      renterInvested: end.renterInvested,
      buyerNetWorth:
        end.homeValue * (1 - input.sellingCostsPct / 100) - end.loanBalance + end.buyerInvested,
      renterNetWorth: end.renterInvested,
      advantage: end.advantage,
      breakEvenMonth,
      series,
    },
  };
}

export type SensitivityCell = {
  appreciationPct: number;
  investmentReturnPct: number;
  advantage: number;
};

/**
 * How the answer moves when the two most uncertain assumptions are wrong: home appreciation and the
 * investment return, each shifted by `step` points either way. Rows are appreciation, columns are
 * the investment return, both from low to high. The middle cell equals the main result.
 */
export function rentVsBuySensitivity(input: RentVsBuyInput, step = 2): SensitivityCell[][] {
  if (Object.keys(validateRentVsBuy(input)).length > 0) return [];
  const horizonMonths = Math.round(input.years * 12);
  return [-step, 0, step].map((da) =>
    [-step, 0, step].map((di) => {
      const shifted = {
        ...input,
        appreciationPct: input.appreciationPct + da,
        investmentReturnPct: input.investmentReturnPct + di,
      };
      return {
        appreciationPct: shifted.appreciationPct,
        investmentReturnPct: shifted.investmentReturnPct,
        advantage: simulate(shifted, horizonMonths).months[horizonMonths]!.advantage,
      };
    }),
  );
}
