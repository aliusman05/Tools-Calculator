# Personal finance calculators

A fast, privacy-friendly website of free personal finance calculators (mortgage, loan, car loan, compound
and simple interest, savings goal, retirement, credit card payoff, debt payoff planner, US federal income
tax, inflation, ROI/CAGR). Everything is calculated in the visitor's browser; no financial data is sent to a
server. Built with Next.js (App Router), TypeScript, Tailwind CSS and MDX, and statically generated.

The build plan is in [PLAN.md](PLAN.md) and the working rules for contributors (human or AI) are in
[CLAUDE.md](CLAUDE.md).

## Quick start

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Requires Node 22 (see `.nvmrc`) and pnpm (the version is pinned in `package.json`).

| Command                                  | What it does                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop, build and serve the site                                             |
| `pnpm check`                             | The gates CI runs: lint, types, unit tests with coverage, build               |
| `pnpm test` / `pnpm test:coverage`       | Unit and component tests (Vitest)                                             |
| `pnpm e2e`                               | End-to-end tests against the production build (build first)                   |
| `pnpm e2e:ads`                           | The same, with ads enabled in a separate build                                |
| `pnpm e2e:browsers`                      | Functional tests in Firefox, WebKit, an emulated iPhone and an emulated Pixel |
| `pnpm check-links`                       | Crawl the running site for broken links, bad anchors, orphan pages            |
| `pnpm launch-check`                      | The pre-launch checklist, reported as pass / fail / warn / manual             |
| `pnpm perf`, `pnpm bundle-report`        | Lighthouse runs and JavaScript size per route                                 |
| `pnpm format` / `pnpm format:check`      | Prettier                                                                      |

## Where things live

```
src/lib/calculators/   pure calculator math, with tests next to it in __tests__/
src/lib/data/          dated reference data (US tax brackets), one file per year
src/lib/registry.ts    one entry per calculator; pages, menus, sitemap and search read from it
src/components/        UI kit, calculator screens, layout, consent, ads, SEO
src/content/           MDX: one file per calculator, plus the legal pages
src/app/               routes, metadata, sitemap, robots, icons
e2e/                   Playwright specs
scripts/               Lighthouse, bundle report, link checker, launch check
docs/                  guides (below) and recorded measurements
```

Adding a calculator: math file + tests, a registry entry, a component, an MDX file, and one line in
`src/components/calculators/CalculatorLoader.tsx`. The tests tell you if you miss a step.

## Configuration

Copy `.env.example` to `.env.local`. Nothing is required to run the site locally. In production set at
least `NEXT_PUBLIC_SITE_URL` (your domain). Ads, analytics and the contact form switch on only when their
variables are set. Brand name and legal details are in `src/lib/site-config.ts`.

## Guides

- [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md): the pre-launch checklist with results
- [docs/LAUNCH-TODO.md](docs/LAUNCH-TODO.md): everything only the site owner can do
- [docs/TESTING.md](docs/TESTING.md): the test layers and CI
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md): scores, what was changed and why
- [docs/ADS.md](docs/ADS.md): ads and affiliate links
