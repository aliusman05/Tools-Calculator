import { describe, expect, it } from "vitest";
import { monthlyChartData } from "@/lib/chart-data";

describe("monthlyChartData", () => {
  it("keeps every month for short series", () => {
    const rows = monthlyChartData({ a: [100, 60, 20, 0] });
    expect(rows.map((r) => r.month)).toEqual([0, 1, 2, 3]);
    expect(rows[1]!.a).toBe(60);
  });

  it("thins long series but keeps the first and last month", () => {
    const values = Array.from({ length: 361 }, (_, i) => 360 - i);
    const rows = monthlyChartData({ a: values }, 36);
    expect(rows.length).toBeLessThanOrEqual(38);
    expect(rows[0]!.month).toBe(0);
    expect(rows[rows.length - 1]!.month).toBe(360);
    expect(rows[rows.length - 1]!.a).toBe(0);
  });

  it("treats a series that ends early as paid off (0)", () => {
    const rows = monthlyChartData({ short: [10, 0], long: [10, 8, 6, 4, 2, 0] });
    expect(rows).toHaveLength(6);
    expect(rows[4]!.short).toBe(0);
    expect(rows[4]!.long).toBe(2);
  });

  it("handles a single-point series", () => {
    expect(monthlyChartData({ a: [5] })).toEqual([{ month: 0, a: 5 }]);
  });

  it("rounds to cents", () => {
    expect(monthlyChartData({ a: [1.23456, 0] })[0]!.a).toBe(1.23);
  });
});
