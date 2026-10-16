import { expect, test } from "@playwright/test";
import { open } from "./support/open";

const SLUGS = [
  "mortgage-calculator",
  "loan-calculator",
  "compound-interest-calculator",
  "simple-interest-calculator",
  "savings-goal-calculator",
];

for (const slug of SLUGS) {
  test.describe(slug, () => {
    test("loads with one h1, a result region, 5+ FAQs and valid JSON-LD", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));

      const response = await open(page, `/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("region", { name: /results$/i })).toBeVisible();
      expect(await page.locator("#faq-heading ~ div details").count()).toBeGreaterThanOrEqual(5);

      const types = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "{}")["@type"]));
      expect(types).toEqual(
        expect.arrayContaining(["WebApplication", "FAQPage", "BreadcrumbList"]),
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`/${slug}$`),
      );
      expect(errors).toEqual([]);
    });

    test("has no horizontal scroll at 320px", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await open(page, `/${slug}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test.describe("loan calculator", () => {
  test("shows the reference payment and savings from extra payments", async ({ page }) => {
    await open(page, "/loan-calculator");
    const results = page.getByRole("region", { name: "Loan calculator results" });
    await expect(results.getByText("$493.85").first()).toBeVisible();
    await expect(results.getByText("$4,631.08")).toBeVisible();

    await page.getByLabel("Extra every month").fill("100");
    await expect(results.getByText("$924.20")).toBeVisible();
    await expect(results.getByText("11 months", { exact: true })).toBeVisible();
  });

  test("accepts the term in months", async ({ page }) => {
    await open(page, "/loan-calculator");
    await page.getByLabel("Unit").selectOption("months");
    await page.getByLabel("Loan term").fill("60");
    await expect(
      page.getByRole("region", { name: "Loan calculator results" }).getByText("$493.85").first(),
    ).toBeVisible();
  });

  test("shows validation errors", async ({ page }) => {
    await open(page, "/loan-calculator");
    await page.getByLabel("Loan amount").fill("");
    await expect(page.getByText("Enter a loan amount above 0.")).toBeVisible();
  });
});

test.describe("compound interest calculator", () => {
  test("shows the reference future value", async ({ page }) => {
    await open(page, "/compound-interest-calculator");
    const results = page.getByRole("region", { name: "Compound interest calculator results" });
    await expect(results.getByText("$47,526.55").first()).toBeVisible();
    await expect(results.getByText("$24,000.00")).toBeVisible();
    await expect(results.getByText("$13,526.55")).toBeVisible();
    await expect(results.getByRole("row")).toHaveCount(11); // header + 10 years
  });

  test("daily compounding on a lump sum", async ({ page }) => {
    await open(page, "/compound-interest-calculator");
    await page.locator("#ci-contribution").fill("0");
    await page.getByLabel("Compounding").selectOption("daily");
    await expect(page.getByText("$16,486.65").first()).toBeVisible();
  });

  test("requires a starting amount or deposit", async ({ page }) => {
    await open(page, "/compound-interest-calculator");
    await page.locator("#ci-principal").fill("0");
    await page.locator("#ci-contribution").fill("0");
    await expect(page.getByText("Enter a starting amount or a monthly deposit.")).toBeVisible();
  });
});

test.describe("simple interest calculator", () => {
  test("shows simple interest and the compound comparison", async ({ page }) => {
    await open(page, "/simple-interest-calculator");
    const results = page.getByRole("region", { name: "Simple interest calculator results" });
    await expect(results.getByText("$900.00").first()).toBeVisible();
    await expect(results.getByText("$5,955.08")).toBeVisible();
    await expect(results.getByText("$55.08")).toBeVisible();
  });

  test("supports days", async ({ page }) => {
    await open(page, "/simple-interest-calculator");
    await page.getByLabel("Principal").fill("10000");
    await page.getByLabel("Unit").selectOption("days");
    await page.getByLabel("Time", { exact: true }).fill("90");
    await expect(page.getByText("$147.95").first()).toBeVisible();
  });
});

test.describe("savings goal calculator", () => {
  test("solves for the monthly saving", async ({ page }) => {
    await open(page, "/savings-goal-calculator");
    const results = page.getByRole("region", { name: "Savings goal calculator results" });
    await expect(results.getByText("$288.94").first()).toBeVisible();
    await expect(results.getByText("$10,327.63").first()).toBeVisible();
  });

  test("solves for the time to goal", async ({ page }) => {
    await open(page, "/savings-goal-calculator");
    await page.locator("#sg-mode").selectOption("time");
    await page.locator("#sg-target").fill("20000");
    await page.locator("#sg-current").fill("1000");
    await page.locator("#sg-monthly").fill("300");
    const results = page.getByRole("region", { name: "Savings goal calculator results" });
    await expect(results.getByText("4 years 9 months").first()).toBeVisible();
  });

  test("explains when a goal is out of reach", async ({ page }) => {
    await open(page, "/savings-goal-calculator");
    await page.locator("#sg-mode").selectOption("time");
    await page.locator("#sg-rate").fill("0");
    await page.locator("#sg-monthly").fill("0");
    await expect(page.getByText("This goal is out of reach")).toBeVisible();
  });
});

test("home page lists the new calculators and search finds them", async ({ page }) => {
  await open(page, "/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("search").first().getByLabel("Search calculators").fill("compound");
  await expect(
    page.getByRole("link", { name: "Compound Interest Calculator" }).first(),
  ).toBeVisible();
});
