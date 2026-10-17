import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-browser run: the functional specs in Firefox, WebKit (the engine behind Safari), an emulated
 * iPhone (WebKit, touch, small screen) and an emulated Pixel (Chromium, touch, small screen). It
 * writes docs/launch/browser-results.json, which `pnpm launch-check` reads.
 *
 *   pnpm exec playwright install firefox webkit     (one-time download)
 *   pnpm build && pnpm e2e:browsers
 *
 * Chromium on desktop is covered by the main suite. Specs that measure Chromium-only things (Lighthouse
 * style performance guards, CDP CPU throttling, axe) are left out on purpose, as are the ads specs,
 * which need their own build. Emulation proves engines and screen sizes, not real hardware: still try
 * a real iPhone and a real Android phone.
 */
const port = 3100;
const baseURL = `http://localhost:${port}`;

const rejectedConsent = JSON.stringify({
  v: 1,
  analytics: false,
  ads: false,
  at: "2026-01-01T00:00:00.000Z",
});

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "**/smoke.spec.ts",
    "**/layout.spec.ts",
    "**/mortgage.spec.ts",
    "**/calculators.spec.ts",
    "**/consent.spec.ts",
    "**/legal.spec.ts",
    "**/ads-off.spec.ts",
  ],
  forbidOnly: !!process.env.CI,
  // WebKit and Firefox are slower under load; a single retry separates flakes from real failures,
  // and the report marks them as flaky instead of hiding them.
  retries: 1,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: "docs/launch/browser-results.json" }]],
  timeout: 45_000,
  workers: 2,
  use: {
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        { origin: baseURL, localStorage: [{ name: "fincalc-consent", value: rejectedConsent }] },
      ],
    },
  },
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
