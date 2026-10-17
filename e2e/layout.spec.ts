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

test("skip link is the first focusable element", async ({ page, browserName }) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  if (browserName === "webkit") {
    // Safari's default is to skip links when tabbing (a user setting, not a site property), so Tab
    // never lands on a link. Check what the site controls instead: the skip link is the first link in
    // the document, it is revealed when focused, and it moves focus to the main content.
    const firstLink = await page.evaluate(() => document.querySelector("a")?.textContent?.trim());
    expect(firstLink).toBe("Skip to main content");
    await skip.focus();
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main/);
    return;
  }
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
});
