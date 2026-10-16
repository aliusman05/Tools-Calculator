import { expect, test, type Page } from "@playwright/test";
import { open } from "./support/open";

/**
 * Regression guards for the performance work in docs/PERFORMANCE.md. These check the *causes* of
 * good (or bad) Lighthouse scores, which are stable, rather than the scores themselves, which
 * swing by several points with machine load.
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

/** A phrase that appears in exactly one calculator's UI code. */
const MARKER: Record<string, string> = {
  "mortgage-calculator": "Taxes, insurance &",
  "loan-calculator": "Optional. Goes straight to principal.",
  "compound-interest-calculator": "Deposits are made",
  "simple-interest-calculator": "Compare with compound interest",
  "savings-goal-calculator": "Time to reach the goal",
  "retirement-calculator": "Employer match rate",
  "car-loan-calculator": "Still owed on trade-in",
  "credit-card-payoff-calculator": "What to pay to be debt-free by a date",
  "debt-payoff-planner": "Remove last debt",
  "income-tax-calculator": "People who are 65 or older or blind",
  "inflation-calculator": "Annual inflation rate",
  "roi-calculator": "How long you held it",
};

/** Load a page and return the text of every JavaScript file it requested. */
async function scriptBodies(page: Page, path: string, scrollToBottom = false): Promise<string[]> {
  const pending: Promise<string>[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/_next/static/") && res.url().endsWith(".js")) {
      pending.push(res.text().catch(() => ""));
    }
  });
  await open(page, path);
  if (scrollToBottom) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }
  return Promise.all(pending);
}

test.describe("code splitting", () => {
  test("a content page loads no calculator code", async ({ page }) => {
    const bodies = (await scriptBodies(page, "/about", true)).join("\n");
    for (const slug of SLUGS) {
      expect(bodies.includes(MARKER[slug]!), `/about downloaded ${slug}`).toBe(false);
    }
  });

  test("the home page loads no calculator code", async ({ page }) => {
    const bodies = (await scriptBodies(page, "/")).join("\n");
    for (const slug of SLUGS) {
      expect(bodies.includes(MARKER[slug]!), `/ downloaded ${slug}`).toBe(false);
    }
  });

  for (const slug of SLUGS) {
    test(`${slug} loads only its own calculator code`, async ({ page }) => {
      const bodies = (await scriptBodies(page, `/${slug}`)).join("\n");
      expect(bodies.includes(MARKER[slug]!), `${slug} is missing its own code`).toBe(true);
      for (const other of SLUGS.filter((s) => s !== slug)) {
        expect(bodies.includes(MARKER[other]!), `${slug} also downloaded ${other}`).toBe(false);
      }
    });
  }

  test("the chart library is not requested until the chart is near the viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const loaded: string[] = [];
    page.on("response", async (res) => {
      if (res.url().includes("/_next/static/") && res.url().endsWith(".js")) {
        const text = await res.text().catch(() => "");
        if (text.includes("recharts-surface")) loaded.push(res.url());
      }
    });
    await open(page, "/mortgage-calculator");
    await page.waitForTimeout(800);
    expect(loaded, "Recharts was loaded before the chart was visible").toEqual([]);

    await page.getByRole("img", { name: /Remaining balance falls/ }).scrollIntoViewIfNeeded();
    await expect(page.locator('svg[role="application"]')).toBeVisible();
    expect(loaded.length).toBeGreaterThan(0);
  });

  test("the chart's space is reserved, so loading it moves nothing", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await open(page, "/mortgage-calculator");
    const chart = page.getByRole("img", { name: /Remaining balance falls/ });
    const before = (await chart.boundingBox())!;
    await chart.scrollIntoViewIfNeeded();
    await expect(page.locator('svg[role="application"]')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    const after = (await chart.boundingBox())!;
    expect(after.height).toBe(before.height);
  });
});

test.describe("fonts and caching", () => {
  test("no web font is downloaded (the site uses the system font stack)", async ({ page }) => {
    const fonts: string[] = [];
    page.on("request", (r) => {
      if (/\.(woff2?|ttf|otf)(\?|$)/.test(r.url()) || r.resourceType() === "font")
        fonts.push(r.url());
    });
    await open(page, "/mortgage-calculator");
    expect(fonts).toEqual([]);
  });

  test("hashed assets are cached for a year and immutable", async ({ page, request }) => {
    await open(page, "/");
    const src = await page.locator('script[src*="/_next/static/"]').first().getAttribute("src");
    const res = await request.get(src!);
    expect(res.headers()["cache-control"]).toMatch(/max-age=31536000/);
    expect(res.headers()["cache-control"]).toMatch(/immutable/);
  });

  test("text responses are compressed", async ({ request }) => {
    for (const path of ["/", "/mortgage-calculator"]) {
      const res = await request.get(path, { headers: { "accept-encoding": "gzip, br" } });
      expect(res.headers()["content-encoding"], path).toMatch(/gzip|br|zstd/);
    }
  });
});

test.describe("layout stability on first load", () => {
  for (const [label, viewport] of [
    ["desktop", { width: 1280, height: 800 }],
    ["mobile", { width: 375, height: 800 }],
  ] as const) {
    test(`every calculator loads with no layout shift (${label})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as Array<{
            value: number;
            hadRecentInput: boolean;
          }>) {
            if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      for (const slug of SLUGS) {
        await page.goto(`/${slug}`);
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(250);
        const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
        expect(cls, `${slug} (${label})`).toBeLessThan(0.02);
      }
    });
  }

  test("the cookie banner appears without shifting the page (first visit)", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://localhost:3100",
      viewport: { width: 375, height: 800 },
      storageState: { cookies: [], origins: [] }, // first visit, so the banner appears
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Array<{
          value: number;
          hadRecentInput: boolean;
        }>) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/mortgage-calculator");
    await expect(page.getByRole("dialog", { name: "Your privacy choices" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(
      0.02,
    );
    await context.close();
  });
});

test.describe("responsiveness", () => {
  test("typing into a calculator stays under 200ms per interaction with a 4x slower CPU", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page, "/debt-payoff-planner");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.evaluate(() => {
      (window as unknown as { __events: number[] }).__events = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          (window as unknown as { __events: number[] }).__events.push(e.duration);
      }).observe({
        type: "event",
        durationThreshold: 16,
        buffered: false,
      } as PerformanceObserverInit);
    });

    const field = page.locator("#dp-balance-0");
    await field.click();
    await field.press("ControlOrMeta+a");
    await field.pressSequentially("987654", { delay: 60 });
    await page.locator("#dp-extra").fill("275");
    await page.getByRole("button", { name: "Add a debt" }).click();
    await page.waitForTimeout(400);

    const events = await page.evaluate(
      () => (window as unknown as { __events: number[] }).__events,
    );
    expect(events.length).toBeGreaterThan(0);
    // Event Timing durations are rounded to 8ms; the INP "good" threshold is 200ms.
    expect(
      Math.max(...events),
      `slowest interaction: ${Math.max(...events)}ms of ${events.length} events`,
    ).toBeLessThan(200);
  });

  test("the mortgage result updates promptly after a keystroke on a slow CPU", async ({ page }) => {
    await open(page, "/mortgage-calculator");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    const before = await page
      .getByRole("region", { name: /results$/i })
      .locator('[aria-live="polite"]')
      .first()
      .innerText();
    const t0 = Date.now();
    await page.locator("#mortgage-price").pressSequentially("5");
    await expect
      .poll(
        async () =>
          page
            .getByRole("region", { name: /results$/i })
            .locator('[aria-live="polite"]')
            .first()
            .innerText(),
        { timeout: 3000 },
      )
      .not.toBe(before);
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});
