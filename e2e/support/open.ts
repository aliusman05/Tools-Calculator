import type { Page } from "@playwright/test";

/**
 * Navigate and wait for hydration, so input typed immediately is not lost.
 *
 * "Network idle" is not enough: each calculator is a separately loaded chunk, and in a slow engine
 * (WebKit, a phone profile) it can hydrate after the network has gone quiet. A value typed before that
 * is replaced by the component's initial state. React marks every DOM node it has hydrated with an
 * internal `__reactProps$...` key, so the page is ready once the first form control in the page body
 * carries it. Pages without a form control are ready as soon as the network is idle.
 */
export async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const control = document.querySelector("main input, main select");
    if (!control) return true;
    return Object.keys(control).some((key) => key.startsWith("__reactProps$"));
  });
  return response;
}
