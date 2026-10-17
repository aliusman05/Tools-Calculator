import { expect, test } from "@playwright/test";
import { captureClipboard, copiedLink } from "./support/clipboard";
import { open } from "./support/open";

/**
 * Typed values stay out of the address bar. They travel only in a link the visitor copies on purpose,
 * and the canonical URL, sitemap and structured data never carry a query string.
 */
const CALCULATORS = [
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

test.describe("canonical URLs ignore query parameters", () => {
  for (const slug of CALCULATORS) {
    test(`${slug}: a page opened with a share link still declares the clean URL`, async ({
      request,
    }) => {
      const html = await (
        await request.get(`/${slug}?annualRatePct=9&amount=123&utm_source=x`)
      ).text();
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      expect(canonical, slug).toMatch(new RegExp(`/${slug}$`));
      const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
      if (ogUrl) expect(ogUrl).not.toContain("?");
      const jsonLd = [
        ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
      ];
      expect(jsonLd.length).toBeGreaterThan(0);
      for (const [, body] of jsonLd) {
        for (const url of body.matchAll(/"(?:url|item|@id)":"([^"]+)"/g)) {
          expect(url[1], `${slug} JSON-LD`).not.toContain("?");
        }
      }
    });
  }

  test("the sitemap lists no URL with a query string", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(20);
    for (const loc of locs) expect(loc).not.toContain("?");
  });
});

test.describe("Copy link", () => {
  test("typing never changes the address, and the link carries only what was typed", async ({
    page,
  }) => {
    await open(page, "/loan-calculator");
    await page.locator("#loan-amount").fill("31000");
    await page.waitForTimeout(700);
    expect(page.url()).toMatch(/\/loan-calculator$/);

    await captureClipboard(page);
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
    const link = new URL(await copiedLink(page));
    expect(link.pathname).toBe("/loan-calculator");
    expect(link.searchParams.get("amount")).toBe("31000");
    expect(link.hash).toBe("");
    expect(page.url()).toMatch(/\/loan-calculator$/); // copying did not touch the address either
  });

  test("an untouched calculator copies just the page address", async ({ page }) => {
    await open(page, "/roi-calculator");
    await captureClipboard(page);
    await page.getByRole("button", { name: "Copy link" }).click();
    expect(new URL(await copiedLink(page)).search).toBe("");
  });

  test("opening a shared link prefills the inputs, then cleans the address", async ({ page }) => {
    await page.goto("/loan-calculator?amount=31000&annualRatePct=4.5&utm_source=news");
    await expect(page.locator("#loan-amount")).toHaveValue("31,000");
    await expect.poll(() => new URL(page.url()).search).toBe("?utm_source=news");
  });

  test("nonsense in a shared link is ignored or clamped, never crashes the page", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/loan-calculator?amount=1e99&annualRatePct=banana&termUnit=%3Cscript%3E");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => new URL(page.url()).search).toBe("");
    expect(await page.locator("body").innerText()).not.toMatch(/NaN|undefined|Infinity/);
    expect(errors).toEqual([]);
  });

  test("shows a field to copy by hand when the clipboard is unavailable", async ({ page }) => {
    await open(page, "/loan-calculator");
    await page.locator("#loan-amount").fill("31000");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await page.getByRole("button", { name: "Copy link" }).click();
    const field = page.getByLabel("Link with your inputs");
    await expect(field).toBeVisible();
    await expect(field).toHaveValue(/\/loan-calculator\?.*amount=31000/);
  });

  test("the button is keyboard operable and labelled", async ({ page }) => {
    await open(page, "/loan-calculator");
    const button = page.getByRole("button", { name: "Copy link" });
    await button.focus();
    await expect(button).toBeFocused();
    // The live region exists before it is needed, so screen readers announce the message when it appears.
    await expect(page.getByTestId("share-link").getByRole("status")).toHaveCount(1);
  });
});
