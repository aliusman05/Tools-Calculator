import { expect, test } from "@playwright/test";
import { open } from "./support/open";
import { CALCULATOR_SLUGS } from "./support/calculators";

const SLUGS = CALCULATOR_SLUGS;

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

test.describe("retirement calculator", () => {
  test("projects the default scenario", async ({ page }) => {
    await open(page, "/retirement-calculator");
    const results = page.getByRole("region", { name: "Retirement calculator results" });
    await expect(results.getByText("$1,858,360").first()).toBeVisible();
    await expect(results.getByText("$885,960").first()).toBeVisible();
    await expect(results.getByText("$2,953")).toBeVisible();
  });

  test("warns when contributing below the match limit", async ({ page }) => {
    await open(page, "/retirement-calculator");
    await expect(page.getByText("missing part of your employer match")).toHaveCount(0);
    await page.locator("#ret-contribution").fill("3");
    await expect(page.getByText("missing part of your employer match")).toBeVisible();
  });

  test("rejects a retirement age before the current age", async ({ page }) => {
    await open(page, "/retirement-calculator");
    await page.locator("#ret-retire-age").fill("30");
    await expect(
      page.getByText("Retirement age must be a whole number above your current age"),
    ).toBeVisible();
  });
});

test.describe("car loan calculator", () => {
  test("shows the default payment and totals", async ({ page }) => {
    await open(page, "/car-loan-calculator");
    const results = page.getByRole("region", { name: "Car loan calculator results" });
    await expect(results.getByText("$538.66").first()).toBeVisible();
    await expect(results.getByText("$27,530.00")).toBeVisible();
    await expect(results.getByText("$4,789.36")).toBeVisible();
  });

  test("taxing the full price raises the amount financed", async ({ page }) => {
    await open(page, "/car-loan-calculator");
    await page.locator("#car-tax-rule").selectOption("no");
    // tax on $32,000 = $2,240 -> financed $27,740
    await expect(page.getByText("$27,740.00").first()).toBeVisible();
  });

  test("reports that nothing is financed when cash covers the cost", async ({ page }) => {
    await open(page, "/car-loan-calculator");
    await page.locator("#car-down").fill("40000");
    await expect(page.getByText("nothing is financed")).toBeVisible();
  });
});

test.describe("credit card payoff calculator", () => {
  test("shows payoff time and interest for the default card", async ({ page }) => {
    await open(page, "/credit-card-payoff-calculator");
    const results = page.getByRole("region", { name: "Credit card payoff calculator results" });
    await expect(results.getByText("2 years 9 months").first()).toBeVisible();
    await expect(results.getByText("$1,522.10")).toBeVisible();
    await expect(results.getByText("$83.33")).toBeVisible();
  });

  test("warns when the payment does not cover the interest", async ({ page }) => {
    await open(page, "/credit-card-payoff-calculator");
    await page.locator("#cc-payment").fill("50");
    await expect(page.getByText("This payment will not pay off the card")).toBeVisible();
  });

  test("solves the payment needed for a target", async ({ page }) => {
    await open(page, "/credit-card-payoff-calculator");
    await page.locator("#cc-mode").selectOption("target");
    await expect(page.getByText("$254.48").first()).toBeVisible();
    await expect(page.getByText("$1,107.50").first()).toBeVisible();
  });
});

test.describe("debt payoff planner", () => {
  test("compares snowball and avalanche on the example debts", async ({ page }) => {
    await open(page, "/debt-payoff-planner");
    const results = page.getByRole("region", { name: "Debt payoff planner results" });
    await expect(results.getByText("$2,369.04")).toBeVisible();
    await expect(results.getByText("$2,316.07")).toBeVisible();
    await expect(results.getByText("Lowest interest")).toHaveCount(1);
    await expect(results.getByText("$52.97").first()).toBeVisible();
  });

  test("adds and removes debts", async ({ page }) => {
    await open(page, "/debt-payoff-planner");
    await expect(page.getByRole("group", { name: "Debt 3" })).toBeVisible();
    await page.getByRole("button", { name: "Add a debt" }).click();
    await expect(page.getByRole("group", { name: "Debt 4" })).toBeVisible();
    // The new debt is empty, so the form asks for its details.
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.getByRole("button", { name: "Remove last debt" }).click();
    await expect(page.getByRole("group", { name: "Debt 4" })).toHaveCount(0);
    await expect(page.getByText("Lowest interest")).toBeVisible();
  });

  test("flags minimums that never pay a debt off", async ({ page }) => {
    await open(page, "/debt-payoff-planner");
    await page.locator("#dp-min-0").fill("50");
    await page.locator("#dp-extra").fill("0");
    await expect(page.getByText("never be paid off")).toBeVisible();
  });
});

test.describe("income tax estimator", () => {
  test("estimates tax for the default single filer", async ({ page }) => {
    await open(page, "/income-tax-calculator");
    const results = page.getByRole("region", { name: "Income tax estimator results" });
    await expect(results.getByText("$9,870.00").first()).toBeVisible();
    await expect(results.getByText("$68,900")).toBeVisible();
    await expect(results.getByRole("definition").filter({ hasText: /^22%$/ })).toBeVisible();
    await expect(results.getByText("11.61%")).toBeVisible();
    await expect(results.getByText("This is an estimate, not tax advice")).toBeVisible();
  });

  test("married filing jointly uses the joint brackets and deduction", async ({ page }) => {
    await open(page, "/income-tax-calculator");
    await page.locator("#tax-status").selectOption("mfj");
    await page.locator("#tax-income").fill("150000");
    await expect(page.getByText("$15,340.00").first()).toBeVisible();
    await expect(page.getByText("$117,800").first()).toBeVisible();
  });

  test("itemized deductions replace the standard deduction", async ({ page }) => {
    await open(page, "/income-tax-calculator");
    await page.locator("#tax-income").fill("75000");
    await page.locator("#tax-adjustments").fill("10000");
    await page.locator("#tax-deduction-type").selectOption("itemized");
    await page.locator("#tax-itemized").fill("20000");
    await expect(page.getByText("$5,152.00").first()).toBeVisible();
  });

  test("shows a refund when more was withheld than owed", async ({ page }) => {
    await open(page, "/income-tax-calculator");
    await page.locator("#tax-withheld").fill("11000");
    await expect(page.getByText("Estimated refund", { exact: true })).toBeVisible();
    await expect(page.getByText("$1,130.00").first()).toBeVisible();
  });

  test("income under the standard deduction owes nothing", async ({ page }) => {
    await open(page, "/income-tax-calculator");
    await page.locator("#tax-income").fill("12000");
    await expect(
      page.getByRole("region", { name: "Income tax estimator results" }).getByText("$0.00").first(),
    ).toBeVisible();
  });
});

test.describe("inflation calculator", () => {
  test("shows the future cost for the defaults", async ({ page }) => {
    await open(page, "/inflation-calculator");
    const results = page.getByRole("region", { name: "Inflation calculator results" });
    await expect(results.getByText("$1,806.11").first()).toBeVisible();
    await expect(results.getByText("23.4", { exact: true })).toBeVisible();
  });

  test("shows purchasing power in today's dollars", async ({ page }) => {
    await open(page, "/inflation-calculator");
    await page.locator("#inf-mode").selectOption("power");
    await expect(page.getByText("$553.68").first()).toBeVisible();
  });

  test("solves for the average inflation rate", async ({ page }) => {
    await open(page, "/inflation-calculator");
    await page.locator("#inf-mode").selectOption("rate");
    await page.locator("#inf-amount").fill("100");
    await page.locator("#inf-end").fill("200");
    await expect(page.getByText("3.53%").first()).toBeVisible();
  });

  test("rejects a zero period", async ({ page }) => {
    await open(page, "/inflation-calculator");
    await page.locator("#inf-years").fill("0");
    await expect(page.getByText("Enter a period above 0")).toBeVisible();
  });
});

test.describe("ROI and CAGR calculator", () => {
  test("shows ROI and CAGR for the defaults", async ({ page }) => {
    await open(page, "/roi-calculator");
    const results = page.getByRole("region", { name: "ROI and CAGR calculator results" });
    await expect(results.getByText("50.00%").first()).toBeVisible();
    await expect(results.getByText("8.45%").first()).toBeVisible();
    await expect(results.getByText("10.00%")).toBeVisible();
  });

  test("shows only ROI when no period is given", async ({ page }) => {
    await open(page, "/roi-calculator");
    await page.locator("#roi-time").fill("");
    await expect(page.getByText("Add a holding period")).toBeVisible();
    await expect(page.getByText("50.00%").first()).toBeVisible();
  });

  test("reports a loss as negative", async ({ page }) => {
    await open(page, "/roi-calculator");
    await page.locator("#roi-final").fill("6000");
    await page.locator("#roi-time").fill("3");
    await expect(page.getByText("-40.00%").first()).toBeVisible();
    await expect(page.getByText("-15.66%").first()).toBeVisible();
  });

  test("accepts months", async ({ page }) => {
    await open(page, "/roi-calculator");
    await page.locator("#roi-initial").fill("1000");
    await page.locator("#roi-final").fill("1100");
    await page.locator("#roi-unit").selectOption("months");
    await page.locator("#roi-time").fill("6");
    await expect(page.getByText("21.00%").first()).toBeVisible();
  });
});

test.describe("refinance calculator", () => {
  const results = (page: import("@playwright/test").Page) =>
    page.getByRole("region", { name: /results$/i });

  test("shows the verified default scenario", async ({ page }) => {
    await open(page, "/refinance-calculator");
    const r = results(page);
    await expect(r.getByText("1 year 1 month").first()).toBeVisible();
    await expect(r.getByText("$2,120.34")).toBeVisible();
    await expect(r.getByText("$1,842.26")).toBeVisible();
    await expect(r.getByText("$278.08")).toBeVisible();
    await expect(r.getByText("Ahead by $26,607")).toBeVisible();
    await expect(r.getByText("Ahead by $78,923")).toBeVisible();
  });

  test("a worse rate never breaks even", async ({ page }) => {
    await open(page, "/refinance-calculator");
    await page.locator("#refi-new-rate").fill("7.5");
    await expect(results(page).getByText("No break-even")).toBeVisible();
    await expect(results(page).getByText("Monthly increase")).toBeVisible();
  });

  test("rolling the costs into the loan changes the cash due and the loan amount", async ({
    page,
  }) => {
    await open(page, "/refinance-calculator");
    await page.locator("#refi-costs-paid").selectOption("rolled");
    const r = results(page);
    await expect(r.getByText("$304,500")).toBeVisible();
    await expect(
      r.getByText("Cash due at closing").locator("xpath=following-sibling::dd[1]"),
    ).toHaveText("$0");
  });

  test("an empty balance shows a message, not NaN", async ({ page }) => {
    await open(page, "/refinance-calculator");
    await page.locator("#refi-balance").fill("");
    await expect(page.locator("#refi-balance-error")).toHaveText(/Enter the balance you still owe/);
    expect(await page.locator("body").innerText()).not.toMatch(/NaN|undefined|Infinity/);
  });

  test("terms can be entered in months", async ({ page }) => {
    await open(page, "/refinance-calculator");
    await page.locator("#refi-current-term-unit").selectOption("months");
    await page.locator("#refi-current-term").fill("300");
    await page.locator("#refi-new-term-unit").selectOption("months");
    await page.locator("#refi-new-term").fill("300");
    await expect(results(page).getByText("1 year 1 month").first()).toBeVisible();
  });
});

test.describe("student loan calculator", () => {
  const results = (page: import("@playwright/test").Page) =>
    page.getByRole("region", { name: /results$/i });

  test("shows the verified default scenario", async ({ page }) => {
    await open(page, "/student-loan-calculator");
    const r = results(page);
    await expect(r.getByText("$379.84").first()).toBeVisible();
    await expect(r.getByText("$10,581.04")).toBeVisible();
    await expect(r.getByText("$45,581.04")).toBeVisible();
    await expect(r.getByText("Interest saved")).toHaveCount(0);
  });

  test("extra monthly payments show the interest and time saved", async ({ page }) => {
    await open(page, "/student-loan-calculator");
    await page.locator("#sl-extra").fill("150");
    const r = results(page);
    await expect(r.getByText("$6,785.14")).toBeVisible();
    await expect(r.getByText("$3,795.89")).toBeVisible();
    await expect(r.getByText("3 years 5 months")).toBeVisible();
  });

  test("a lump sum and extra payments together", async ({ page }) => {
    await open(page, "/student-loan-calculator");
    await page.locator("#sl-extra").fill("150");
    await page.locator("#sl-lump").fill("5000");
    await page.locator("#sl-lump-month").fill("12");
    const r = results(page);
    await expect(r.getByText("$5,173.76")).toBeVisible();
    await expect(r.getByText("$5,407.28")).toBeVisible();
    await expect(r.getByText("5 years 7 months").first()).toBeVisible();
  });

  test("warns when the lump sum comes after the loan is paid off", async ({ page }) => {
    await open(page, "/student-loan-calculator");
    await page.locator("#sl-lump").fill("5000");
    await page.locator("#sl-lump-month").fill("200");
    await expect(results(page).getByRole("note")).toContainText("no effect");
  });

  test("asks for a payment number when there is a lump sum", async ({ page }) => {
    await open(page, "/student-loan-calculator");
    await page.locator("#sl-lump").fill("5000");
    await page.locator("#sl-lump-month").fill("");
    await expect(page.locator("#sl-lump-month-error")).toContainText("whole month number");
    expect(await page.locator("body").innerText()).not.toMatch(/NaN|undefined|Infinity/);
  });

  test("links to the official source and states what it does not cover", async ({ page }) => {
    await open(page, "/student-loan-calculator");
    await expect(page.getByRole("link", { name: "studentaid.gov" })).toHaveAttribute(
      "href",
      "https://studentaid.gov/",
    );
    await expect(page.getByText("Income-driven repayment, forgiveness")).toBeVisible();
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
