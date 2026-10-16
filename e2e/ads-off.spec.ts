import { expect, test } from "@playwright/test";
import { open } from "./support/open";

/**
 * The default build has ads switched off (no ADS_ENABLED flag). Nothing about advertising may
 * appear: no ad boxes, no empty gaps, no AdSense request. The ads-enabled build is covered by
 * e2e/ads/ads.spec.ts (`pnpm e2e:ads`).
 */

const SLUGS = [
  "mortgage-calculator",
  "loan-calculator",
  "compound-interest-calculator",
  "simple-interest-calculator",
  "savings-goal-calculator",
  "retirement-calculator",
  "car-loan-calculator",
  "credit-card-payoff-calculator",
  "debt-payoff-planner",
  "income-tax-calculator",
  "inflation-calculator",
  "roi-calculator",
];

// The stored choice for these tests is "Reject all". Visitors who accepted advertising are covered below.
test.describe("with ads switched off", () => {
  for (const slug of SLUGS) {
    test(`${slug} has no ad elements`, async ({ page }) => {
      const adRequests: string[] = [];
      page.on("request", (r) => {
        if (/googlesyndication|doubleclick|adsbygoogle/.test(r.url())) adRequests.push(r.url());
      });
      await open(page, `/${slug}`);
      await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
      await expect(page.locator("[data-ad-placement], [data-ad-placeholder]")).toHaveCount(0);
      await expect(page.getByText("Advertisement")).toHaveCount(0);
      expect(adRequests).toEqual([]);
    });
  }

  test("accepting advertising cookies still loads nothing while ads are off", async ({
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
                value: JSON.stringify({
                  v: 1,
                  analytics: true,
                  ads: true,
                  at: "2026-01-01T00:00:00.000Z",
                }),
              },
            ],
          },
        ],
      },
    });
    const page = await context.newPage();
    const requests: string[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).hostname !== "localhost") requests.push(r.url());
    });
    await open(page, "/mortgage-calculator");
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await expect(page.locator("script[src*='googlesyndication']")).toHaveCount(0);
    expect(requests).toEqual([]);
    await context.close();
  });

  test("leaves no blank gap where an ad would have been", async ({ page }) => {
    await open(page, "/loan-calculator");
    // The wrappers that would hold the mobile/desktop ads are not rendered at all.
    await expect(page.locator("div.lg\\:hidden:empty, div.hidden.lg\\:block:empty")).toHaveCount(0);
    const gaps = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("main div")).filter(
          (el) =>
            el.children.length === 0 &&
            el.textContent === "" &&
            (el as HTMLElement).offsetHeight > 20,
        ).length,
    );
    expect(gaps).toBe(0);
  });

  test("serves ads.txt as plain text with a valid record", async ({ request }) => {
    const res = await request.get("/ads.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    expect(await res.text()).toMatch(/^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0$/m);
  });

  test("robots.txt does not block ads.txt", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).not.toMatch(/Disallow: \/ads\.txt/);
  });

  test("no affiliate card or disclosure appears while every offer is inactive", async ({
    page,
  }) => {
    await open(page, "/credit-card-payoff-calculator");
    await expect(page.locator("[data-affiliate-id]")).toHaveCount(0);
    await expect(page.getByText("Sponsored", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("affiliate-disclosure")).toHaveCount(0);
  });
});
