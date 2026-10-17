import { execFile } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { open } from "./support/open";

/** Launch-readiness checks on the production build. */

test.describe("security headers", () => {
  for (const path of [
    "/",
    "/mortgage-calculator",
    "/category/loans",
    "/privacy-policy",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    test(`${path} sends the protective headers`, async ({ request }) => {
      const h = (await request.get(path)).headers();
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-frame-options"]).toBe("SAMEORIGIN");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"]).toContain("camera=()");
      expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
    });
  }

  test("the API route sends them too", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: "x",
      headers: { "content-type": "text/plain" },
    });
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("a production build is not marked noindex", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-robots-tag"]).toBeUndefined();
    expect(await res.text()).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
  });
});

test.describe("icons", () => {
  for (const path of ["/favicon.ico", "/icon", "/apple-icon"]) {
    test(`${path} is a PNG, not the default Next.js icon`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      const body = await res.body();
      expect([...body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(body.length).toBeGreaterThan(100);
    });
  }

  test("every page declares an icon and an Apple touch icon", async ({ page }) => {
    await open(page, "/");
    await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /icon/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      /apple-icon/,
    );
  });
});

test.describe("no leftover boilerplate", () => {
  test("the default Next.js and Vercel logos are gone", async ({ request }) => {
    for (const path of ["/next.svg", "/vercel.svg", "/file.svg", "/globe.svg", "/window.svg"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});

test.describe("analytics is off without configuration", () => {
  test("no Google Analytics script, even for a visitor who accepted everything", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: "http://localhost:3100",
      storageState: {
        cookies: [],
        origins: [
          {
            origin: "http://localhost:3100",
            localStorage: [
              {
                name: "fincalc-consent",
                value: JSON.stringify({ v: 1, analytics: true, ads: true, at: "t" }),
              },
            ],
          },
        ],
      },
    });
    const page = await context.newPage();
    const external: string[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).hostname !== "localhost") external.push(r.url());
    });
    await open(page, "/mortgage-calculator");
    expect(external).toEqual([]);
    await context.close();
  });
});

test.describe("the launch-check script", () => {
  function run(): Promise<{
    code: number;
    results: Array<{ status: string; area: string; name: string; note: string }>;
  }> {
    return new Promise((resolve, reject) => {
      execFile(
        process.execPath,
        [
          join(process.cwd(), "scripts", "launch-check.mjs"),
          "--base",
          "http://localhost:3100",
          "--no-source",
          "--json",
        ],
        { timeout: 90_000, maxBuffer: 5_000_000 },
        (error, stdout) => {
          try {
            resolve({
              code: error ? ((error as { code?: number }).code ?? 1) : 0,
              results: JSON.parse(stdout).results,
            });
          } catch (e) {
            reject(new Error(`launch-check did not print JSON: ${stdout.slice(0, 300)} (${e})`));
          }
        },
      );
    });
  }

  test("its live-site checks pass; only owner decisions may fail", async () => {
    test.setTimeout(120_000);
    const { results } = await run();
    expect(results.length).toBeGreaterThan(20);
    // These are decisions only the site owner can make. Anything else failing is a real defect.
    const OWNER_BLOCKERS = [/Template: review before launch/];
    const unexpected = results.filter(
      (r) => r.status === "FAIL" && !OWNER_BLOCKERS.some((re) => re.test(r.name)),
    );
    expect(
      unexpected,
      unexpected.map((r) => `${r.area}: ${r.name} (${r.note})`).join("\n"),
    ).toEqual([]);
  });

  test("it reports every area of the checklist", async () => {
    test.setTimeout(120_000);
    const { results } = await run();
    const areas = new Set(results.map((r) => r.area));
    for (const area of ["Sitemap", "SEO", "Legal", "Consent", "Files", "Security"])
      expect(areas.has(area), area).toBe(true);
    expect(results.some((r) => r.status === "PASS")).toBe(true);
    expect(results.some((r) => r.status === "MANUAL" && /Rich Results/.test(r.name))).toBe(true);
  });
});
