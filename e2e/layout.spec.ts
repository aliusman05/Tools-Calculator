import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test(`no horizontal page scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/category/loans", "/does-not-exist"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test("unknown page returns the 404 page", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("could not find");
});

test("mobile menu opens, is keyboard operable and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Menu" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(
    page.locator("#mobile-menu").getByRole("link", { name: "Loans & Mortgages" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
});

test("skip link is the first focusable element", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});
