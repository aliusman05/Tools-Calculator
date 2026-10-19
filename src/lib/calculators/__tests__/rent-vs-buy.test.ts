import { describe, expect, it } from "vitest";
import {
  calculateRentVsBuy,
  rentVsBuySensitivity,
  validateRentVsBuy,
  type RentVsBuyInput,
  type RentVsBuyResult,
} from "../rent-vs-buy";

/*
 * Reference values were derived independently of the engine.
 *
 * 1. Closed-form cases (cases Z, G and I). With the extra costs switched off the model collapses to
 *    formulas that need no month-by-month loop. With M the mortgage payment, B_n the balance after n
 *    payments, V_n = P (1+g)^(n/12) the home value, j = (1+i)^(1/12) - 1 the monthly investment return:
 *      Z (no growth, no returns, no costs):  advantage = rent * n - interest paid
 *                                            interest paid = M n - (L - B_n)
 *      G (appreciation g, selling cost s):   advantage = [V_n (1-s) - B_n] - [D + (M - rent) n]
 *      I (adds a constant monthly surplus d invested at j, down payment D invested at j):
 *                                            advantage = [V_n (1-s) - B_n] - [D (1+j)^n + d ((1+j)^n - 1)/j]
 * 2. A separate month-by-month script (not sharing any code with the engine) that reproduces cases Z,
 *    G and I to about 10 significant digits, and was then used for the full scenarios below.
 *
 * Month conventions: contributions are invested at the end of each month; rent and fixed costs step up
 * once a year; property tax and maintenance are charged on the home's value at the start of the month.
 */

const defaults: RentVsBuyInput = {
  homePrice: 400_000,
  downPaymentPct: 20,
  mortgageRatePct: 6.5,
  mortgageTermYears: 30,
  buyingCostsPct: 3,
  propertyTaxPct: 1.1,
  homeInsuranceYearly: 1_500,
  maintenancePct: 1,
  otherMonthlyCosts: 0,
  appreciationPct: 3,
  sellingCostsPct: 6,
  monthlyRent: 2_200,
  rentGrowthPct: 3,
  rentersInsuranceYearly: 240,
  investmentReturnPct: 5,
  costGrowthPct: 3,
  years: 7,
};

const bare: RentVsBuyInput = {
  ...defaults,
  buyingCostsPct: 0,
  propertyTaxPct: 0,
  homeInsuranceYearly: 0,
  maintenancePct: 0,
  otherMonthlyCosts: 0,
  appreciationPct: 0,
  sellingCostsPct: 0,
  monthlyRent: 1_500,
  rentGrowthPct: 0,
  rentersInsuranceYearly: 0,
  investmentReturnPct: 0,
  costGrowthPct: 0,
};

function run(overrides: Partial<RentVsBuyInput> = {}, from = defaults): RentVsBuyResult {
  const out = calculateRentVsBuy({ ...from, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("closed-form cases", () => {
  it("Z: with nothing else going on, buying beats renting by the rent paid minus the interest paid", () => {
    const r = run({}, bare);
    expect(r.mortgagePayment).toBeCloseTo(2022.6176751774892, 8);
    expect(r.advantage).toBeCloseTo(-13231.86802210586, 6);
  });

  it("G: appreciation and selling costs, rent constant, nothing invested", () => {
    const r = run({ appreciationPct: 3, sellingCostsPct: 6 }, bare);
    expect(r.advantage).toBeCloseTo(49200.705377645296, 6);
  });

  it("I: invested down payment and monthly surplus grow at the investment return", () => {
    const r = run(
      {
        appreciationPct: 3,
        sellingCostsPct: 6,
        homeInsuranceYearly: 1_500,
        otherMonthlyCosts: 100,
        investmentReturnPct: 5,
      },
      bare,
    );
    expect(r.advantage).toBeCloseTo(-14171.96614304607, 6);
  });
});

describe("default scenario ($400,000 home, $2,200 rent, 7 years)", () => {
  const r = run();

  it("sizes the purchase", () => {
    expect(r.loanAmount).toBe(320_000);
    expect(r.downPayment).toBe(80_000);
    expect(r.buyingCosts).toBe(12_000);
    expect(r.cashAtClosing).toBe(92_000);
    expect(r.mortgagePayment).toBeCloseTo(2022.6176751774892, 8);
  });

  it("totals the first month's costs for each choice", () => {
    expect(r.monthOne.ownerTotal).toBeCloseTo(2847.617675177489, 6);
    expect(r.monthOne.renterTotal).toBeCloseTo(2220, 9);
    expect(r.monthOne.propertyTax).toBeCloseTo((400_000 * 0.011) / 12, 9);
    expect(r.monthOne.maintenance).toBeCloseTo((400_000 * 0.01) / 12, 9);
  });

  it("matches the reference net worth after 7 years", () => {
    expect(r.homeValue).toBeCloseTo(491949.54616994807, 4);
    expect(r.loanBalance).toBeCloseTo(289331.98330719676, 4);
    expect(r.buyerNetWorth).toBeCloseTo(173100.5900925544, 3);
    expect(r.renterNetWorth).toBeCloseTo(180883.96104495742, 3);
    expect(r.advantage).toBeCloseTo(-7783.370952403027, 3);
    expect(r.buyerNetWorth - r.renterNetWorth).toBeCloseTo(r.advantage, 6);
  });

  it("matches the reference advantage at years 1, 3 and 5, and the sustained break-even", () => {
    const at = (year: number) => r.series.find((p) => p.year === year)!.advantage;
    expect(at(1)).toBeCloseTo(-33562.218990819136, 3);
    expect(at(3)).toBeCloseTo(-27249.381636796053, 3);
    expect(at(5)).toBeCloseTo(-18768.696486295026, 3);
    expect(r.breakEvenMonth).toBe(99);
  });

  it("starts behind by the buying and selling costs", () => {
    expect(r.series[0]).toEqual({ year: 0, advantage: -(400_000 * 0.06) - 12_000 });
  });
});

describe("other scenarios", () => {
  it("renting wins and buying never catches up: low appreciation, high rate, cheap rent", () => {
    const r = run({ appreciationPct: 1, mortgageRatePct: 7.5, monthlyRent: 1_800, years: 5 });
    expect(r.mortgagePayment).toBeCloseTo(2237.486427368885, 8);
    expect(r.advantage).toBeCloseTo(-103647.62559805249, 3);
    expect(r.breakEvenMonth).toBeNull();
  });

  it("buying wins after a long stay: expensive rent that rises quickly", () => {
    const r = run({ monthlyRent: 2_800, rentGrowthPct: 5, years: 15 });
    expect(r.advantage).toBeCloseTo(386885.45582017314, 2);
    expect(r.breakEvenMonth).toBe(37);
    expect(r.series.find((p) => p.year === 5)!.advantage).toBeCloseTo(32116.64743282259, 3);
  });
});

describe("behaviour and edge cases", () => {
  it("higher rent, higher appreciation, a lower mortgage rate and a longer stay all favour buying", () => {
    const base = run().advantage;
    expect(run({ monthlyRent: 2_600 }).advantage).toBeGreaterThan(base);
    expect(run({ appreciationPct: 5 }).advantage).toBeGreaterThan(base);
    expect(run({ mortgageRatePct: 5 }).advantage).toBeGreaterThan(base);
    expect(run({ investmentReturnPct: 2 }).advantage).toBeGreaterThan(base);
    expect(run({ sellingCostsPct: 3 }).advantage).toBeGreaterThan(base);
  });

  it("a paid-off home (100% down) has no mortgage and still produces a result", () => {
    const r = run({ downPaymentPct: 100 });
    expect(r.loanAmount).toBe(0);
    expect(r.mortgagePayment).toBe(0);
    expect(r.loanBalance).toBe(0);
    expect(Number.isFinite(r.advantage)).toBe(true);
  });

  it("handles a 0% mortgage rate and a 0% down payment", () => {
    expect(run({ mortgageRatePct: 0 }).mortgagePayment).toBeCloseTo(320_000 / 360, 8);
    expect(run({ downPaymentPct: 0 }).downPayment).toBe(0);
  });

  it("a comparison longer than the mortgage still works (the payment stops, costs continue)", () => {
    const r = run({ mortgageTermYears: 10, years: 20 });
    expect(r.loanBalance).toBe(0);
    expect(Number.isFinite(r.advantage)).toBe(true);
  });

  it("negative appreciation and a falling rent are accepted", () => {
    const r = run({ appreciationPct: -3, rentGrowthPct: -2 });
    expect(r.homeValue).toBeLessThan(400_000);
    expect(Number.isFinite(r.advantage)).toBe(true);
  });

  it("handles the maximum comparison of 40 years and very large prices", () => {
    expect(Number.isFinite(run({ years: 40 }).advantage)).toBe(true);
    expect(Number.isFinite(run({ homePrice: 5_000_000_000, monthlyRent: 1e7 }).advantage)).toBe(
      true,
    );
  });

  it("the series runs for at least 30 years so the break-even can be seen", () => {
    expect(run().series.at(-1)!.year).toBeGreaterThanOrEqual(30);
    expect(run({ years: 40 }).series.at(-1)!.year).toBe(40);
  });
});

describe("sensitivity", () => {
  it("returns a 3 by 3 grid whose middle cell equals the main result", () => {
    const grid = rentVsBuySensitivity(defaults);
    expect(grid).toHaveLength(3);
    expect(grid.every((row) => row.length === 3)).toBe(true);
    expect(grid[1]![1]!.advantage).toBeCloseTo(run().advantage, 6);
    expect(grid[1]![1]!.appreciationPct).toBe(3);
    expect(grid[0]![0]!.appreciationPct).toBe(1);
    expect(grid[2]![2]!.investmentReturnPct).toBe(7);
  });

  it("higher appreciation favours buying and a higher investment return favours renting", () => {
    const grid = rentVsBuySensitivity(defaults);
    expect(grid[2]![1]!.advantage).toBeGreaterThan(grid[0]![1]!.advantage);
    expect(grid[1]![2]!.advantage).toBeLessThan(grid[1]![0]!.advantage);
  });

  it("returns nothing for invalid input", () => {
    expect(rentVsBuySensitivity({ ...defaults, homePrice: 0 })).toEqual([]);
  });
});

describe("validateRentVsBuy", () => {
  it("accepts the defaults", () => {
    expect(validateRentVsBuy(defaults)).toEqual({});
  });

  it("rejects out-of-range and non-numeric values field by field", () => {
    const errors = validateRentVsBuy({
      ...defaults,
      homePrice: 0,
      downPaymentPct: 101,
      mortgageRatePct: -1,
      mortgageTermYears: 0,
      buyingCostsPct: 21,
      propertyTaxPct: 11,
      homeInsuranceYearly: -1,
      maintenancePct: 11,
      otherMonthlyCosts: -1,
      appreciationPct: 21,
      sellingCostsPct: 21,
      monthlyRent: 0,
      rentGrowthPct: 31,
      rentersInsuranceYearly: -1,
      investmentReturnPct: 31,
      costGrowthPct: 21,
      years: 41,
    });
    expect(Object.keys(errors)).toHaveLength(17);
  });

  it("treats NaN (an empty required box) as invalid", () => {
    expect(calculateRentVsBuy({ ...defaults, monthlyRent: Number.NaN }).ok).toBe(false);
  });
});
