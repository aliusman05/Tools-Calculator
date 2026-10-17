import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Pure math in src/lib runs in node; component tests opt into jsdom
    // with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "lcov"],
      include: ["src/lib/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
      exclude: [
        "**/__tests__/**",
        // Needs the Next.js image runtime; checked by the e2e suite (OG image tests).
        "src/lib/og.tsx",
        // Charts and the twelve calculator screens are drawn by Recharts / are whole-page UIs, and are
        // exercised end to end by Playwright (e2e/calculators.spec.ts, e2e/mortgage.spec.ts and friends).
        "src/components/charts/**",
        "src/components/calculators/{car-loan,compound-interest,credit-card,debt-payoff,income-tax,inflation,loan,mortgage,retirement,roi,savings-goal,simple-interest}/**",
        // Thin server components and layout pieces with no logic of their own; e2e covers them.
        "src/components/layout/{Header,Footer,MobileMenu}.tsx",
        "src/components/legal/LegalPage.tsx",
        "src/components/consent/{ConsentBanner,ConsentDefaults,ConsentSettingsButton}.tsx",
        "src/components/contact/**",
        "src/components/ads/{AdSenseScript,ContentAd}.tsx",
      ],
      // Fail `pnpm test:coverage` (and CI) if coverage drops. The math must stay fully covered.
      thresholds: {
        "src/lib/calculators/**": { statements: 100, lines: 100, functions: 100, branches: 95 },
        "src/lib/**": { statements: 95, lines: 95, functions: 95, branches: 85 },
        "src/components/ui/**": { statements: 95, lines: 95, functions: 95, branches: 80 },
        "src/components/calculators/shared/**": {
          statements: 85,
          lines: 85,
          functions: 80,
          branches: 70,
        },
      },
    },
  },
});
