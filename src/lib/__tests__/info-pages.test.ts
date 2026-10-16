import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { infoPages, staticPages } from "@/lib/pages";
import { fullTitle } from "@/lib/seo";

describe("info pages", () => {
  const pages = Object.entries(infoPages);

  it.each(pages)("%s has a 150-160 character description and a short title", (_key, page) => {
    expect(page.description.length).toBeGreaterThanOrEqual(150);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(fullTitle(page.title).length).toBeLessThan(60);
  });

  it("has unique titles, descriptions and paths", () => {
    for (const field of ["title", "description", "path"] as const) {
      const values = pages.map(([, p]) => p[field]);
      expect(new Set(values).size, field).toBe(values.length);
    }
  });

  it("has a page file for every path", () => {
    for (const [, p] of pages) {
      expect(
        existsSync(join(process.cwd(), "src", "app", p.path.slice(1), "page.tsx")),
        p.path,
      ).toBe(true);
    }
  });

  it("is listed in the sitemap pages", () => {
    const paths = staticPages.map((p) => p.path);
    for (const [, p] of pages) expect(paths).toContain(p.path);
    expect(paths).toContain("/");
  });

  it("is linked from the footer", async () => {
    const { readFileSync } = await import("node:fs");
    const footer = readFileSync(
      join(process.cwd(), "src", "components", "layout", "Footer.tsx"),
      "utf8",
    );
    for (const [, p] of pages) expect(footer, p.path).toContain(`"${p.path}"`);
  });
});
