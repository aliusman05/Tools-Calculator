import { expect, test, type Page } from "@playwright/test";

/**
 * Runs against a build with ads ENABLED (fake publisher and slot IDs). The AdSense script is
 * never fetched from Google: the request is intercepted and answered with a stub.
 */

const CONSENT_KEY = "fincalc-consent";
const ADSENSE = /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/;

const consent = (ads: boolean) =>
  JSON.stringify({ v: 1, analytics: false, ads, at: "2026-01-01T00:00:00.000Z" });

/** Pretend to be a visitor with a stored choice (or none, with `undefined`). */
async function withConsent(page: Page, ads: boolean | undefined) {
  if (ads === undefined) return;
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [CONSENT_KEY, consent(ads)],
  );
}

/** Intercept AdSense, count requests, and answer with a stub library. */
async function stubAdSense(page: Page) {
  const requests: string[] = [];
  await page.route(ADSENSE, (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      contentType: "application/javascript",
      body: "window.adsbygoogle = window.adsbygoogle || [];",
    });
  });
  return requests;
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const slot = (page: Page, name: string) => page.locator(`[data-ad-placement="${name}"]`);
const allSlots = (page: Page) => page.locator("[data-ad-placement]");

const CALC = "/mortgage-calculator";

test.describe("consent gating", () => {
  test("loads no AdSense script and renders no ad before the visitor chooses", async ({ page }) => {
    const requests = await stubAdSense(page);
    await open(page, CALC);
    await expect(page.getByRole("dialog", { name: "Your privacy choices" })).toBeVisible();
    await expect(allSlots(page)).toHaveCount(0);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("loads nothing after Reject all", async ({ page }) => {
    const requests = await stubAdSense(page);
    await open(page, CALC);
    await page.getByRole("button", { name: "Reject all" }).click();
    await page.waitForTimeout(500);
    await expect(allSlots(page)).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("loads nothing for a returning visitor who rejected advertising", async ({ page }) => {
    const requests = await stubAdSense(page);
    await withConsent(page, false);
    await open(page, CALC);
    await expect(allSlots(page)).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("loads the library and shows slots as soon as the visitor accepts", async ({ page }) => {
    const requests = await stubAdSense(page);
    await open(page, CALC);
    expect(requests).toEqual([]);
    await page.getByRole("button", { name: "Accept all" }).click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toContain("client=ca-pub-1234567890123456");
    await expect(allSlots(page).first()).toBeAttached();
  });

  test("accepting only analytics does not enable advertising", async ({ page }) => {
    const requests = await stubAdSense(page);
    await open(page, CALC);
    await page.getByRole("button", { name: "Customize" }).click();
    await page.getByRole("checkbox", { name: /Analytics/ }).check();
    await page.getByRole("button", { name: "Save my choices" }).click();
    await page.waitForTimeout(500);
    await expect(allSlots(page)).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("loads the library once for a returning visitor who accepted", async ({ page }) => {
    const requests = await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    await expect.poll(() => requests.length).toBe(1);
  });

  test("removes the ad boxes when consent is withdrawn", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    await expect(allSlots(page).first()).toBeAttached();
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await page.getByRole("checkbox", { name: /Advertising/ }).uncheck();
    await page.getByRole("button", { name: "Save my choices" }).click();
    await expect(allSlots(page)).toHaveCount(0);
  });
});

test.describe("placement on a calculator page (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("shows the sidebar, in-content and page-end ads, but not the mobile-only one", async ({
    page,
  }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    await expect(slot(page, "sidebar")).toBeVisible();
    await expect(slot(page, "inContent")).toBeAttached();
    await expect(slot(page, "pageEnd")).toBeAttached();
    await expect(slot(page, "calculatorBelow")).toBeHidden();
  });

  test("keeps every ad below the page heading and the calculator inputs", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const inputs = (await page.getByRole("region", { name: /inputs$/i }).boundingBox())!;
    for (const name of ["sidebar", "inContent", "pageEnd"]) {
      const box = (await slot(page, name).boundingBox())!;
      expect(box.y, `${name} vs heading`).toBeGreaterThan(h1.y + h1.height);
      expect(box.y, `${name} vs inputs`).toBeGreaterThan(inputs.y);
    }
  });

  test("puts the in-content ad between 'How it works' and 'Worked example'", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    const how = (await page.getByRole("heading", { name: "How it works" }).boundingBox())!;
    const worked = (await page.getByRole("heading", { name: "Worked example" }).boundingBox())!;
    const ad = (await slot(page, "inContent").boundingBox())!;
    expect(ad.y).toBeGreaterThan(how.y);
    expect(ad.y + ad.height).toBeLessThan(worked.y);
  });

  test("puts the page-end ad after the related calculators and before the footer", async ({
    page,
  }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    const related = (await page
      .getByRole("heading", { name: "Related calculators" })
      .boundingBox())!;
    const ad = (await slot(page, "pageEnd").boundingBox())!;
    const footer = (await page.getByRole("contentinfo").boundingBox())!;
    expect(ad.y).toBeGreaterThan(related.y);
    expect(ad.y + ad.height).toBeLessThan(footer.y);
  });
});

test.describe("placement on a calculator page (mobile)", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("shows the below-calculator ad after the results, not the sidebar ad", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    await expect(slot(page, "calculatorBelow")).toBeVisible();
    await expect(slot(page, "sidebar")).toBeHidden();
    const results = (await page.getByRole("region", { name: /results$/i }).boundingBox())!;
    const below = (await slot(page, "calculatorBelow").boundingBox())!;
    const inputs = (await page.getByRole("region", { name: /inputs$/i }).boundingBox())!;
    expect(below.y).toBeGreaterThan(results.y + results.height);
    expect(below.y).toBeGreaterThan(inputs.y + inputs.height);
  });

  test("shows three ads at most per page", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    const visible = await allSlots(page).evaluateAll(
      (els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).length,
    );
    expect(visible).toBeLessThanOrEqual(3);
    expect(visible).toBeGreaterThanOrEqual(3);
  });
});

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["mobile", { width: 375, height: 800 }],
] as const) {
  test.describe(`spacing (${name})`, () => {
    test.use({ viewport });

    test("keeps every ad at least 24px away from any input, button or link", async ({ page }) => {
      await stubAdSense(page);
      await withConsent(page, true);
      await open(page, CALC);
      const result = await page.evaluate(() => {
        const interactive = Array.from(
          document.querySelectorAll<HTMLElement>(
            "main a, main button, main input, main select, main textarea, main summary",
          ),
        );
        const out: Array<{ placement: string; gap: number; near: string }> = [];
        for (const ad of document.querySelectorAll<HTMLElement>("[data-ad-placement]")) {
          if (ad.offsetParent === null) continue;
          const a = ad.getBoundingClientRect();
          let min = Infinity;
          let near = "";
          for (const el of interactive) {
            if (ad.contains(el) || el.offsetParent === null) continue;
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) continue;
            const overlapsX = b.left < a.right && b.right > a.left;
            if (!overlapsX) continue;
            const gap =
              b.top >= a.bottom ? b.top - a.bottom : a.top >= b.bottom ? a.top - b.bottom : 0;
            if (gap < min) {
              min = gap;
              near = (el.textContent || el.getAttribute("aria-label") || el.tagName)
                .trim()
                .slice(0, 40);
            }
          }
          out.push({ placement: ad.dataset.adPlacement!, gap: min, near });
        }
        return out;
      });
      expect(result.length).toBeGreaterThan(0);
      for (const r of result) {
        expect(r.gap, `${r.placement} is only ${r.gap}px from "${r.near}"`).toBeGreaterThanOrEqual(
          24,
        );
      }
    });

    test("keeps ads to a small share of the page so content stays above them", async ({ page }) => {
      await stubAdSense(page);
      await withConsent(page, true);
      await open(page, CALC);
      const { adHeight, pageHeight } = await page.evaluate(() => ({
        adHeight: Array.from(document.querySelectorAll<HTMLElement>("[data-ad-placement]"))
          .filter((el) => el.offsetParent !== null)
          .reduce((sum, el) => sum + el.offsetHeight, 0),
        pageHeight: document.documentElement.scrollHeight,
      }));
      expect(adHeight / pageHeight).toBeLessThan(0.25);
    });
  });
}

test.describe("lazy loading and reserved space", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("reserves the full height before any ad is requested", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    // The page-end slot is far below the viewport, so no ad has been requested for it yet...
    await expect(slot(page, "pageEnd").locator("ins")).toHaveCount(0);
    // ...but its space is already held.
    const box = (await slot(page, "pageEnd").locator("> div").boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(250);
  });

  test("requests an ad only when its slot scrolls near the viewport", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    await expect(slot(page, "pageEnd").locator("ins")).toHaveCount(0);
    await slot(page, "pageEnd").scrollIntoViewIfNeeded();
    await expect(slot(page, "pageEnd").locator("ins.adsbygoogle")).toHaveCount(1);
    const pushes = await page.evaluate(() => (window.adsbygoogle ?? []).length);
    expect(pushes).toBeGreaterThanOrEqual(1);
  });

  test("never requests the mobile-only ad on desktop", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await expect(slot(page, "calculatorBelow").locator("ins")).toHaveCount(0);
  });

  test("renders ad units with the publisher, slot, format and test-mode attributes", async ({
    page,
  }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    await slot(page, "sidebar").scrollIntoViewIfNeeded();
    const ins = slot(page, "sidebar").locator("ins.adsbygoogle");
    await expect(ins).toHaveAttribute("data-ad-client", "ca-pub-1234567890123456");
    await expect(ins).toHaveAttribute("data-ad-slot", "2222222222");
    await expect(ins).toHaveAttribute("data-ad-format", "auto");
    await expect(ins).toHaveAttribute("data-full-width-responsive", "true");
    await expect(ins).toHaveAttribute("data-adtest", "on");
  });

  test("labels every ad as an advertisement", async ({ page }) => {
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    const count = await allSlots(page).count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(allSlots(page).nth(i)).toContainText("Advertisement");
    }
  });
});

test.describe("layout stability", () => {
  for (const [label, viewport] of [
    ["desktop", { width: 1280, height: 800 }],
    ["mobile", { width: 375, height: 800 }],
  ] as const) {
    test(`ads cause no layout shift while scrolling the whole page (${label})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await stubAdSense(page);
      await withConsent(page, true);
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as Array<{
            value: number;
            hadRecentInput: boolean;
          }>) {
            if (!entry.hadRecentInput)
              (window as unknown as { __cls: number }).__cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(CALC);
      await page.waitForLoadState("networkidle");

      // Scroll down in steps so every slot comes near the viewport, then back up.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y <= height; y += 400) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      // Google's "good" threshold is 0.1; ads are expected to contribute (almost) nothing.
      expect(cls).toBeLessThan(0.02);
    });
  }

  test("the ad boxes keep their size when the ad arrives", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await stubAdSense(page);
    await withConsent(page, true);
    await open(page, CALC);
    const box = slot(page, "pageEnd");
    const before = (await box.boundingBox())!;
    await box.scrollIntoViewIfNeeded();
    await expect(box.locator("ins")).toHaveCount(1);
    await page.waitForTimeout(300);
    const after = (await box.boundingBox())!;
    expect(after.height).toBe(before.height);
  });
});

test.describe("pages that must stay ad-free", () => {
  for (const path of [
    "/",
    "/category/loans",
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms",
    "/disclaimer",
    "/search?q=loan",
  ]) {
    test(`${path} has no ads`, async ({ page }) => {
      await stubAdSense(page);
      await withConsent(page, true);
      await page.goto(path);
      await page.waitForTimeout(600);
      await expect(allSlots(page)).toHaveCount(0);
      await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    });
  }
});

test.describe("every calculator", () => {
  const slugs = [
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

  for (const slug of slugs) {
    test(`${slug}: three ads on desktop, in the right order, calculator still works`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await stubAdSense(page);
      await withConsent(page, true);
      await open(page, `/${slug}`);

      const placements = await allSlots(page).evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => (el as HTMLElement).dataset.adPlacement),
      );
      expect(placements.sort()).toEqual(["inContent", "pageEnd", "sidebar"]);

      const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      const inputs = (await page.getByRole("region", { name: /inputs$/i }).boundingBox())!;
      for (const p of placements) {
        const b = (await slot(page, p!).boundingBox())!;
        expect(b.y, `${slug} ${p}`).toBeGreaterThan(Math.max(h1.y + h1.height, inputs.y));
      }

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByTestId("result-disclaimer")).toBeVisible();
    });
  }
});

test("ads.txt is served by the ads build too", async ({ request }) => {
  const res = await request.get("/ads.txt");
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0/);
});
