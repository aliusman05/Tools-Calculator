# Testing and CI

What is tested, how to run it, and what CI does.

## The layers

| Layer           | Tool                             | What it covers                                                                                                                                                                                                                                                              | Run                                  |
| --------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Unit            | Vitest (node)                    | Every calculator's math against independently derived reference values, invariants (for example "a higher rate never lowers a payment"), validation, formatting, URL state, consent logic, contact checks, SEO helpers, ads and affiliate configuration, registry integrity | `pnpm test`                          |
| Component       | Vitest + Testing Library (jsdom) | Shared inputs, tabs, tables, accordion, search, breadcrumbs, result cards, amortization table (including pagination), chart loader, ads, affiliate card, hooks                                                                                                              | `pnpm test`                          |
| Coverage gate   | Vitest + v8                      | Fails if coverage drops below the thresholds in `vitest.config.mts`                                                                                                                                                                                                         | `pnpm test:coverage`                 |
| End to end      | Playwright (Chromium)            | Smoke, accessibility (axe, light and dark), SEO, performance guards, legal, consent, contact form, ads off                                                                                                                                                                  | `pnpm e2e`                           |
| End to end, ads | Playwright, separate build       | Consent gating, placement, lazy loading and layout stability with ads enabled                                                                                                                                                                                               | `pnpm e2e:ads`                       |
| Links           | `scripts/check-links.mjs`        | Broken links, bad `#anchors`, orphan pages, insecure or unsafe external links                                                                                                                                                                                               | `pnpm check-links`                   |
| Budget          | `scripts/bundle-report.mjs`      | Gzipped JavaScript per route                                                                                                                                                                                                                                                | `pnpm bundle-report --budget-js 200` |
| Config          | Vitest                           | The CI workflow itself (see below)                                                                                                                                                                                                                                          | `pnpm test`                          |

Run the same gates CI runs, in one go: `pnpm check` (lint, types, tests with coverage, build).
Formatting: `pnpm format` writes, `pnpm format:check` verifies.

## Coverage thresholds

| Scope                                   | Statements / lines / functions | Branches |
| --------------------------------------- | ------------------------------ | -------- |
| `src/lib/calculators/**` (all the math) | 100%                           | 95%      |
| `src/lib/**`                            | 95%                            | 85%      |
| `src/components/ui/**`                  | 95%                            | 80%      |
| `src/components/calculators/shared/**`  | 85% (functions 80%)            | 70%      |

Excluded from the unit-test denominator because Playwright covers them end to end: the twelve
calculator screens, the chart components, the header/footer/mobile menu, the cookie banner, the
contact form, and `og.tsx` (needs the Next.js runtime). Exclusions are listed with reasons in
`vitest.config.mts`. Raise a threshold when you add tests; do not lower one to make a build pass.

## End-to-end tests

`pnpm e2e` serves the **production build** (`next start` on port 3100), so run `pnpm build` first.
Playwright starts the server itself. Specs:

| File                                      | Purpose                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `smoke.spec.ts`                           | Every sitemap page returns 200 and loads with no console errors, warnings or failed requests; no horizontal scroll at 375px and 1280px; no `NaN`/`undefined` text; each calculator reacts to input, survives empty/huge/zero/junk input, restores its state from a shared link, and renders its answer **with JavaScript off**; navigation by clicking |
| `calculators.spec.ts`, `mortgage.spec.ts` | Known results for every calculator, validation messages, modes                                                                                                                                                                                                                                                                                         |
| `a11y.spec.ts`                            | axe-core WCAG A/AA on every page in light and dark mode and in interactive states; keyboard, focus, ARIA, headings, landmarks                                                                                                                                                                                                                          |
| `seo.spec.ts`                             | Titles, descriptions, canonicals, Open Graph, JSON-LD, sitemap, robots, OG images, internal links                                                                                                                                                                                                                                                      |
| `perf.spec.ts`                            | Code splitting, lazy chart, no web font, caching and compression headers, layout shift, interaction latency on a slowed CPU                                                                                                                                                                                                                            |
| `legal.spec.ts`, `consent.spec.ts`        | Legal pages, disclaimers, contact form, cookie banner and Consent Mode signals                                                                                                                                                                                                                                                                         |
| `ads-off.spec.ts`                         | Nothing ad-related appears while ads are off                                                                                                                                                                                                                                                                                                           |
| `share-link.spec.ts`                      | Copy link: typing never changes the address, the copied link restores the inputs and is then cleaned from the address, junk in a link is clamped or ignored, clipboard fallback, canonical URLs, JSON-LD and the sitemap never carry a query string                                                                                                    |
| `launch.spec.ts`                          | Security headers, icons, production is not `noindex`, no leftover boilerplate, no analytics without configuration, and the launch check's live-site checks                                                                                                                                                                                             |
| `layout.spec.ts`                          | Responsive layout, 404, mobile menu, skip link                                                                                                                                                                                                                                                                                                         |

### Other browsers and the launch check

`pnpm e2e:browsers` runs the core specs (smoke, layout, mortgage, calculators, consent, legal, ads-off) in
Firefox, WebKit (Safari's engine), an iPhone 14 and a Pixel 7. It writes
`docs/launch/browser-results.json`, which the launch check reads. Run `pnpm exec playwright install`
once for the extra engines. These are engine and device-size emulations; real phones are still a manual step.

`pnpm launch-check [--base URL] [--site-url URL] [--expect production|preview] [--no-source] [--strict]`
runs the pre-launch checklist as code and prints PASS, FAIL, WARN or MANUAL for each item. It exits 1 on
a FAIL. See [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) for the latest results and [DEPLOY.md](DEPLOY.md)
for running it against production.

`e2e/ads/ads.spec.ts` needs a build with ads **enabled**, so `pnpm e2e:ads` builds its own copy into
`.next-ads` with fake IDs and serves it on port 3200. The AdSense script is never fetched from Google.

Tests start as a returning visitor who already rejected cookies (see `playwright.config.ts`) so the
fixed cookie banner does not sit on the page; consent tests start fresh.

Tips: wait for hydration before typing (`e2e/support/open.ts` does); use ids for inputs when labels
could match several elements; on Windows Git Bash, prefix commands containing `/path` arguments with
`MSYS_NO_PATHCONV=1`.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and on every pull request, with three parallel jobs:

1. **check**: install with a frozen lockfile, `lint`, `format:check`, `typecheck`, `test:coverage`, `build`.
   The coverage report is kept as an artifact.
2. **e2e**: build, then start the site and run the link checker and the 200 KB JavaScript budget, then
   `pnpm e2e`. A failing step fails the job, and the server is always stopped. The Playwright report
   and traces are uploaded when something fails.
3. **e2e-ads**: `pnpm e2e:ads`.

Details worth knowing: Node comes from `.nvmrc` (and `engines` in `package.json`); pnpm's version comes
from `packageManager`; actions are pinned to major versions; a newer push to the same branch cancels
the older run; Playwright browsers are cached by lockfile hash; LF line endings are enforced by
`.gitattributes` so Prettier's check agrees between Windows and Linux.

`src/lib/__tests__/ci-config.test.ts` parses the workflow and fails if it calls a script that does not
exist, runs steps out of order, drifts from `.nvmrc`, or loses its safety settings. A workflow can
only be fully proven by running it on GitHub, which needs a remote repository (see below).

### Not in CI (on purpose)

- **Lighthouse scores.** They swing by several points with runner load, so a score gate would flake.
  `e2e/perf.spec.ts` guards the causes instead. Run `pnpm perf` before releases and check
  PageSpeed Insights after deploying.
- **External link checking.** Third-party sites throttle and block bots. Run
  `pnpm check-links --external` by hand occasionally.
- **Cross-browser runs.** Only Chromium runs in CI. Test Safari and Firefox by hand before launch
  (the plan's pre-launch checklist already calls for it).

### First push

There is no remote yet. After you create a GitHub repository:

```bash
git remote add origin git@github.com:YOU/REPO.git
git push -u origin main
```

Then open the Actions tab. If the e2e job is flaky on GitHub's slower runners, the performance
guards in `e2e/perf.spec.ts` (CPU-throttled interaction timings) are the first thing to loosen.
Consider requiring the three jobs in branch protection once they pass.

## Adding tests for a new calculator

Follow the checklist in `PLAN.md` / `CLAUDE.md`: math tests with reference values first, the registry
and loader entries, then add the calculator to the lists in `e2e/smoke.spec.ts`,
`e2e/calculators.spec.ts`, `e2e/perf.spec.ts` (with a marker phrase unique to its UI) and
`e2e/legal.spec.ts`, plus its expected default answer in the "rendered on the server" table.
