# Claude Code Build Plan: Personal Finance Calculator Website

> Project rules live in `CLAUDE.md`. Give Claude Code one phase at a time using the prompts in Section 14.

---

## 1. Project Summary

Build a fast, SEO-optimized, ad-supported website of free personal finance calculators (mortgage, loan, compound interest, etc.), targeting US users first, then UK, Canada, and Australia.

**Revenue**: Google AdSense first, then affiliate links, then premium ad networks.

**Core principles**

1. Accuracy: every formula is unit tested.
2. Speed: static generation, minimal JavaScript, Core Web Vitals pass.
3. Trust: formulas, assumptions, disclaimers, and "last updated" dates shown openly.
4. Privacy: all calculations run in the browser. No financial data is sent to a server.
5. Original content: every page has unique, useful explanations (no copied text).

---

## 2. CLAUDE.md

See `CLAUDE.md` in the repo root.

---

## 3. Final Folder Structure

```
finance-calc/
├── CLAUDE.md
├── PLAN.md
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── .env.example
├── public/
│   ├── ads.txt
│   ├── robots.txt            (or generated via app/robots.ts)
│   └── og/                   (social images)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                      Home
│   │   ├── [slug]/page.tsx               Calculator pages (generateStaticParams)
│   │   ├── category/[category]/page.tsx  Category hubs
│   │   ├── blog/page.tsx
│   │   ├── blog/[slug]/page.tsx
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── privacy-policy/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── disclaimer/page.tsx
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── layout/ (Header, Footer, Breadcrumbs, SearchBox)
│   │   ├── calculators/ (one folder per calculator)
│   │   ├── ui/ (Input, CurrencyInput, Select, Slider, Button, Card, Tabs, Table)
│   │   ├── charts/ (LineChart, PieChart, BarChart wrappers, lazy loaded)
│   │   ├── ads/ (AdSlot, ConsentBanner)
│   │   ├── seo/ (JsonLd, FAQ, RelatedTools)
│   │   └── content/ (MDX components)
│   ├── lib/
│   │   ├── calculators/ (pure math + __tests__)
│   │   ├── registry.ts
│   │   ├── format.ts (currency, percent, number formatting)
│   │   ├── url-state.ts (read/write inputs to query string)
│   │   ├── seo.ts (metadata + schema helpers)
│   │   └── site-config.ts
│   └── content/
│       ├── calculators/*.mdx
│       └── blog/*.mdx
└── e2e/
    └── smoke.spec.ts
```

---

## 4. Phases Overview

| Phase | Name                           | Output                                                        |
| ----- | ------------------------------ | ------------------------------------------------------------- |
| 0     | Scaffolding and tooling        | Working empty site with lint/test/CI                          |
| 1     | Design system and layout       | Header, footer, UI kit, home page shell                       |
| 2     | Calculator engine and registry | Registry pattern + shared hooks + first calculator end to end |
| 3     | Launch calculators (12)        | All launch tools with tests                                   |
| 4     | Content, SEO and schema        | MDX content, metadata, JSON-LD, sitemap                       |
| 5     | Legal, trust and consent       | Legal pages, cookie consent, disclaimers                      |
| 6     | Ads and monetization           | AdSense slots, ads.txt, affiliate component                   |
| 7     | Performance and accessibility  | Lighthouse 95+, WCAG AA checks                                |
| 8     | Testing and CI                 | Unit, e2e, GitHub Actions                                     |
| 9     | Deployment and launch          | Live site, Search Console, Analytics                          |
| 10    | Post-launch expansion          | Phase 2 calculators, country variants, blog                   |

---

## 5. Phase 0: Scaffolding and Tooling

**Tasks**

1. Create the Next.js app with TypeScript, Tailwind, App Router, `src/` directory, and ESLint using pnpm.
2. Enable `strict: true` in `tsconfig.json`; add path alias `@/*` to `src/*`.
3. Add Prettier with the Tailwind plugin and a `.prettierrc`.
4. Install and configure Vitest (jsdom for components, node for lib tests) and Playwright.
5. Add scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `format`.
6. Add `.env.example` with `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_ADSENSE_CLIENT`.
7. Add `src/lib/site-config.ts` with site name, URL, description, default locale, and last updated date.
8. Add a GitHub Actions workflow that runs lint, typecheck, test, and build on every push and PR.
9. Initialize git with a sensible `.gitignore` and make the first commit.

**Definition of done**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass on a clean checkout.

---

## 6. Phase 1: Design System and Layout

**Design direction**: clean, trustworthy, finance-oriented. Neutral background, one strong accent color, generous spacing, large readable numbers for results. Light and dark mode via CSS variables and `prefers-color-scheme`.

**Tasks**

1. Define design tokens (colors, spacing, radius, font scale) in Tailwind config and CSS variables. Use a system font stack or one self-hosted font via `next/font` to avoid layout shift.
2. Build UI components: `Button`, `Card`, `Input`, `CurrencyInput` (formats with thousands separators, accepts only numeric input), `PercentInput`, `Select`, `Slider` paired with input, `Tabs`, `Table` (scrollable container), `Accordion` (for FAQs).
3. Build layout: sticky `Header` with logo, category menu, and search; `Footer` with category links, legal links, and disclaimer line; `Breadcrumbs`.
4. Build the `Home` page: hero with search box, category cards, "Popular calculators" grid driven by the registry, and a short trust section.
5. Add a responsive mobile menu.
6. Add a `not-found.tsx` page that suggests popular calculators.

**Definition of done**: Layout is responsive from 320px to 1440px, keyboard accessible, and has no horizontal page scroll.

---

## 7. Phase 2: Calculator Engine and Registry

**Registry design** (`src/lib/registry.ts`)

```ts
export type CalculatorMeta = {
  slug: string; // e.g. "mortgage-calculator"
  title: string; // H1 and <title> base
  shortTitle: string; // for cards and menus
  description: string; // meta description (150-160 chars)
  category: "loans" | "savings" | "investing" | "tax" | "debt" | "other";
  keywords: string[];
  related: string[]; // slugs
  component: () => Promise<{ default: React.ComponentType }>; // dynamic import
  contentPath: string; // MDX file
  popular?: boolean;
  lastUpdated: string; // ISO date
};
```

**Shared building blocks**

1. `useCalculatorState` hook: holds inputs, validates, and syncs with the URL query string (so results are shareable) with debouncing.
2. `ResultCard` component: shows the primary result large, with secondary results beneath.
3. `ChartSection` wrapper: lazy loads Recharts, shows a fixed-height placeholder to prevent layout shift.
4. `AmortizationTable` component: collapsible, scrolls inside its container, supports monthly/yearly view, and paginates or virtualizes beyond 360 rows.
5. `CalculatorShell` component: standard layout with inputs on the left, results on the right (stacked on mobile), plus ad slot positions.
6. `src/lib/format.ts`: `formatCurrency`, `formatPercent`, `formatNumber` using `Intl.NumberFormat`, with currency configurable per page.

**Dynamic route**: `src/app/[slug]/page.tsx` uses `generateStaticParams` from the registry, `generateMetadata` for SEO, loads the MDX content, and renders the calculator component, FAQ, and related tools.

**First calculator end to end**: Build the **Mortgage Calculator** completely (math, tests, UI, chart, amortization table, MDX content, schema) to prove the pattern before building the rest.

**Definition of done**: Adding a new calculator requires only a math file, a component, an MDX file, and one registry entry.

---

## 8. Phase 3: Launch Calculators

Build each with the same checklist: **math function, unit tests, UI component, MDX content (how it works, formula, worked example, 5+ FAQs), registry entry**.

### Formulas Claude Code must implement and test

**Monthly rate**: `r = annualRate / 12 / 100`; **payments**: `n = years * 12`

1. **Mortgage / Loan EMI**
   - Payment: `M = P * r * (1+r)^n / ((1+r)^n - 1)`; if `r = 0`, `M = P / n`.
   - Inputs: home price, down payment ($ or %), rate, term; optional property tax, home insurance, HOA, PMI (as extras in the mortgage calculator).
   - Output: monthly payment, total interest, total paid, payoff date, amortization schedule.
   - Extra payment option: monthly, one-time, and yearly; show interest and time saved.
   - Final payment must be adjusted so the balance ends at exactly 0.
2. **Loan / EMI calculator**: the same engine as above, generic (amount, rate, term in months or years).
3. **Compound interest**
   - `A = P * (1 + r/m)^(m*t)` plus regular contributions: future value of annuity `PMT * (((1+r/m)^(m*t) - 1) / (r/m))`.
   - Compounding frequency options: daily, monthly, quarterly, annually. Contribution timing: start or end of period.
   - Output: final balance, total contributions, total interest, year-by-year table, stacked chart.
4. **Simple interest**: `I = P * R * T`; also show the comparison with compound interest.
5. **Savings goal**: solve for required monthly contribution given target, current savings, rate, and time (and alternatively time to goal given a contribution).
6. **Retirement / 401(k)**: current age, retirement age, current balance, contribution, employer match (% match up to % of salary), expected return, salary growth, inflation adjustment, and an estimate of sustainable withdrawal (show a 4% rule illustration as an assumption, not advice).
7. **Car loan**: loan EMI plus sales tax, trade-in, down payment, and fees.
8. **Credit card payoff**: months to payoff given balance, APR, and fixed payment; or the payment required for a target date. Detect payments too low to cover interest and show a clear message.
9. **Debt payoff planner**: multiple debts, snowball vs avalanche, an extra monthly amount; show payoff order, total interest, and months to debt-free for each method.
10. **Income tax estimator (US federal first)**: tax year configurable in a data file (`src/lib/data/tax-us-2026.ts`), filing status, standard deduction, progressive brackets. Clearly label as an estimate and keep tax data in one easily updated file with a source note and last-updated date. Verify the current-year figures from the official IRS source before launch.
11. **Inflation calculator**: `FV = PV * (1 + i)^t` and the purchasing power of money over time.
12. **Investment return / ROI / CAGR**: `ROI = (final - initial) / initial`; `CAGR = (final/initial)^(1/years) - 1`.

### Test requirements (Vitest)

- At least 5 test cases per calculator including: normal values, zero interest, very short and very long terms, large amounts, and invalid input handling.
- Compare against independently verified reference values (calculate by hand or from a trusted source, and note the source in a comment).
- For amortization: assert the final balance is 0, the sum of principal equals the loan amount, and the sum of payments equals total paid.
- Property-based style checks where useful (for example, a higher rate never yields a lower payment).

**Definition of done**: 12 calculators live, all tests passing, no calculator without content.

---

## 9. Phase 4: Content, SEO, and Schema

**Per-page content template (MDX)**

1. Short intro (what it calculates and who it's for)
2. The calculator
3. How to use it (3-5 steps)
4. How it works: the formula, explained in plain language
5. Worked example with real numbers
6. Tips and common mistakes
7. FAQ (5-8 questions, real search-style questions)
8. Related calculators
9. "Last updated" date and disclaimer

**Technical SEO tasks**

1. `generateMetadata` for every page: unique title (under 60 chars), description (150-160 chars), canonical URL, Open Graph, and Twitter card.
2. JSON-LD component supporting `WebApplication`, `FAQPage`, `BreadcrumbList`, `Organization`, and `WebSite` (with a search action).
3. `sitemap.ts` generated from the registry and blog posts; `robots.ts` pointing to the sitemap.
4. Auto-generated OG images using `next/og` (title plus site brand).
5. Internal linking: related tools block on every page, category hub pages linking to all tools in the category, and contextual links from blog posts to calculators.
6. Clean URLs, no trailing slash inconsistency, and a proper 404.
7. Category hub pages with unique intro text (not just a list of links).

**Definition of done**: Rich Results Test passes for all pages and the sitemap validates.

---

## 10. Phase 5: Legal, Trust, and Consent

1. **Pages**: About (who runs the site, methodology, how formulas are verified), Contact (a simple form posting to a serverless function or an email link; include spam protection), Privacy Policy, Terms of Use, and Disclaimer (educational only, not financial, tax, or legal advice).
2. **Cookie consent**: Integrate a Google-certified Consent Management Platform (CMP), required for ads to UK/EEA/Switzerland visitors. Load ad and analytics scripts only after consent where required, and support Google Consent Mode v2.
3. **Affiliate disclosure** component, shown near any affiliate link.
4. Add a short disclaimer under every calculator result.
5. Put the data-handling statement in the Privacy Policy: calculations happen in the browser and inputs are not stored on a server.

**Note**: The legal pages are templates. The site owner should review them and adjust for their jurisdiction.

---

## 11. Phase 6: Ads and Monetization

1. **`AdSlot` component**
   - Props: `slot`, `format`, `minHeight`.
   - Reserves fixed height before the ad loads (prevents layout shift).
   - Loads only after consent; renders nothing (or a placeholder in dev) when disabled.
   - Lazy loads below-the-fold ads.
2. **Placement rules**
   - One ad below the calculator inputs/results on mobile, one in the sidebar on desktop, one inside the content after "How it works", and one near the page end.
   - Never place ads overlapping or directly adjacent to input fields or buttons (accidental click risk and policy violation).
   - Limit ad density so content stays above the ads.
3. Add `public/ads.txt` with the publisher line (use a placeholder until the ID exists).
4. Add the AdSense script in `layout.tsx` using `next/script` with `strategy="afterInteractive"`, controlled by an environment variable.
5. **`AffiliateCard` / `AffiliateLink` component**: configured from a data file (`src/lib/data/affiliates.ts`), with `rel="sponsored noopener"`, the disclosure label, and a contextual placement option (for example, a credit card offer on the credit card payoff calculator).
6. Feature flag to turn ads off globally in development and preview deployments.

**Definition of done**: Ads can be toggled by environment variable, produce no layout shift, and only run after consent.

---

## 12. Phase 7: Performance and Accessibility

**Targets**: Lighthouse Performance 95+, Accessibility 100, SEO 100, LCP under 2.5s, CLS under 0.1, INP under 200ms.

**Tasks**

1. Use Server Components for content; keep client components minimal.
2. Dynamic-import Recharts and any heavy components.
3. Use `next/font`, `next/image`, and proper `sizes`.
4. Check bundle size with `@next/bundle-analyzer`; remove unnecessary dependencies.
5. Debounce calculations and memoize expensive schedules.
6. Accessibility: associate every label, announce results with `aria-live="polite"`, provide table captions, ensure focus management on mobile menu, and verify color contrast in both themes.
7. Add `prefers-reduced-motion` handling.

---

## 13. Phases 8-10: Testing, Deployment, Expansion

### Phase 8: Testing and CI

- Unit tests (Vitest) for all math; component tests for the shared inputs.
- Playwright smoke tests: every calculator page loads, accepts input, and shows a result; the sitemap returns 200; there are no console errors; no horizontal page scroll at 375px width.
- Link checker for internal links.
- GitHub Actions: lint, typecheck, unit tests, build, and e2e against the built app.

### Phase 9: Deployment and Launch

1. Deploy to Vercel (or Cloudflare Pages); connect the custom domain and enforce HTTPS and a single canonical host (www or non-www).
2. Set environment variables in the hosting dashboard.
3. Add Google Analytics 4 (consent-aware) and verify the site in Google Search Console; submit the sitemap.
4. Add Bing Webmaster Tools.
5. Pre-launch checklist (below).
6. Apply for AdSense once the site has the launch calculators, legal pages, and some organic traffic.

**Pre-launch checklist**

- [ ] All 12 calculators tested against reference values
- [ ] Every page has unique title and meta description
- [ ] Legal pages complete and linked in the footer
- [ ] Consent banner works
- [ ] `ads.txt`, `robots.txt`, and `sitemap.xml` live
- [ ] 404 page works
- [ ] Lighthouse targets met on mobile
- [ ] Tested on iOS Safari, Android Chrome, desktop Chrome/Firefox
- [ ] Tax and rate data verified and dated

### Phase 10: Post-Launch Expansion

- **Calculators**: refinance, rent vs buy, student loan, take-home pay (by state), SIP/mutual fund, currency converter, percentage tools, home affordability, down payment savings, APR vs APY, early mortgage payoff, and 15 vs 30 year comparison.
- **Country variants**: UK (stamp duty, mortgage), Canada (mortgage with semi-annual compounding), Australia (home loan). Implement locale/currency through the registry, with separate pages and correct local rules.
- **Long-tail pages**: "mortgage calculator with extra payments", state-specific mortgage and tax pages (generated from data, each with unique content, not thin templates).
- **Blog**: 2 posts a week answering real questions, each linking to a calculator.
- **Features**: save/compare scenarios (local storage), print/PDF results, embeddable widget with a backlink, optional email capture.

---

## 14. Ready-to-Use Prompts for Claude Code

Run these one at a time. Wait for each to finish, review, then continue.

**Prompt 0 (setup)**

> Read PLAN.md and CLAUDE.md. Execute Phase 0 only. Create the project, configure tooling, and make sure lint, typecheck, test, and build pass. Commit when done and summarize what you did.

**Prompt 1 (design system)**

> Execute Phase 1 from PLAN.md. Build the design tokens, UI components, header, footer, breadcrumbs, and home page shell. Make it responsive and accessible. Show me a summary of components created.

**Prompt 2 (engine + mortgage)**

> Execute Phase 2 from PLAN.md. Build the registry, shared hooks and components, the dynamic `[slug]` route, and the complete Mortgage Calculator including tests, chart, amortization table, extra-payments feature, and MDX content. Verify the amortization ends at exactly zero.

**Prompt 3 (calculators, in batches)**

> Execute Phase 3 from PLAN.md, calculators 2 through 5 (loan/EMI, compound interest, simple interest, savings goal). Follow the per-calculator checklist exactly. Write the tests first.

> Continue Phase 3 with calculators 6 through 9 (retirement, car loan, credit card payoff, debt payoff planner).

> Finish Phase 3 with calculators 10 through 12 (income tax estimator, inflation, ROI/CAGR). Put tax data in a separate dated data file and tell me which official source figures need to be verified by me.

**Prompt 4 (SEO)**

> Execute Phase 4 from PLAN.md. Add metadata, JSON-LD schema, sitemap, robots, OG images, category hub pages, and related-tools linking. Then validate the schema output.

**Prompt 5 (legal and consent)**

> Execute Phase 5 from PLAN.md. Create the legal pages as templates, the disclaimer component, the affiliate disclosure component, and the consent banner with Consent Mode v2 structure. List anything I must configure manually.

**Prompt 6 (ads)**

> Execute Phase 6 from PLAN.md. Build AdSlot, the env-based toggle, ads.txt placeholder, and the AffiliateCard component. Make sure there is no layout shift and ads load only after consent.

**Prompt 7 (performance)**

> Execute Phase 7 from PLAN.md. Run Lighthouse and the bundle analyzer, fix issues, and report before/after scores.

**Prompt 8 (testing and CI)**

> Execute Phase 8 from PLAN.md. Add Playwright smoke tests, a link checker, and finalize the GitHub Actions workflow.

**Prompt 9 (launch prep)**

> Run the pre-launch checklist from PLAN.md against the codebase. Report each item as pass or fail and fix the failures.

**Prompt 10 (a new calculator, reusable)**

> Add a new calculator: [NAME]. Follow the registry pattern and the per-calculator checklist in PLAN.md (math, tests, UI, MDX content, registry entry). Do not finish until lint, typecheck, and tests pass.

---

## 15. Quality Gates (apply after every phase)

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass.
2. No console errors or warnings in the browser.
3. New code has tests where it contains logic.
4. A short summary of changes and any manual steps required from the owner.
5. A git commit with a clear message.

---

## 16. Manual Tasks the Owner Must Do (Claude Code cannot)

- Buy the domain and connect it to hosting.
- Create accounts: Google Analytics, Search Console, AdSense, affiliate programs, and a CMP.
- Insert real IDs in environment variables and `ads.txt`.
- Verify official tax and rate figures and review legal pages for their jurisdiction.
- Write or approve the About page details (real name or brand identity).
- Submit the AdSense application and monitor policy messages.
- Build backlinks and handle outreach.

---

## 17. Success Criteria

| Milestone | Target                                                               |
| --------- | -------------------------------------------------------------------- |
| Launch    | 12 calculators, all pages passing quality gates                      |
| Month 3   | 25 calculators, site indexed, first organic traffic                  |
| Month 6   | 40 calculators, AdSense approved and earning, first affiliate income |
| Month 12  | 20,000+ monthly visitors, apply to a premium ad network              |
