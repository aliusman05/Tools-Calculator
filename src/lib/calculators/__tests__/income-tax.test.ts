import { describe, expect, it } from "vitest";
import { taxUs2026, type FilingStatus } from "@/lib/data/tax-us-2026";
import {
  applyBrackets,
  calculateIncomeTax,
  marginalRate,
  validateIncomeTax,
  type IncomeTaxInput,
} from "../income-tax";

// Reference values are computed by hand from the 2026 IRS rate schedules (Rev. Proc. 2025-32):
//   Single, $100,000 wages, standard deduction $16,100 -> taxable $83,900
//     10% x 12,400 = 1,240 ; 12% x (50,400 - 12,400) = 4,560 ; 22% x (83,900 - 50,400) = 7,370 -> $13,170
//   Married filing jointly, $150,000, standard $32,200 -> taxable $117,800
//     10% x 24,800 = 2,480 ; 12% x 76,000 = 9,120 ; 22% x 17,000 = 3,740 -> $15,340
//   Head of household, $80,000, standard $24,150 -> taxable $55,850 -> $6,348
//   Single, $1,000,000 -> taxable $983,900 -> $320,000.25

const base: IncomeTaxInput = {
  status: "single",
  grossIncome: 100_000,
  adjustments: 0,
  deductionType: "standard",
  itemizedDeductions: 0,
  age65OrBlindCount: 0,
  credits: 0,
  withheld: 0,
};

function run(overrides: Partial<IncomeTaxInput> = {}) {
  const out = calculateIncomeTax({ ...base, ...overrides });
  if (!out.ok) throw new Error(JSON.stringify(out.errors));
  return out.result;
}

describe("tax data file", () => {
  const statuses = Object.keys(taxUs2026.brackets) as FilingStatus[];

  it("has a source and a check date", () => {
    expect(taxUs2026.year).toBe(2026);
    expect(taxUs2026.source.url).toMatch(/^https:\/\/www\.irs\.gov\//);
    expect(taxUs2026.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(statuses)("%s brackets start at 0, have seven rates, and strictly increase", (status) => {
    const b = taxUs2026.brackets[status];
    expect(b[0]!.over).toBe(0);
    expect(b.map((x) => x.rate)).toEqual([10, 12, 22, 24, 32, 35, 37]);
    for (let i = 1; i < b.length; i++) expect(b[i]!.over).toBeGreaterThan(b[i - 1]!.over);
  });

  it("joint brackets are double the single brackets up to the 35% bracket", () => {
    for (let i = 1; i <= 4; i++) {
      // 2026 joint thresholds are twice single, within rounding of the indexing
      const single = taxUs2026.brackets.single[i]!.over;
      const joint = taxUs2026.brackets.mfj[i]!.over;
      expect(Math.abs(joint - 2 * single)).toBeLessThanOrEqual(50);
    }
  });

  it("married-filing-separately matches single until the top bracket", () => {
    for (let i = 0; i < 6; i++) {
      expect(taxUs2026.brackets.mfs[i]).toEqual(taxUs2026.brackets.single[i]);
    }
    expect(taxUs2026.brackets.mfs[6]!.over).toBeLessThan(taxUs2026.brackets.single[6]!.over);
  });

  it("standard deductions are ordered sensibly", () => {
    const sd = taxUs2026.standardDeduction;
    expect(sd.mfj).toBe(2 * sd.single);
    expect(sd.mfs).toBe(sd.single);
    expect(sd.hoh).toBeGreaterThan(sd.single);
    expect(sd.hoh).toBeLessThan(sd.mfj);
  });
});

describe("calculateIncomeTax: reference calculations", () => {
  it("single, $100k", () => {
    const r = run();
    expect(r.taxableIncome).toBe(83_900);
    expect(r.totalTax).toBeCloseTo(13_170, 6);
    expect(r.marginalRatePct).toBe(22);
    expect(r.effectiveRatePct).toBeCloseTo(13.17, 6);
  });

  it("married filing jointly, $150k", () => {
    const r = run({ status: "mfj", grossIncome: 150_000 });
    expect(r.taxableIncome).toBe(117_800);
    expect(r.totalTax).toBeCloseTo(15_340, 6);
  });

  it("head of household, $80k", () => {
    const r = run({ status: "hoh", grossIncome: 80_000 });
    expect(r.taxableIncome).toBe(55_850);
    expect(r.totalTax).toBeCloseTo(6_348, 6);
  });

  it("single, $1,000,000 reaches the 37% bracket", () => {
    const r = run({ grossIncome: 1_000_000 });
    expect(r.totalTax).toBeCloseTo(320_000.25, 4);
    expect(r.marginalRatePct).toBe(37);
  });

  it("married filing separately uses the lower 37% threshold", () => {
    const r = run({ status: "mfs", grossIncome: 500_000 });
    expect(r.totalTax).toBeCloseTo(140_125.25, 4);
    expect(r.marginalRatePct).toBe(37);
  });
});

describe("calculateIncomeTax: deductions, credits and refunds", () => {
  it("pays no tax when income is under the standard deduction", () => {
    const r = run({ grossIncome: 16_100 });
    expect(r.taxableIncome).toBe(0);
    expect(r.totalTax).toBe(0);
    expect(r.effectiveRatePct).toBe(0);
  });

  it("pays no tax at zero income", () => {
    const r = run({ grossIncome: 0 });
    expect(r.totalTax).toBe(0);
    expect(r.effectiveRatePct).toBe(0);
  });

  it("subtracts above-the-line adjustments before the deduction", () => {
    const r = run({ grossIncome: 100_000, adjustments: 10_000 });
    expect(r.adjustedGrossIncome).toBe(90_000);
    expect(r.taxableIncome).toBe(73_900);
  });

  it("uses itemized deductions instead of the standard deduction when chosen", () => {
    const r = run({
      grossIncome: 75_000,
      adjustments: 10_000,
      deductionType: "itemized",
      itemizedDeductions: 20_000,
    });
    expect(r.deductionKind).toBe("itemized");
    expect(r.taxableIncome).toBe(45_000);
    // 10% x 12,400 + 12% x 32,600 = 1,240 + 3,912
    expect(r.totalTax).toBeCloseTo(5_152, 6);
  });

  it("adds the extra standard deduction for age 65+ or blind", () => {
    expect(run({ age65OrBlindCount: 1 }).deduction).toBe(16_100 + 2_050);
    expect(run({ status: "mfj", grossIncome: 150_000, age65OrBlindCount: 2 }).deduction).toBe(
      32_200 + 2 * 1_650,
    );
  });

  it("does not add the age/blind amount to itemized deductions", () => {
    const r = run({ deductionType: "itemized", itemizedDeductions: 20_000, age65OrBlindCount: 1 });
    expect(r.deduction).toBe(20_000);
  });

  it("credits reduce tax but never below zero", () => {
    expect(run({ credits: 1_000 }).totalTax).toBeCloseTo(12_170, 6);
    const big = run({ credits: 50_000 });
    expect(big.totalTax).toBe(0);
    expect(big.creditsApplied).toBeCloseTo(13_170, 6);
  });

  it("computes the refund or the amount owed from withholding", () => {
    expect(run({ withheld: 15_000 }).refundOrOwed).toBeCloseTo(1_830, 6);
    expect(run({ withheld: 10_000 }).refundOrOwed).toBeCloseTo(-3_170, 6);
  });

  it("more income never means less tax", () => {
    let prev = -1;
    for (let income = 0; income <= 1_000_000; income += 12_500) {
      const t = run({ grossIncome: income }).totalTax;
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it("an extra dollar never costs more than the marginal rate (no cliffs)", () => {
    for (const income of [30_000, 66_500, 122_000, 220_000, 400_000, 700_000]) {
      const a = run({ grossIncome: income }).totalTax;
      const b = run({ grossIncome: income + 1 }).totalTax;
      const rate = run({ grossIncome: income + 1 }).marginalRatePct / 100;
      expect(b - a).toBeLessThanOrEqual(rate + 1e-9);
    }
  });
});

describe("brackets", () => {
  it("is continuous across a bracket boundary", () => {
    const at = applyBrackets(12_400, taxUs2026.brackets.single).reduce((s, l) => s + l.tax, 0);
    expect(at).toBeCloseTo(1_240, 8);
    const next = applyBrackets(12_401, taxUs2026.brackets.single).reduce((s, l) => s + l.tax, 0);
    expect(next - at).toBeCloseTo(0.12, 8);
  });

  it("breaks income into amounts that add up to taxable income", () => {
    const r = run({ grossIncome: 300_000 });
    expect(r.breakdown.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(r.taxableIncome, 8);
    expect(r.breakdown.reduce((s, l) => s + l.tax, 0)).toBeCloseTo(r.taxBeforeCredits, 8);
    expect(r.breakdown[r.breakdown.length - 1]!.to).toBeNull();
  });

  it("marginal rate is the rate of the bracket containing the next dollar", () => {
    const b = taxUs2026.brackets.single;
    expect(marginalRate(0, b)).toBe(10);
    expect(marginalRate(12_400, b)).toBe(10);
    expect(marginalRate(12_401, b)).toBe(12);
    expect(marginalRate(5_000_000, b)).toBe(37);
  });
});

describe("validateIncomeTax", () => {
  it("accepts valid input", () => {
    expect(validateIncomeTax(base)).toEqual({});
  });
  it.each([
    ["grossIncome", { grossIncome: -1 }],
    ["grossIncome", { grossIncome: Number.NaN }],
    ["adjustments", { adjustments: -5 }],
    ["adjustments", { adjustments: 200_000 }],
    ["itemizedDeductions", { deductionType: "itemized" as const, itemizedDeductions: -1 }],
    ["credits", { credits: -1 }],
    ["withheld", { withheld: -1 }],
    ["age65OrBlindCount", { age65OrBlindCount: 3 }],
    ["age65OrBlindCount", { age65OrBlindCount: 1.5 }],
  ])("flags %s", (field, override) => {
    expect(
      validateIncomeTax({ ...base, ...override })[field as keyof IncomeTaxInput],
    ).toBeDefined();
  });
  it("allows up to four age/blind additions only for joint filers", () => {
    expect(validateIncomeTax({ ...base, status: "mfj", age65OrBlindCount: 4 })).toEqual({});
    expect(validateIncomeTax({ ...base, age65OrBlindCount: 3 }).age65OrBlindCount).toBeDefined();
  });
  it("returns errors instead of a result", () => {
    expect(calculateIncomeTax({ ...base, grossIncome: -5 }).ok).toBe(false);
  });
});
