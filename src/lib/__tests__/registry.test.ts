import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculators, categories } from "@/lib/registry";

const contentDir = join(process.cwd(), "src", "content", "calculators");

describe("registry integrity", () => {
  it("has unique slugs", () => {
    const slugs = calculators.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  describe.each(calculators.map((c) => [c.slug, c] as const))("%s", (_slug, calc) => {
    it("has a valid category", () => {
      expect(categories.map((c) => c.id)).toContain(calc.category);
    });

    it("has a 150-160 character meta description", () => {
      expect(calc.description.length).toBeGreaterThanOrEqual(150);
      expect(calc.description.length).toBeLessThanOrEqual(160);
    });

    it("leaves room for the site name in a title under 60 characters", () => {
      expect(calc.title.length).toBeLessThanOrEqual(45);
    });

    it("has an MDX content file", () => {
      expect(existsSync(join(contentDir, calc.contentPath))).toBe(true);
    });

    it("only relates to calculators that exist", () => {
      for (const slug of calc.related) {
        expect(calculators.map((c) => c.slug)).toContain(slug);
      }
    });

    it("has an ISO last-updated date", () => {
      expect(calc.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
