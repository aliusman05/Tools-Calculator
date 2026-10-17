import type { Page } from "@playwright/test";

/**
 * Replaces the clipboard with a recorder, so tests can read what "Copy link" copied in every browser
 * engine (real clipboard permissions differ between them).
 */
export async function captureClipboard(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __copied?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          w.__copied = text;
        },
      },
    });
  });
}

export async function copiedLink(page: Page): Promise<string> {
  await page.waitForFunction(() => Boolean((window as unknown as { __copied?: string }).__copied));
  return page.evaluate(() => (window as unknown as { __copied: string }).__copied);
}
