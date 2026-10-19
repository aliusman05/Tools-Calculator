# Performance and accessibility

Phase 7 results (updated in Phase 9), how to measure, and what to watch for.

## Targets and results

| Target                                 | Result                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Lighthouse Performance 95+             | Desktop **96-100** on all 27 pages. Mobile: see the Phase 10 note below.  |
| Lighthouse Accessibility 100           | **100** on every page, mobile and desktop.                                |
| Lighthouse SEO 100, Best Practices 100 | **100** on every page.                                                    |
| LCP under 2.5s                         | Mobile lab **1.6-2.7s** (varies with machine load); desktop **0.5-0.7s**. |
| CLS under 0.1                          | **0** on every page.                                                      |
| INP under 200ms                        | Lab proxy passes (see "Responsiveness"). Field INP needs real traffic.    |

"Mobile" is Lighthouse's default simulated phone: Moto G Power class CPU (4x slowdown) on slow 4G.
Scores are the median of 3 runs (desktop: 2). The final pass in Phase 9 covered all 24 pages; the two
pages that sat near the line (the home page and /terms) were re-measured with 7 runs each and the saved
results are in `docs/perf/final-lighthouse-mobile.json` and `-desktop.json`.

### Phase 9 finding: the cookie banner was the home page's LCP

On the home page the largest contentful paint was the banner's paragraph, not the page content. The
banner only appeared after hydration, so LCP waited for JavaScript (median 94, LCP about 2.4s). The banner
is now rendered on the server, so it paints with the first frame. For returning visitors the inline script
in `<head>` sets `data-consent="decided"` on `<html>` and a CSS rule hides the banner before paint, so
nothing flashes. Result: home median **96**, LCP **1.6s**. Without JavaScript the banner is hidden (it
could never be dismissed, and nothing optional loads anyway). Tests: `e2e/consent.spec.ts` (server-rendered
banner) and `src/lib/__tests__/consent.test.ts`.

### Phase 10 re-measurement: 27 pages on a loaded machine

After the first three new calculators (refinance, student loan, rent vs buy) all 27 pages were measured
again, mobile (3 runs) and desktop (2 runs). Pages below 95 were re-measured with 5 runs each. Results
are in `docs/perf/final-lighthouse-*.json`.

- **Desktop:** every page 96-100.
- **Mobile:** 11 of 27 pages scored 95 or more and 16 scored lower (lowest 81). Accessibility, SEO and
  Best Practices were 100 and CLS was 0 on every page.
- **Why this is most likely machine noise, not a regression:** the development machine's own CPU was
  45-75% busy with other programs during the runs. The same page swung widely between passes (`/terms`:
  97, 92, 96, 86; single runs of one page ranged from 85 to 99), and pages whose code did not change
  moved as much as the new ones.
- **Evidence that nothing regressed:** an alternating A/B run, 5 runs each on the same machine at the
  same time, of the commit before this batch against the current build: home 96 vs 98, `/terms` 92 vs
  96, mortgage calculator 94 vs 95, ROI calculator 96 vs 96, page weight within 0-3 KB. The current
  build matched or beat the old one on every page tested. The new calculator pages weigh 207-209 KB,
  the same as existing ones.
- **What this does not show:** that every mobile page reaches 95 under quiet conditions. The last clean
  measurement (24 pages, before this batch) was 95-99; this batch has not been shown to reach it. The
  numbers that matter are the ones on the deployed site: run PageSpeed Insights there (see "Measurement
  noise is large" below) and re-record. Until then `pnpm launch-check` reports the saved mobile file as
  below target, which is accurate for what was recorded.

### Before and after (mobile, median of 3 runs)

| Page                  | Performance  | LCP         | Blocking time (TBT) | Page weight  |
| --------------------- | ------------ | ----------- | ------------------- | ------------ |
| Home                  | 94 → **96**  | 2.7s → 2.3s | 176ms → 155ms       | 284 → 205 KB |
| Mortgage calculator   | 57 → **94**  | 4.6s → 1.9s | 903ms → 262ms       | 391 → 212 KB |
| Debt payoff planner   | 49 → **96**  | 4.9s → 1.9s | 1,416ms → 206ms     | 390 → 209 KB |
| Compound interest     | 70 → **95**  | 2.2s → 1.9s | 2,204ms → 250ms     | 391 → 208 KB |
| Income tax estimator  | n/a → **96** | 1.9s        | 228ms               | 209 KB       |
| Retirement calculator | n/a → **96** | 1.9s        | 228ms               | 211 KB       |
| Category: Loans       | 96 → **99**  | 2.6s → 1.6s | 156ms → 127ms       | 287 → 211 KB |
| About                 | 95 → **98**  | 2.6s → 1.6s | 152ms → 145ms       | 273 → 194 KB |

Accessibility was 99 on the calculator pages before (a skipped heading level) and is 100 now.
Raw data: `docs/perf/baseline-*.json`, `final-*.json`.

First-load JavaScript (gzip): every page was **205 KB**; now content pages are **180 KB** and calculator
pages **188-191 KB** (the page's own calculator is about 8 KB).

## What changed, and why

1. **Calculators were bundled into every page (the big one).** The registry (which the header reads)
   held a dynamic `import()` of every calculator, and Next treats the imports reachable from a server
   module as dependencies of the layout. So even `/about` downloaded all twelve calculators.
   The component loaders now live in `src/components/calculators/CalculatorLoader.tsx`, one
   `dynamic(() => import(...))` each, so a page loads only its own. A unit test keeps the registry free
   of component imports and in step with the loader; an e2e test proves a content page contains no
   calculator code and each calculator page contains only its own.
2. **The chart library loads only when the chart is near the screen.** Recharts is the single biggest
   piece of JavaScript on a calculator page. It now loads when the chart scrolls to within 200px of the
   viewport, so on a phone (chart below the fold) it costs nothing during the initial load. The
   chart's height is reserved, so nothing moves when it arrives.
3. **System fonts instead of the Geist web font.** Removing the font download took `/about` from 91 to
   95 and cut LCP by ~0.8s in a controlled A/B test, because on a slow connection the font competes
   with JavaScript for bandwidth. The stack is `ui-sans-serif, system-ui, -apple-system, "Segoe UI",
Roboto, ...` in `src/app/globals.css`. If you want a brand typeface back, expect to give up a few
   points; use `next/font` with `display: "optional"` and preload only one weight.
4. **`Intl.NumberFormat` instances are cached** (`src/lib/format.ts`). Creating a formatter is slow and
   the calculators format dozens of numbers per render.
5. **Fewer renders on first load.** `useCalculatorState` used to re-render the whole calculator twice
   after mount even when the address had nothing to restore. It now changes state only when there are
   saved values in the URL.
6. **Heading order.** Result sections under the page `<h1>` were `<h3>`; they are `<h2>` now, which fixed
   the only Lighthouse accessibility finding.
7. **Unused font removed.** The monospace font was only needed for code blocks; they use the system
   monospace stack now.

### Tried and rejected

- **`experimental.inlineCss`** (inline the 6 KB stylesheet to drop a render-blocking request). It made
  things worse: `/about` fell to 73 with a layout shift of 0.17, because the CSS is also repeated in
  the page's data payload and the styles are re-inserted. Reverted.
  Data: `docs/perf/experiment-inline-css-lighthouse-mobile.json`.

## How to measure

```bash
pnpm build
pnpm exec next start -p 3300            # leave running

pnpm perf                                # mobile, 3 runs, a default set of pages
pnpm perf --form desktop --runs 2
pnpm perf --paths /mortgage-calculator,/about --runs 5
pnpm bundle-report --budget-js 200       # gzip JS per route; fails if a route is over 200 KB
node scripts/ab.mjs --a http://localhost:3300 --b http://localhost:3301 --runs 5   # fair A/B
```

On Windows Git Bash, prefix commands that take `--paths /...` with `MSYS_NO_PATHCONV=1`.
`pnpm perf` uses the Chromium that Playwright installed. Results go to `perf-reports/` (not committed).

### Measurement noise is large

On a busy machine, the same build can score 76 on one run and 95 on the next; two scripts running
minutes apart cannot be compared. Use `scripts/ab.mjs`, which alternates the two variants run by run so
both see the same load, and compare medians of at least 5 runs. Closing other browser windows helps.
Lab scores are also not field data. After you deploy, check **PageSpeed Insights** (it shows real-user
Core Web Vitals once there is traffic) and Search Console's Core Web Vitals report. Expect field LCP
to be better than the lab number on a CDN and INP to need watching on low-end phones.

## Guards in the test suite

`e2e/perf.spec.ts` tests the causes of good scores, which are stable, rather than the scores:

- content pages download no calculator code; each calculator downloads only its own;
- Recharts is not requested until the chart is near the viewport, and its space is reserved;
- no web font is downloaded; hashed assets are cached for a year and immutable; HTML and JS are
  compressed;
- every calculator loads with a layout shift under 0.02 on desktop and mobile, with and without the
  cookie banner;
- typing into a calculator on a 4x slower CPU keeps the INP-style result at 200ms or less (the "good"
  threshold; 300ms on CI), and a result updates promptly on a 6x slower CPU.

These timing tests are tagged `@timing` and run in their own Playwright project after every other test has
finished (see `playwright.config.ts`), because a timing measurement is only meaningful when nothing else
is using the machine. The INP-style number follows the real definition: it skips the single slowest
interaction per 50. A retry is allowed (two, reported as "flaky", never hidden), and a real slowdown
cannot hide behind it: it fails every attempt. One test proves this by injecting a 450ms input handler
and checking that the guard sees the slowdown on every run.

`pnpm bundle-report --budget-js 200` is the JavaScript budget (current worst case: 191 KB). Wire it
into CI in Phase 8.

## Accessibility

`e2e/a11y.spec.ts` runs axe-core (WCAG 2.0, 2.1 and 2.2 A and AA, plus best-practice rules):

- **every page, in light and in dark mode** (so contrast is checked in both themes);
- interactive states: open schedule (yearly and monthly), validation errors, the savings-goal and tax
  alternate modes, contact form error, the open mobile menu, and the cookie banner with its customize
  panel;
- keyboard and screen reader behavior axe cannot judge: skip link, visible focus indicators,
  `aria-live` results, labelled inputs, `aria-invalid` linked to its message, table captions and headers,
  the chart's text alternative, mobile menu focus handling, heading order, landmarks, `lang`, and
  `prefers-reduced-motion`;
- no horizontal scroll at 200% zoom (a 640px viewport).

Fixes it drove: unique names for the search landmarks (a page can hold two) and for the mobile menu's
navigation, plus the heading levels above.

Automated tests cannot prove a site is accessible. Before launch, also try the calculators with a
screen reader (NVDA or VoiceOver) and keyboard only, and test on a real phone.

## Responsiveness (INP)

Calculations are pure functions run inside `useMemo`, so a keystroke re-runs one function and
re-renders one component tree. A debt plan simulates up to 100 years of payments three times and still
completes in a few milliseconds, so no extra debouncing was added; the URL write is debounced
(400ms). If a future calculator becomes heavy, wrap its inputs in `useDeferredValue`.
