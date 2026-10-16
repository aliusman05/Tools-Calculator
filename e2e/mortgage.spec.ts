import { expect, test } from "@playwright/test";

const PATH = "/mortgage-calculator";

test("renders the default payment", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mortgage Calculator");
  // $320k @ 6.5% / 30y = $2,022.62 P&I, + $366.67 tax + $125 insurance (no PMI at 20% down)
  await expect(page.getByText("$2,514.28").first()).toBeVisible();
});

test("updates the payment when inputs change and zero-interest math holds", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("Interest rate (APR)").fill("0");
  await page.getByLabel("Property tax (per year)").fill("0");
  await page.getByLabel("Home insurance (per year)").fill("0");
  // $320,000 / 360 = $888.89
  await expect(page.getByText("$888.89").first()).toBeVisible();
});

test("formats the price input with thousands separators", async ({ page }) => {
  await page.goto(PATH);
  await page.waitForLoadState("networkidle"); // typing before hydration can drop keystrokes
  const price = page.getByLabel("Home price");
  await price.fill("");
  await price.pressSequentially("1250000");
  await expect(price).toHaveValue("1,250,000");
});

test("shows validation errors for invalid input", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("Loan term").fill("0");
  await expect(page.getByText("Enter a term between 1 and 50 years.")).toBeVisible();
  await expect(page.getByText("Check the highlighted fields")).toBeVisible();
});

test("extra payments report interest and time saved", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("Extra every month").fill("200");
  const results = page.getByRole("region", { name: "Mortgage calculator results" });
  await expect(results.getByText("Interest saved", { exact: true })).toBeVisible();
  await expect(results.getByText("23 years 5 months", { exact: true })).toBeVisible();
  await expect(results.getByText("6 years 7 months", { exact: true })).toBeVisible();
});

test("amortization schedule opens and ends at a zero balance", async ({ page }) => {
  await page.goto(PATH);
  await page.getByRole("button", { name: /Amortization schedule/ }).click();
  const table = page.getByRole("region", { name: "Yearly amortization schedule" });
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(30);
  await expect(table.locator("tbody tr").last().locator("td").last()).toHaveText("$0.00");

  await page.getByLabel("Loan term").fill("40");
  await page.getByRole("button", { name: "Monthly" }).click();
  const monthly = page.getByRole("region", { name: "Monthly amortization schedule" });
  await expect(monthly.locator("tbody tr")).toHaveCount(120); // paginated
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next" }).click();
  await expect(monthly.locator("tbody tr")).toHaveCount(120);
  await expect(monthly.locator("tbody tr").last().locator("td").last()).toHaveText("$0.00");
});

test("syncs inputs to the URL and restores them on load", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("Interest rate (APR)").fill("5.25");
  await expect(page).toHaveURL(/annualRatePct=5\.25/);
  await page.reload();
  await expect(page.getByLabel("Interest rate (APR)")).toHaveValue("5.25");
});

test("loads the lazy chart without shifting layout", async ({ page }) => {
  await page.goto(PATH);
  const chart = page.getByRole("img", { name: /Remaining balance falls/ });
  const before = await chart.boundingBox();
  await expect(chart.locator('svg[role="application"]')).toBeVisible();
  const after = await chart.boundingBox();
  expect(after?.height).toBe(before?.height);
  expect(after?.y).toBe(before?.y);
});

test("has SEO essentials: title, description, canonical and JSON-LD", async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveTitle(/Mortgage Calculator/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{150,}/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/mortgage-calculator$/,
  );
  const types = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "{}")["@type"]));
  expect(types).toEqual(expect.arrayContaining(["WebApplication", "FAQPage", "BreadcrumbList"]));
});

test("has no console errors and no horizontal scroll on small screens", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(PATH);
    await page.getByRole("button", { name: /Amortization schedule/ }).click();
    await page.getByRole("button", { name: "Monthly" }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test("unknown calculator slugs return 404", async ({ page }) => {
  const response = await page.goto("/not-a-calculator");
  expect(response?.status()).toBe(404);
});
