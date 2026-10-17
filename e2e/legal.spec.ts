import { expect, test } from "@playwright/test";
import { open } from "./support/open";
import { CALCULATOR_SLUGS } from "./support/calculators";

const SLUGS = CALCULATOR_SLUGS;

test.describe("legal and trust pages", () => {
  for (const [path, heading] of [
    ["/about", "About Us and Our Methodology"],
    ["/contact", "Contact Us"],
    ["/privacy-policy", "Privacy Policy"],
    ["/terms", "Terms of Use"],
    ["/disclaimer", "Financial Disclaimer"],
  ] as const) {
    test(`${path} loads, has one h1 and is linked from the footer`, async ({ page }) => {
      const res = await open(page, path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page.getByRole("contentinfo").locator(`a[href="${path}"]`)).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    });
  }

  test("the privacy policy states that calculations stay in the browser", async ({ page }) => {
    await open(page, "/privacy-policy");
    await expect(page.getByText("Your calculator inputs stay in your browser.")).toBeVisible();
    await expect(page.getByText(/not sent to our servers/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your rights and choices" })).toBeVisible();
    await expect(page.getByText(/Google Consent Mode/)).toBeVisible();
  });

  test("template pages warn the owner until the legal text is reviewed", async ({ page }) => {
    await open(page, "/terms");
    await expect(page.getByText("Template: review before launch")).toBeVisible();
  });

  test("the terms and disclaimer say the site is not professional advice", async ({ page }) => {
    await open(page, "/terms");
    await expect(page.getByRole("heading", { name: "No professional advice" })).toBeVisible();
    await open(page, "/disclaimer");
    await expect(page.getByRole("heading", { name: "Educational use only" })).toBeVisible();
    await expect(page.getByText(/not\s+financial, investment, tax/i).first()).toBeVisible();
  });

  test("the disclaimer has an affiliate section that the disclosure links to", async ({ page }) => {
    await open(page, "/disclaimer");
    await expect(page.locator("h2#affiliate")).toHaveText("Affiliate links and compensation");
  });

  test("the about page explains the methodology", async ({ page }) => {
    await open(page, "/about");
    await expect(page.getByRole("heading", { name: "How we check the formulas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keeping things up to date" })).toBeVisible();
  });

  test("legal pages have no horizontal scroll on a small screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const path of ["/about", "/contact", "/privacy-policy", "/terms", "/disclaimer"]) {
      await open(page, path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("result disclaimer", () => {
  for (const slug of SLUGS) {
    test(`${slug} shows a disclaimer under its results`, async ({ page }) => {
      await open(page, `/${slug}`);
      const note = page.getByTestId("result-disclaimer");
      await expect(note).toBeVisible();
      await expect(note).toContainText("Not financial, tax or legal advice");
      await expect(note.getByRole("link", { name: "Read the full disclaimer" })).toHaveAttribute(
        "href",
        "/disclaimer",
      );
      // It sits inside the results region, after the results.
      await expect(
        page.getByRole("region", { name: /results$/i }).getByTestId("result-disclaimer"),
      ).toBeVisible();
    });
  }
});

test.describe("contact form", () => {
  test("shows the form, an email address and a hidden honeypot", async ({ page }) => {
    await open(page, "/contact");
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByLabel("Your email address")).toBeVisible();
    await expect(page.getByLabel("Your message")).toBeVisible();
    await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(await honeypot.evaluate((el) => !!el.closest('[aria-hidden="true"]'))).toBe(true);
  });

  test("shows a thank-you message on success", async ({ page }) => {
    await page.route("**/api/contact", (route) => route.fulfill({ json: { ok: true } }));
    await open(page, "/contact");
    await page.getByLabel("Your name").fill("Ada");
    await page.getByLabel("Your email address").fill("ada@example.com");
    await page.getByLabel("Your message").fill("A perfectly reasonable message for the team.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Thank you, your message is on its way.")).toBeVisible();
  });

  test("sends the fields, the honeypot and a start time to the server", async ({ page }) => {
    let body: Record<string, unknown> = {};
    await page.route("**/api/contact", async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true } });
    });
    await open(page, "/contact");
    await page.getByLabel("Your name").fill("Ada");
    await page.getByLabel("Your email address").fill("ada@example.com");
    await page.getByLabel("Your message").fill("A perfectly reasonable message for the team.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Thank you")).toBeVisible();
    expect(body).toMatchObject({ name: "Ada", email: "ada@example.com", website: "" });
    expect(typeof body.startedAt).toBe("number");
  });

  test("shows field errors from the server", async ({ page }) => {
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
  });

  test("falls back to the email address when delivery is unavailable", async ({ page }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 503,
        json: {
          ok: false,
          error: "Messages cannot be sent from this form right now.",
          fallback: "email",
        },
      }),
    );
    await open(page, "/contact");
    await page.getByLabel("Your name").fill("Ada");
    await page.getByLabel("Your email address").fill("ada@example.com");
    await page.getByLabel("Your message").fill("A perfectly reasonable message for the team.");
    await page.getByRole("button", { name: "Send message" }).click();
    // (Next also renders a global route announcer with role=alert, so scope to the form.)
    const alert = page.locator("form").getByRole("alert");
    await expect(alert).toContainText("Messages cannot be sent from this form right now.");
    await expect(alert.getByRole("link")).toHaveAttribute("href", /^mailto:/);
  });

  test("the real endpoint rejects bad input and answers 503 without a webhook", async ({
    request,
  }) => {
    const base = {
      name: "Ada",
      email: "ada@example.com",
      message: "A perfectly reasonable message.",
      website: "",
    };
    const old = Date.now() - 10_000;

    const invalid = await request.post("/api/contact", {
      data: { ...base, email: "x", startedAt: old },
    });
    expect(invalid.status()).toBe(422);

    const fast = await request.post("/api/contact", { data: { ...base, startedAt: Date.now() } });
    expect(fast.status()).toBe(429);

    const bot = await request.post("/api/contact", {
      data: { ...base, website: "http://spam", startedAt: old },
    });
    expect(bot.status()).toBe(200);
    expect((await bot.json()).ok).toBe(true);

    const notJson = await request.post("/api/contact", {
      data: "nope",
      headers: { "content-type": "text/plain" },
    });
    expect(notJson.status()).toBe(400);

    const valid = await request.post("/api/contact", { data: { ...base, startedAt: old } });
    expect(valid.status()).toBe(503); // no CONTACT_WEBHOOK_URL in the test environment
    expect((await valid.json()).fallback).toBe("email");
  });
});
