import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateRefinance } from "@/lib/calculators/refinance";
import { calculateRentVsBuy } from "@/lib/calculators/rent-vs-buy";
import { calculateStudentLoan } from "@/lib/calculators/student-loan";
import { calculateTakeHome } from "@/lib/calculators/take-home-pay";
import { payrollUs2026 } from "@/lib/data/payroll-us-2026";
import { formatCurrency, formatDuration } from "@/lib/format";

/**
 * The worked examples on the calculator pages quote numbers. This test runs the same inputs through
 * the engines and checks that every quoted figure still appears on the page, so an edit to a
 * calculation (or to the text) cannot leave the explanation saying something the calculator no longer does.
 */

const page = (slug: string) =>
  readFileSync(join(process.cwd(), "src", "content", "calculators", `${slug}.mdx`), "utf8");
const usd = (n: number, decimals = 2) => formatCurrency(n, { decimals });

function refinance(overrides: Record<string, unknown>) {
  const out = calculateRefinance({
    balance: 300_000,
    currentRatePct: 7,
    currentTerm: 25,
    currentTermUnit: "years",
    newRatePct: 5.5,
    newTerm: 25,
    newTermUnit: "years",
    closingCosts: 4_500,
    rollCosts: false,
    horizonYears: 7,
    ...overrides,
  });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

function student(overrides: Record<string, unknown>) {
  const out = calculateStudentLoan({
    balance: 35_000,
    annualRatePct: 5.5,
    term: 10,
    termUnit: "years",
    extraMonthly: 0,
    lumpSum: 0,
    lumpSumMonth: 12,
    ...overrides,
  });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("refinance page examples match the calculator", () => {
  const text = page("refinance-calculator");

  it("first example (lower rate, same term)", () => {
    const r = refinance({});
    for (const figure of [
      usd(r.currentPayment),
      usd(r.newPayment),
      usd(r.monthlySavings),
      usd(r.netAtHorizon, 0),
      usd(r.lifetimeNet, 0),
      usd(r.newInterestTotal, 0),
      usd(r.currentInterestRemaining, 0),
    ]) {
      expect(text, figure).toContain(figure);
    }
    expect(text).toContain(`**month ${r.breakEvenMonth}**`);
    expect(text).toContain(`**${r.simpleBreakEvenMonths!.toFixed(1)} months**`);
  });

  it("second example (costs rolled in, restarted at 30 years)", () => {
    const r = refinance({
      balance: 250_000,
      currentRatePct: 6.5,
      currentTerm: 20,
      newRatePct: 5.75,
      newTerm: 30,
      closingCosts: 6_000,
      rollCosts: true,
    });
    expect(r.breakEvenMonth).toBeNull();
    for (const figure of [
      usd(r.currentPayment),
      usd(r.newPayment),
      usd(r.monthlySavings),
      usd(r.currentInterestRemaining, 0),
      usd(r.newInterestTotal, 0),
      usd(-r.lifetimeNet, 0),
    ]) {
      expect(text, figure).toContain(figure);
    }
  });

  it("the 'not worth it' FAQ (a 0.25-point cut)", () => {
    const r = refinance({ newRatePct: 6.75, horizonYears: 5 });
    expect(text).toContain(usd(r.monthlySavings));
    expect(text).toContain(`month ${r.breakEvenMonth}`);
    expect(text).toContain(usd(-r.netAtHorizon, 0));
    expect(r.netAtHorizon).toBeLessThan(0);
  });
});

describe("student loan page examples match the calculator", () => {
  const text = page("student-loan-calculator");

  it("standard schedule", () => {
    const r = student({});
    for (const figure of [
      usd(r.monthlyPayment),
      usd(r.schedule[0]!.interest),
      usd(r.schedule[0]!.principal),
      usd(r.totalInterest),
      usd(r.totalPaid),
    ]) {
      expect(text, figure).toContain(figure);
    }
  });

  it.each([
    ["$150 extra every month", { extraMonthly: 150 }],
    ["a $5,000 lump sum", { lumpSum: 5_000, lumpSumMonth: 12 }],
    ["both together", { extraMonthly: 150, lumpSum: 5_000, lumpSumMonth: 12 }],
  ])("%s", (_name, overrides) => {
    const r = student(overrides);
    expect(text).toContain(`${r.months} payments`);
    expect(text).toContain(usd(r.totalInterest));
    expect(text).toContain(usd(r.interestSaved));
    expect(text).toContain(`${r.monthsSaved} months`);
  });
});

describe("rent vs buy page examples match the calculator", () => {
  const text = page("rent-vs-buy-calculator");
  const base = {
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
  const run = (overrides: Record<string, number>) => {
    const out = calculateRentVsBuy({ ...base, ...overrides });
    if (!out.ok) throw new Error(JSON.stringify(out.errors));
    return out.result;
  };

  it("the default scenario", () => {
    const r = run({});
    for (const figure of [
      usd(r.cashAtClosing, 0),
      usd(r.mortgagePayment),
      usd(r.monthOne.ownerTotal),
      usd(r.monthOne.renterTotal),
      usd(r.homeValue, 0),
      usd(r.loanBalance, 0),
      usd(r.buyerNetWorth, 0),
      usd(r.renterNetWorth, 0),
      usd(-r.advantage, 0),
    ]) {
      expect(text, figure).toContain(figure);
    }
    expect(r.advantage).toBeLessThan(0); // the page says renting is ahead after 7 years
    expect(formatDuration(r.breakEvenMonth!)).toBe("8 years 3 months");
    expect(text).toContain("8 years 3 months");
  });

  it("the high-rent, long-stay scenario", () => {
    const r = run({ monthlyRent: 2_800, rentGrowthPct: 5, years: 15 });
    expect(text).toContain(usd(r.advantage, 0));
    expect(text).toContain(`month ${r.breakEvenMonth}`);
  });

  it("the low-growth, high-rate scenario", () => {
    const r = run({ appreciationPct: 1, mortgageRatePct: 7.5, monthlyRent: 1_800, years: 5 });
    expect(text).toContain(usd(-r.advantage, 0));
    expect(r.breakEvenMonth).toBeNull();
  });

  it("one extra point of yearly growth is worth 'tens of thousands' on this home", () => {
    expect(run({ appreciationPct: 4 }).advantage - run({}).advantage).toBeGreaterThan(10_000);
  });
});

describe("take-home pay page examples match the calculator", () => {
  const text = page("take-home-pay-calculator");
  const run = (overrides: Record<string, unknown>) => {
    const out = calculateTakeHome({
      annualGross: 75_000,
      frequency: "biweekly",
      status: "single",
      retirementPct: 5,
      ageGroup: "under50",
      preTaxBenefitsPerPaycheck: 150,
      afterTaxDeductionsPerPaycheck: 0,
      ...overrides,
    });
    if (!out.ok) throw new Error(JSON.stringify(out.errors));
    return out.result;
  };

  it("the salaried example", () => {
    const r = run({});
    for (const figure of [
      usd(r.preTaxBenefits.annual, 0),
      usd(r.payrollTaxWages, 0),
      usd(r.retirement.annual, 0),
      usd(r.federalIncomeTax.annual),
      usd(r.socialSecurity.annual),
      usd(r.medicare.annual),
      usd(r.takeHome.annual),
      usd(r.takeHome.perPaycheck),
      usd(r.gross.perPaycheck),
    ]) {
      expect(text, figure).toContain(figure);
    }
    expect(text).toContain("**$51,250**"); // taxable income quoted in the example
    expect(r.federalIncomeTax.annual).toBeCloseTo(5_800 + 0.22 * 850, 9);
  });

  it("the high earner example", () => {
    const r = run({
      annualGross: 250_000,
      frequency: "monthly",
      retirementPct: 10,
      preTaxBenefitsPerPaycheck: 0,
    });
    expect(r.retirement.annual).toBe(24_500);
    for (const figure of [
      usd(r.federalIncomeTax.annual),
      usd(r.additionalMedicare.annual),
      usd(r.takeHome.perPaycheck),
    ]) {
      expect(text, figure).toContain(figure);
    }
    expect(text).toContain(`paycheck **${r.socialSecurityStopsAtPaycheck}**`);
    expect(text).toContain(usd(r.earlyPaycheckTakeHome!));
    expect(text).toContain(usd(r.latePaycheckTakeHome!));
  });

  it("the Additional Medicare withholding timing quoted for the high earner", () => {
    // Independent arithmetic: monthly pay 250,000 / 12; employers withhold 0.9% only on pay above
    // 200,000 for the year, from the paycheck where the running total passes it.
    const monthly = 250_000 / 12;
    const withheld = [10, 11, 12].map(
      (n) => 0.009 * (Math.min(n * monthly, 250_000) - Math.max(200_000, (n - 1) * monthly)),
    );
    expect(Math.floor(200_000 / monthly) + 1).toBe(10); // pay passes 200,000 in paycheck 10
    expect(withheld[0]).toBeCloseTo(75, 9);
    expect(withheld[1]).toBeCloseTo(187.5, 9);
    expect(withheld[2]).toBeCloseTo(187.5, 9);
    expect(withheld.reduce((a, b) => a + b, 0)).toBeCloseTo(450, 9);
    // The calculator's late paycheck already includes one twelfth of the 450; the real last two are smaller.
    expect(187.5 - 450 / 12).toBeCloseTo(150, 9);
    expect(text).toContain("paycheck 10");
    expect(text).toContain("**$150**");
  });

  it("the 2026 figures quoted on the page are the ones in the data file", () => {
    const d = payrollUs2026;
    expect(text).toContain(usd(d.socialSecurity.wageBase, 0));
    expect(text).toContain(usd(d.retirement401k.deferralLimit, 0));
    expect(text).toContain(usd(d.retirement401k.catchUp50, 0));
    expect(text).toContain(usd(d.retirement401k.catchUp60to63, 0));
    expect(text).toContain(usd(d.medicare.additional.threshold.single, 0));
    expect(text).toContain(usd(d.medicare.additional.threshold.mfj, 0));
    expect(text).toContain(usd(d.medicare.additional.threshold.mfs, 0));
    expect(text).toContain(d.lastChecked);
  });
});
