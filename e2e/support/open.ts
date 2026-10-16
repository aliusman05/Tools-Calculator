import type { Page } from "@playwright/test";

/** Navigate and wait for hydration, so input typed immediately is not lost. */
export async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState("networkidle");
  return response;
}
