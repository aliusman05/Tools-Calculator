import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://localhost:${port}`;

/**
 * Tests start as a returning visitor who already chose "Reject all", so the fixed-position
 * cookie banner does not sit on top of the page. Consent tests override this with
 * `test.use({ storageState: { cookies: [], origins: [] } })` to see the first-visit banner.
 * Keep the key and version in step with src/lib/consent.ts.
 */
const rejectedConsent = JSON.stringify({
  v: 1,
  analytics: false,
  ads: false,
  at: "2026-01-01T00:00:00.000Z",
});

export default defineConfig({
  testDir: "./e2e",
  // The ads suite needs a build with ads enabled; it has its own config (playwright.ads.config.ts).
  testIgnore: "**/ads/**",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        { origin: baseURL, localStorage: [{ name: "fincalc-consent", value: rejectedConsent }] },
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next start -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
