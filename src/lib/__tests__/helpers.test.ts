import { describe, expect, it } from "vitest";
import { optional, required, validMonth, validYear } from "@/lib/inputs";
import {
  calculators,
  categories,
  getCalculator,
  getCalculatorsByCategory,
  getCategory,
  getPopularCalculators,
  getSummaries,
} from "@/lib/registry";
import { matchesQuery, searchCalculators } from "@/lib/search";

describe("input mapping helpers", () => {
  it("required: an empty box becomes NaN so validation reports it", () => {
    expect(required(null)).toBeNaN();
    expect(required(0)).toBe(0);
    expect(required(12.5)).toBe(12.5);
  });

  it("optional: an empty box counts as zero", () => {
    expect(optional(null)).toBe(0);
    expect(optional(7)).toBe(7);
  });

  it.each([
    [1, 1],
    [12, 12],
    [6, 6],
  ])("validMonth keeps %d", (input, expected) => {
    expect(validMonth(input)).toBe(expected);
  });

  it.each([null, 0, 13, 1.5, -1, Number.NaN])("validMonth falls back for %j", (input) => {
    expect(validMonth(input)).toBe(1);
    expect(validMonth(input, 5)).toBe(5);
  });

  it("validYear keeps sensible years and falls back otherwise", () => {
    expect(validYear(2030, 2026)).toBe(2030);
    expect(validYear(1900, 2026)).toBe(1900);
    expect(validYear(2200, 2026)).toBe(2200);
    for (const bad of [null, 1899, 2201, 2026.5, Number.NaN])
      expect(validYear(bad, 2026)).toBe(2026);
  });
});

describe("search", () => {
  const items = getSummaries();

  it("returns nothing for an empty or blank query", () => {
    expect(matchesQuery(items[0]!, "")).toBe(false);
    expect(matchesQuery(items[0]!, "   ")).toBe(false);
    expect(searchCalculators(items, "")).toEqual([]);
  });

  it("matches on title, description and keywords, case-insensitively", () => {
    expect(searchCalculators(items, "MORTGAGE").map((i) => i.slug)).toContain(
      "mortgage-calculator",
    );
    expect(searchCalculators(items, "snowball").map((i) => i.slug)).toContain(
      "debt-payoff-planner",
    );
    expect(searchCalculators(items, "401k").map((i) => i.slug)).toContain("retirement-calculator");
  });

  it("requires every word to match", () => {
    expect(searchCalculators(items, "mortgage avalanche")).toEqual([]);
    expect(searchCalculators(items, "credit card").map((i) => i.slug)).toContain(
      "credit-card-payoff-calculator",
    );
  });

  it("ignores extra whitespace around and between words", () => {
    expect(searchCalculators(items, "  car   loan ").map((i) => i.slug)).toContain(
      "car-loan-calculator",
    );
  });

  it("finds nothing for nonsense", () => {
    expect(searchCalculators(items, "zzzzqq")).toEqual([]);
  });

  it("every calculator can be found by its own short title", () => {
    for (const c of calculators) {
      expect(
        searchCalculators(items, c.shortTitle).map((i) => i.slug),
        c.slug,
      ).toContain(c.slug);
    }
  });
});

describe("registry helpers", () => {
  it("looks up calculators and categories by id", () => {
    expect(getCalculator("loan-calculator")?.shortTitle).toBe("Loan Calculator");
    expect(getCalculator("nope")).toBeUndefined();
    expect(getCategory("debt")?.name).toBe("Debt");
    expect(getCategory("nope")).toBeUndefined();
  });

  it("groups calculators by category with none lost", () => {
    const total = categories.reduce((n, c) => n + getCalculatorsByCategory(c.id).length, 0);
    expect(total).toBe(calculators.length);
    expect(
      getCalculatorsByCategory("debt")
        .map((c) => c.slug)
        .sort(),
    ).toEqual(["credit-card-payoff-calculator", "debt-payoff-planner"]);
  });

  it("returns popular calculators only, up to the limit", () => {
    const popular = getPopularCalculators(100);
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.every((c) => c.popular)).toBe(true);
    expect(getPopularCalculators(2)).toHaveLength(2);
    expect(getPopularCalculators()).toHaveLength(Math.min(8, popular.length));
  });

  it("summaries are a serializable subset (no functions)", () => {
    const summaries = getSummaries();
    expect(summaries).toHaveLength(calculators.length);
    expect(() => JSON.stringify(summaries)).not.toThrow();
    expect(Object.keys(summaries[0]!).sort()).toEqual([
      "category",
      "description",
      "keywords",
      "shortTitle",
      "slug",
    ]);
  });
});
