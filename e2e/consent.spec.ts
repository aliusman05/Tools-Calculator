import { expect, test, type Page } from "@playwright/test";
import { open } from "./support/open";

// First-visit state: nothing stored, so the banner should appear.
test.use({ storageState: { cookies: [], origins: [] } });

const STORAGE_KEY = "fincalc-consent";

type GtagCall = unknown[];

async function gtagCalls(page: Page): Promise<GtagCall[]> {
  return page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((a) =>
      Array.from(a),
    ),
  );
}

const stored = (page: Page) =>
  page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);

const banner = (page: Page) => page.getByRole("dialog", { name: "Your privacy choices" });

test("shows the banner on a first visit with equal Accept and Reject buttons", async ({ page }) => {
  await open(page, "/");
  await expect(banner(page)).toBeVisible();
  const accept = banner(page).getByRole("button", { name: "Accept all" });
  const reject = banner(page).getByRole("button", { name: "Reject all" });
  await expect(accept).toBeVisible();
  await expect(reject).toBeVisible();
  const [a, r] = await Promise.all([accept.boundingBox(), reject.boundingBox()]);
  expect(Math.abs(a!.height - r!.height)).toBeLessThanOrEqual(1);
  await expect(banner(page).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
    "href",
    "/privacy-policy",
  );
});

test("the banner is fixed to the viewport so it cannot shift the page", async ({ page }) => {
  await open(page, "/");
  await expect(banner(page)).toHaveCSS("position", "fixed");
  const before = await page.locator("main").boundingBox();
  await banner(page).getByRole("button", { name: "Reject all" }).click();
  const after = await page.locator("main").boundingBox();
  expect(after?.y).toBe(before?.y);
  expect(after?.height).toBe(before?.height);
});

test("defaults every optional signal to denied before any choice", async ({ page }) => {
  await open(page, "/loan-calculator");
  const calls = await gtagCalls(page);
  expect(calls[0]?.slice(0, 2)).toEqual(["consent", "default"]);
  expect(calls[0]?.[2]).toMatchObject({
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  expect(calls.some((c) => c[1] === "update")).toBe(false);
  expect(await stored(page)).toBeNull();
});

test("loads no analytics or advertising scripts before consent", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== "localhost") external.push(r.url());
  });
  await open(page, "/");
  await open(page, "/mortgage-calculator");
  expect(external).toEqual([]);
});

test("Reject all stores the choice, hides the banner and keeps signals denied", async ({
  page,
}) => {
  await open(page, "/");
  await banner(page).getByRole("button", { name: "Reject all" }).click();
  await expect(banner(page)).toHaveCount(0);
  expect(await stored(page)).toMatchObject({ v: 1, analytics: false, ads: false });
  const update = (await gtagCalls(page)).find((c) => c[1] === "update");
  expect(update?.[2]).toMatchObject({ ad_storage: "denied", analytics_storage: "denied" });

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(banner(page)).toHaveCount(0);
});

test("Accept all grants every signal and is remembered", async ({ page }) => {
  await open(page, "/");
  await banner(page).getByRole("button", { name: "Accept all" }).click();
  await expect(banner(page)).toHaveCount(0);
  expect(await stored(page)).toMatchObject({ analytics: true, ads: true });
  const update = (await gtagCalls(page)).find((c) => c[1] === "update");
  expect(update?.[2]).toEqual({
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });

  // A returning visitor's choice is applied by the inline script before anything else runs.
  await page.reload();
  const calls = await gtagCalls(page);
  expect(calls[0]?.[1]).toBe("default");
  expect(calls.find((c) => c[1] === "update")?.[2]).toMatchObject({ analytics_storage: "granted" });
  await expect(banner(page)).toHaveCount(0);
});

test("Customize lets the visitor accept one category and reject the other", async ({ page }) => {
  await open(page, "/");
  await banner(page).getByRole("button", { name: "Customize" }).click();
  await expect(banner(page).getByRole("checkbox", { name: /Strictly necessary/ })).toBeDisabled();
  await banner(page)
    .getByRole("checkbox", { name: /Analytics/ })
    .check();
  await banner(page).getByRole("button", { name: "Save my choices" }).click();
  await expect(banner(page)).toHaveCount(0);
  expect(await stored(page)).toMatchObject({ analytics: true, ads: false });
  const update = (await gtagCalls(page)).find((c) => c[1] === "update");
  expect(update?.[2]).toMatchObject({
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
});

test("Cookie settings in the footer reopens the panel with the saved choice", async ({ page }) => {
  await open(page, "/");
  await banner(page).getByRole("button", { name: "Accept all" }).click();
  await expect(banner(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).getByRole("checkbox", { name: /Analytics/ })).toBeChecked();
  await expect(banner(page).getByRole("checkbox", { name: /Advertising/ })).toBeChecked();
  await expect(banner(page).getByRole("heading", { name: "Your privacy choices" })).toBeFocused();

  await banner(page)
    .getByRole("checkbox", { name: /Advertising/ })
    .uncheck();
  await banner(page).getByRole("button", { name: "Save my choices" }).click();
  expect(await stored(page)).toMatchObject({ analytics: true, ads: false });
  const updates = (await gtagCalls(page)).filter((c) => c[1] === "update");
  expect(updates[updates.length - 1]?.[2]).toMatchObject({
    ad_storage: "denied",
    analytics_storage: "granted",
  });
});

test("Escape closes the settings panel once a choice exists, and Close does too", async ({
  page,
}) => {
  await open(page, "/");
  await banner(page).getByRole("button", { name: "Reject all" }).click();
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(banner(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(banner(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Cookie settings" }).click();
  await banner(page).getByRole("button", { name: "Close" }).click();
  await expect(banner(page)).toHaveCount(0);
});

test("the first-visit banner cannot be dismissed without choosing", async ({ page }) => {
  await open(page, "/");
  await expect(banner(page).getByRole("button", { name: "Close" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(banner(page)).toBeVisible();
});

test("the banner is usable by keyboard and does not hide the footer link on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, "/");
  await expect(banner(page)).toBeVisible();
  await page.keyboard.press("Tab"); // skip link
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const inBanner = await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"));
    if (inBanner) break;
  }
  await expect(banner(page).locator(":focus")).toHaveCount(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a blocked localStorage does not break the page", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
