import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { open } from "./support/open";

/**
 * Automated accessibility checks with axe-core: WCAG 2.0/2.1/2.2 A and AA rules plus axe's
 * best-practice rules, on every page, in light AND dark mode (contrast is checked in both), and in
 * the interactive states that tend to hide problems (open menu, cookie banner, validation errors,
 * open schedule). Automated checks cannot prove a page is accessible, but they catch the common
 * failures, and the keyboard and ARIA tests below cover things axe cannot.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function violations(page: Page, label: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) =>
      `${label}: ${v.id} [${v.impact}] ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"}, e.g. ${v.nodes[0]?.target.join(" ")})`,
  );
}

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const xml = await (await request.get("/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("every page has no axe violations", async ({ page, request }) => {
      test.setTimeout(240_000);
      const found: string[] = [];
      for (const path of [...(await sitemapPaths(request)), "/search?q=loan", "/does-not-exist"]) {
        await page.goto(path);
        await page.waitForLoadState("domcontentloaded");
        found.push(...(await violations(page, `${scheme} ${path}`)));
      }
      expect(found).toEqual([]);
    });

    test("interactive states have no axe violations", async ({ page }) => {
      test.setTimeout(120_000);
      const found: string[] = [];

      // Calculator with its schedule open.
      await open(page, "/mortgage-calculator");
      await page.getByRole("button", { name: /Amortization schedule/ }).click();
      found.push(...(await violations(page, `${scheme} mortgage with schedule`)));
      await page.getByRole("button", { name: "Monthly" }).click();
      found.push(...(await violations(page, `${scheme} mortgage monthly schedule`)));

      // Validation errors shown.
      await open(page, "/loan-calculator");
      await page.locator("#loan-amount").fill("");
      await page.locator("#loan-rate").fill("-5");
      found.push(...(await violations(page, `${scheme} loan with errors`)));

      // Tabs and other widgets on the calculators that use them.
      await open(page, "/debt-payoff-planner");
      found.push(...(await violations(page, `${scheme} debt planner`)));
      await open(page, "/savings-goal-calculator");
      await page.locator("#sg-mode").selectOption("time");
      found.push(...(await violations(page, `${scheme} savings goal (time mode)`)));
      await open(page, "/income-tax-calculator");
      await page.locator("#tax-deduction-type").selectOption("itemized");
      found.push(...(await violations(page, `${scheme} tax itemized`)));

      // Contact form with an error and the success state.
      await page.route("**/api/contact", (route) =>
        route.fulfill({
          status: 422,
          json: { ok: false, errors: { email: "Please enter a valid email address." } },
        }),
      );
      await open(page, "/contact");
      await page.getByLabel("Your name").fill("Ada");
      await page.getByLabel("Your email address").fill("nope");
      await page.getByLabel("Your message").fill("A perfectly reasonable message for the team.");
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
      found.push(...(await violations(page, `${scheme} contact with error`)));

      expect(found).toEqual([]);
    });

    test("the mobile menu has no axe violations when open", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await open(page, "/");
      await page.getByRole("button", { name: "Menu" }).click();
      expect(await violations(page, `${scheme} mobile menu`)).toEqual([]);
    });
  });

  test.describe(`${scheme} mode, first visit`, () => {
    test.use({ colorScheme: scheme, storageState: { cookies: [], origins: [] } });

    test("the cookie banner and its customize panel have no axe violations", async ({ page }) => {
      await open(page, "/loan-calculator");
      await expect(page.getByRole("dialog", { name: "Your privacy choices" })).toBeVisible();
      const found = await violations(page, `${scheme} banner`);
      await page.getByRole("button", { name: "Customize" }).click();
      found.push(...(await violations(page, `${scheme} banner customize`)));
      expect(found).toEqual([]);
    });
  });
}

test.describe("keyboard and screen reader behavior", () => {
  test("the skip link is the first tab stop, is visible when focused, and lands on main", async ({
    page,
  }) => {
    await open(page, "/mortgage-calculator");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    const box = (await skip.boundingBox())!;
    expect(box.width).toBeGreaterThan(50);
    expect(box.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("focused controls have a visible focus indicator", async ({ page }) => {
    await open(page, "/loan-calculator");
    for (const selector of [
      "#loan-amount",
      "#loan-rate",
      "#loan-term-unit",
      "button:has-text('Reset to defaults')",
    ]) {
      await page.locator(selector).focus();
      const outline = await page.locator(selector).evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      expect(outline.style, selector).not.toBe("none");
      expect(outline.width, selector).toBeGreaterThanOrEqual(2);
    }
  });

  test("results are announced politely and inputs are labelled", async ({ page }) => {
    await open(page, "/mortgage-calculator");
    const live = page.getByRole("region", { name: /results$/i }).locator('[aria-live="polite"]');
    await expect(live.first()).toBeVisible();
    const unlabeled = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          "main input:not([type=hidden]), main select, main textarea",
        ),
      )
        .filter(
          (el) =>
            !el.labels?.length &&
            !el.getAttribute("aria-label") &&
            !el.getAttribute("aria-labelledby"),
        )
        .map((el) => el.id || el.name || el.tagName),
    );
    expect(unlabeled).toEqual([]);
  });

  test("invalid fields are flagged with aria-invalid and linked to their message", async ({
    page,
  }) => {
    await open(page, "/loan-calculator");
    await page.locator("#loan-amount").fill("");
    const input = page.locator("#loan-amount");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = await input.getAttribute("aria-describedby");
    expect(describedBy).toBe("loan-amount-error");
    await expect(page.locator(`#${describedBy}`)).toHaveText(/loan amount/i);
  });

  test("tables have captions and column headers, and scroll inside their own region", async ({
    page,
  }) => {
    await open(page, "/compound-interest-calculator");
    const table = page.getByRole("table", { name: "Compound interest year-by-year breakdown" });
    await expect(table).toBeVisible();
    expect(await table.locator("th[scope=col]").count()).toBeGreaterThanOrEqual(4);
    const region = page.getByRole("region", { name: "Compound interest year-by-year breakdown" });
    await expect(region).toHaveAttribute("tabindex", "0"); // keyboard users can scroll it
  });

  test("the chart has a text alternative", async ({ page }) => {
    await open(page, "/loan-calculator");
    const chart = page.getByRole("img", { name: /Remaining balance falls/ });
    await expect(chart).toBeVisible();
  });

  test("the mobile menu manages focus: opens to its first control, Escape returns to the button", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await open(page, "/");
    const button = page.getByRole("button", { name: "Menu" });
    await button.click();
    await expect(page.locator("#mobile-menu").locator("input, a").first()).toBeFocused();
    await expect(page.getByRole("button", { name: "Close" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("every page has a lang attribute, one h1, landmarks and a descriptive title", async ({
    page,
    request,
  }) => {
    for (const path of await sitemapPaths(request)) {
      await page.goto(path);
      await expect(page.locator("html"), path).toHaveAttribute("lang", "en");
      await expect(page.locator("h1"), path).toHaveCount(1);
      await expect(page.getByRole("banner"), path).toHaveCount(1);
      await expect(page.getByRole("main"), path).toHaveCount(1);
      await expect(page.getByRole("contentinfo"), path).toHaveCount(1);
      expect((await page.title()).length, path).toBeGreaterThan(10);
    }
  });

  test("heading levels never skip a level inside the main content", async ({ page, request }) => {
    for (const path of await sitemapPaths(request)) {
      await page.goto(path);
      const levels = await page
        .locator("main h1, main h2, main h3, main h4")
        .evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
      for (let i = 1; i < levels.length; i++) {
        expect(
          levels[i]! - levels[i - 1]!,
          `${path}: h${levels[i - 1]} followed by h${levels[i]}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });
});

test.describe("motion and zoom", () => {
  test("respects prefers-reduced-motion", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      baseURL: "http://localhost:3100",
    });
    const page = await context.newPage();
    await page.goto("/");
    const behavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(behavior).toBe("auto");
    await context.close();
  });

  test("works at 200% zoom: no horizontal scroll at a 640px-wide viewport", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 480 }); // 1280px at 200%
    for (const path of ["/", "/mortgage-calculator", "/debt-payoff-planner", "/privacy-policy"]) {
      await open(page, path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  // Not tested: "200% text only". Tailwind breakpoints are rem-based media queries, which follow the
  // browser text-size setting but not a CSS font-size override, so forcing the root font size would
  // build a layout no real visitor sees. The 200% zoom test above checks the same WCAG 1.4.4 and
  // 1.4.10 requirements faithfully (a 640px viewport is a 1280px window at 200% zoom).
});
