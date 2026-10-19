import { defineConfig, devices } from "@playwright/test";

/**
 * Ads suite. It builds the site into its own folder (.next-ads) with ads ENABLED, using a fake
 * publisher ID and fake slot IDs, and serves it on port 3200. The AdSense script itself is never
 * fetched from Google: tests stub the request. Run with `pnpm e2e:ads`.
 */
const port = 3200;
const baseURL = `http://localhost:${port}`;

const adsEnv = {
  NEXT_DIST_DIR: ".next-ads",
  NEXT_PUBLIC_ADS_ENABLED: "true",
  NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1234567890123456",
  NEXT_PUBLIC_ADSENSE_SLOT_BELOW: "1111111111",
  NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR: "2222222222",
  NEXT_PUBLIC_ADSENSE_SLOT_CONTENT: "3333333333",
  NEXT_PUBLIC_ADSENSE_SLOT_END: "4444444444",
  NEXT_PUBLIC_ADS_TEST_MODE: "true",
  // Analytics is built in too, so the same suite can prove consent gating and query-string privacy.
  NEXT_PUBLIC_GA_ID: "G-TEST123456",
};

export default defineConfig({
  testDir: "./e2e/ads",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${port}`,
    url: baseURL,
    // Never reuse a server already on this port: this suite must test its own ads-enabled build, and a
    // leftover server from an earlier run would silently test something else (or die mid-run).
    // If the port is busy, Playwright now stops with a clear error instead.
    reuseExistingServer: false,
    timeout: 300_000,
    env: adsEnv,
  },
});
