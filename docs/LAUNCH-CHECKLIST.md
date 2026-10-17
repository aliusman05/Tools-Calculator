# Pre-launch checklist: results

Run on 2026-10-17 against the production build (`pnpm launch-check`, 29 pass, 3 fail, 9 warn, 6 manual).
Re-run it any time; it is the checklist as code. After deploying, run it against the live site (see
[DEPLOY.md](DEPLOY.md)).

| Checklist item (PLAN.md)                                     | Result                                | Evidence                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 12 calculators tested against reference values           | **PASS**                              | 13 math modules, 251 calculator test cases with reference values; the tax engine is also checked against the IRS published base-tax amounts. 861 unit tests pass with coverage thresholds.                                                                 |
| Every page has a unique title and meta description           | **PASS**                              | Checked on every sitemap page, with canonicals, one h1 and JSON-LD.                                                                                                                                                                                        |
| Legal pages complete and linked in the footer                | **PASS** (content) / **FAIL** (owner) | Pages exist and are linked. They still carry the "Template: review before launch" notice and placeholder operator name, contact email and jurisdiction. Fill these in and set `legal.reviewed` ([LAUNCH-TODO.md](LAUNCH-TODO.md)).                         |
| Consent banner works                                         | **PASS**                              | Denied by default, Consent Mode v2, remembered, reopenable, no optional scripts before consent. Now server-rendered. Warning: a Google-certified CMP is needed for EEA/UK/CH AdSense.                                                                      |
| ads.txt, robots.txt and sitemap.xml live                     | **PASS** (WARN)                       | All served. ads.txt holds a placeholder publisher ID until AdSense approves the site.                                                                                                                                                                      |
| 404 page works                                               | **PASS**                              | Unknown paths return a real 404.                                                                                                                                                                                                                           |
| Lighthouse targets met on mobile                             | **PASS**                              | All 24 pages: Performance 95-99, Accessibility 100, SEO 100, Best Practices 100, LCP 1.6-2.2s, CLS 0. Desktop 97-100. ([PERFORMANCE.md](PERFORMANCE.md)) Lab results; INP is MANUAL (guarded on a slowed CPU in tests, check Search Console after launch). |
| Tested on iOS Safari, Android Chrome, desktop Chrome/Firefox | **PASS** (emulated) / **MANUAL**      | Chromium, Firefox, WebKit, iPhone 14 and Pixel 7 emulation: 201 of 201 tests each. A real iPhone and a real Android phone still need a manual check.                                                                                                       |
| Tax and rate data verified and dated                         | **PASS** / **WARN**                   | 2026 figures compared with IRS Rev. Proc. 2025-32 on 2026-10-17. `ownerVerified` stays false until you sign off.                                                                                                                                           |

## What was fixed in Phase 9

- Security headers, preview deployments `noindex`, brand icons, and removal of the create-next-app files.
- GA4 that sends only the page path (the address holds typed values) and loads only after consent.
- Home page mobile score: the cookie banner was the LCP element; it is now server-rendered (94 to 96).
- Cross-browser test bugs (not site bugs) found by the new Firefox, WebKit and phone suites.

## Still yours (not code)

See [LAUNCH-TODO.md](LAUNCH-TODO.md): legal details and review, real brand name, domain and
`NEXT_PUBLIC_SITE_URL`, GA4 ID, contact webhook, tax sign-off, real-device testing, a certified CMP,
Search Console and Bing, and the AdSense application.
