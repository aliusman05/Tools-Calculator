import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDuration,
  formatIsoDate,
  formatMonthYear,
  formatNumber,
  formatPercent,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });
  it("rounds only at display time", () => {
    expect(formatCurrency(1798.6515754)).toBe("$1,798.65");
  });
  it("supports other currencies and locales", () => {
    expect(formatCurrency(1234.5, { currency: "GBP", locale: "en-GB" })).toBe("£1,234.50");
  });
  it("supports zero decimals", () => {
    expect(formatCurrency(1234.56, { decimals: 0 })).toBe("$1,235");
  });
  it("returns a dash for non-finite values", () => {
    expect(formatCurrency(Number.NaN)).toBe("—");
  });
});

describe("formatPercent / formatNumber", () => {
  it("formats fractions as percents", () => {
    expect(formatPercent(0.065)).toBe("6.50%");
    expect(formatPercent(0.065, { decimals: 1 })).toBe("6.5%");
  });
  it("formats numbers with grouping", () => {
    expect(formatNumber(1234567.891, { decimals: 1 })).toBe("1,234,567.9");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0 months"],
    [1, "1 month"],
    [12, "1 year"],
    [27, "2 years 3 months"],
    [360, "30 years"],
  ])("%d months -> %s", (months, expected) => {
    expect(formatDuration(months)).toBe(expected);
  });
});

describe("date helpers", () => {
  it("formats month and year", () => {
    expect(formatMonthYear(3, 2031)).toBe("March 2031");
    expect(formatMonthYear(3, 2031, true)).toBe("Mar 2031");
  });
  it("formats ISO dates without timezone shifts", () => {
    expect(formatIsoDate("2026-10-16")).toBe("October 16, 2026");
  });
});
