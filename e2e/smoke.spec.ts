import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { captureClipboard, copiedLink } from "./support/clipboard";
import { CALCULATOR_SLUGS } from "./support/calculators";
import { open } from "./support/open";

/**
 * Smoke tests: the cheapest checks that catch a broken release. Every page loads cleanly; every
 * calculator reacts to input, survives empty and nonsense input without leaking NaN, restores its
 * state from a copied share link, and renders its answer on the server (so it works before, or without,
 * JavaScript).
 */

const CALCULATORS = CALCULATOR_SLUGS;

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
}

/**
 * Next.js prefetches linked pages in the background (requests with `?_rsc=`). When the test moves on to
 * the next page while a prefetch is still in flight, the browser cancels it, and WebKit reports that as
 * a failed request or a "due to access control checks" page error. That is the cancellation, not a
 * problem with the site, so exactly that combination is ignored. Any other failure, including a
 * failed or 4xx/5xx request for a real page, is still reported.
 */
function isCancelledPrefetch(message: string): boolean {
  return (
    message.includes("_rsc=") &&
    (message.includes("Load request cancelled") || message.includes("due to access control checks"))
  );
}

/** Collect everything that should never happen in a healthy page. */
function watchForProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => {
    if (!isCancelledPrefetch(e.message)) problems.push(`pageerror: ${e.message}`);
  });
  page.on("requestfailed", (r) => {
    const message = `request failed: ${r.url()} (${r.failure()?.errorText})`;
    if (!isCancelledPrefetch(message)) problems.push(message);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  return problems;
}

const BAD_TEXT = /\bNaN\b|\bInfinity\b|\bundefined\b|\[object |\bnull\b(?!\s*,)/;

async function visibleText(page: Page) {
  return page.locator("main").innerText();
}

test.describe("every page", () => {
  test("is listed in a valid sitemap and returns 200", async ({ request }) => {
    const paths = await sitemapPaths(request);
    expect(paths.length).toBeGreaterThanOrEqual(24);
    for (const path of paths) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()["content-type"], path).toContain("text/html");
    }
  });

  test("loads with no console errors or warnings, no failed or 4xx/5xx requests", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const problems = watchForProblems(page);
    for (const path of await sitemapPaths(request)) {
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
    expect(problems).toEqual([]);
  });

  for (const width of [375, 1280]) {
    test(`has no horizontal scroll at ${width}px`, async ({ page, request }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 800 });
      const wide: string[] = [];
      for (const path of await sitemapPaths(request)) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (overflow > 0) wide.push(`${path} (+${overflow}px)`);
      }
      expect(wide).toEqual([]);
    });
  }

  test("never shows NaN, Infinity, undefined or [object Object]", async ({ page, request }) => {
    test.setTimeout(180_000);
    const bad: string[] = [];
    for (const path of await sitemapPaths(request)) {
      await page.goto(path);
      const text = await visibleText(page);
      const hit = text.match(BAD_TEXT);
      if (hit) bad.push(`${path}: "${hit[0]}"`);
    }
    expect(bad).toEqual([]);
  });

  test("unknown URLs return a real 404 page with a way back", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Go to the home page" })).toBeVisible();
  });
});

test.describe("calculators accept input and show a result", () => {
  for (const slug of CALCULATORS) {
    test(slug, async ({ page }) => {
      const problems = watchForProblems(page);
      await open(page, `/${slug}`);

      const results = page.getByRole("region", { name: /results$/i });
      await expect(results).toBeVisible();
      const before = await results.innerText();
      expect(before, "results should contain a number").toMatch(/[$%\d]/);

      // Change the first numeric field and expect the answer to move.
      const field = page
        .getByRole("region", { name: /inputs$/i })
        .locator("input[inputmode='decimal']")
        .first();
      const original = await field.inputValue();
      expect(original, "first numeric field starts with a value").not.toBe("");
      const digits = Number(original.replace(/[^\d.]/g, ""));
      await field.fill(String(digits + 7));
      await expect.poll(() => results.innerText()).not.toBe(before);
      expect(await visibleText(page)).not.toMatch(BAD_TEXT);

      expect(problems).toEqual([]);
    });
  }
});

test.describe("calculators survive empty and nonsense input", () => {
  for (const slug of CALCULATORS) {
    test(slug, async ({ page }) => {
      const problems = watchForProblems(page);
      await open(page, `/${slug}`);
      const fields = page
        .getByRole("region", { name: /inputs$/i })
        .locator("input[inputmode='decimal']");
      const count = await fields.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const field = fields.nth(i);
        const original = await field.inputValue();

        await field.fill(""); // empty
        expect(await visibleText(page), `${slug} field ${i} emptied`).not.toMatch(BAD_TEXT);

        await field.fill("9".repeat(15)); // absurdly large
        expect(await visibleText(page), `${slug} field ${i} huge`).not.toMatch(BAD_TEXT);

        await field.fill("0");
        expect(await visibleText(page), `${slug} field ${i} zero`).not.toMatch(BAD_TEXT);

        await field.fill("abc-.!"); // letters and symbols are stripped
        expect(await field.inputValue(), `${slug} field ${i} junk`).toMatch(/^[\d.,]*$/);

        await field.fill(original);
      }

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // page is still alive
      expect(problems).toEqual([]);
    });
  }
});

test.describe("calculators keep the address clean and restore their state from a copied link", () => {
  for (const slug of CALCULATORS) {
    test(slug, async ({ page }) => {
      await open(page, `/${slug}`);
      const field = page
        .getByRole("region", { name: /inputs$/i })
        .locator("input[inputmode='decimal']")
        .first();
      const digits = Number((await field.inputValue()).replace(/[^\d.]/g, ""));
      await field.fill(String(digits + 3));
      await page.waitForTimeout(700); // longer than the old debounce: nothing may reach the address bar
      expect(new URL(page.url()).search).toBe("");
      // Compare the figures only: the chart lazy-loads, so its axis labels differ between visits.
      const figures = (page: Page) =>
        page
          .getByRole("region", { name: /results$/i })
          .locator("dl")
          .allInnerTexts();
      const changed = await figures(page);
      await captureClipboard(page);
      await page.getByRole("button", { name: "Copy link" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
      const link = await copiedLink(page);
      expect(new URL(link).search).not.toBe("");

      // A fresh visitor opening the shared link sees the same numbers.
      const fresh = await page.context().newPage();
      await fresh.goto(link);
      await fresh.waitForLoadState("networkidle");
      await expect.poll(() => figures(fresh)).toEqual(changed);
      // The values were read once, then removed. Polled because WebKit reports a replaceState change late.
      await expect.poll(() => new URL(fresh.url()).search).toBe("");
      await fresh.close();
    });
  }
});

test.describe("answers are rendered on the server", () => {
  // This is a property of the HTML the server sends, so it is checked on the raw response. That is
  // what a crawler, a reader mode or a browser with JavaScript off receives, and it behaves the same in
  // every browser engine.
  const EXPECTED: Record<string, string> = {
    "mortgage-calculator": "$2,514.28",
    "loan-calculator": "$493.85",
    "compound-interest-calculator": "$47,526.55",
    "simple-interest-calculator": "$900.00",
    "savings-goal-calculator": "$288.94",
    "retirement-calculator": "$1,858,360",
    "car-loan-calculator": "$538.66",
    "credit-card-payoff-calculator": "2 years 9 months",
    "debt-payoff-planner": "$2,369.04",
    "income-tax-calculator": "$9,870.00",
    "inflation-calculator": "$1,806.11",
    "roi-calculator": "50.00%",
    "refinance-calculator": "1 year 1 month",
    "student-loan-calculator": "$379.84",
    "rent-vs-buy-calculator": "$7,783",
  };

  for (const slug of CALCULATORS) {
    test(`${slug} ships its default answer in the HTML`, async ({ request }) => {
      const html = await (await request.get(`/${slug}`)).text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&");
      expect(text).toContain(EXPECTED[slug]!);
      expect(html).toMatch(/<h1[\s>]/);
      expect(text).toContain("How it works");
      expect(text).toContain("Frequently asked questions");
    });
  }

  test("content pages ship their content in the HTML", async ({ request }) => {
    for (const path of ["/", "/about", "/privacy-policy", "/category/loans"]) {
      const html = await (await request.get(path)).text();
      expect(html, path).toMatch(/<h1[\s>]/);
      expect(html.length, path).toBeGreaterThan(5_000);
    }
  });
});

test.describe("getting around", () => {
  test("home to category to calculator by clicking", async ({ page }) => {
    await open(page, "/");
    await page
      .getByRole("main")
      .getByRole("link", { name: /Loans & Mortgages/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/category\/loans$/);
    await page
      .getByRole("link", { name: /^Mortgage Calculator/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/mortgage-calculator$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Mortgage Calculator");
  });

  test("the header search finds and opens a calculator", async ({ page }) => {
    await open(page, "/");
    // On a phone the search is inside the menu; on a wider screen it sits in the header.
    const small = (page.viewportSize()?.width ?? 1280) < 768;
    if (small) await page.getByRole("button", { name: "Menu" }).click();
    const search = page.getByRole("search", { name: small ? "Menu search" : "Site search" });
    await search.getByLabel("Search calculators").fill("inflation");
    await search.getByRole("link", { name: "Inflation Calculator" }).click();
    await expect(page).toHaveURL(/\/inflation-calculator$/);
  });

  test("breadcrumbs lead back up", async ({ page }) => {
    await open(page, "/debt-payoff-planner");
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Debt" })
      .click();
    await expect(page).toHaveURL(/\/category\/debt$/);
  });

  test("the footer reaches every information page", async ({ page }) => {
    for (const [name, url] of [
      ["About", /\/about$/],
      ["Contact", /\/contact$/],
      ["Privacy Policy", /\/privacy-policy$/],
      ["Terms of Use", /\/terms$/],
      ["Disclaimer", /\/disclaimer$/],
    ] as const) {
      await open(page, "/");
      await page.getByRole("contentinfo").getByRole("link", { name }).click();
      await expect(page).toHaveURL(url);
    }
  });
});
