# Launch to-do: things only the site owner can do

Items marked **Required** block launch or AdSense approval. Everything here is outside the code.
Deployment steps are in [DEPLOY.md](DEPLOY.md); the latest checklist results are in
[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md). Run `pnpm launch-check` any time to see what is left.

## Legal pages (Phase 5)

- [ ] **Required.** Edit the placeholders in `src/lib/site-config.ts` → `legal`:
      `operatorName`, `contactEmail` (use a real, monitored address), `jurisdiction`, `lastUpdated`.
- [ ] **Required.** Read `src/content/legal/*.mdx` (About, Privacy Policy, Terms, Disclaimer) and adjust
      them for your country or state. They are templates, not legal advice. Pay particular attention to
      the retention period for contact messages, the governing law, and the limitation of liability.
- [ ] **Required.** In `about.mdx`, replace the bracketed "who runs this site" text with a real,
      honest description. AdSense reviewers and readers look for a real person or business.
- [ ] After review, set `legal.reviewed` to `true` in `site-config.ts`. This removes the red
      "Template: review before launch" notice from the legal pages.

## Cookie consent (Phase 5)

The built-in banner stores a choice and drives Google Consent Mode v2, with every optional signal
denied until the visitor chooses. It is **not** a Google-certified CMP.

- [ ] **Required for AdSense in the EEA, UK and Switzerland.** Choose a Google-certified CMP
      (for example Google's own Funding Choices / Privacy & messaging, Cookiebot, Usercentrics,
      CookieYes or iubenda), configure it for GDPR/TCF and US state laws, and install its script.
      Then either remove `<ConsentBanner />` from `src/app/layout.tsx` or keep the footer link wired
      to the CMP's "reopen settings" call. Keep `<ConsentDefaults />` unless the CMP sets its own
      Consent Mode defaults before any Google tag.
- [ ] Keep the Privacy Policy's "Cookies and similar technologies" section in step with what the
      CMP and your tags actually set.
- [ ] Decide whether to show the banner everywhere (current behaviour, simplest) or only in
      regulated regions. The latter needs geolocation, which a CMP usually provides.

## Contact form (Phase 5)

- [ ] **Required.** Set `CONTACT_WEBHOOK_URL` in the hosting dashboard. The form posts a JSON
      body `{ name, email, message, receivedAt }` to it. Options: a Zapier/Make webhook that sends you
      an email, a form service that accepts JSON, or your own endpoint. Until it is set, the form
      answers "cannot be sent" and shows your email address instead (no message is lost silently).
- [ ] Recommended. Create a free Cloudflare Turnstile widget and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
      and `TURNSTILE_SECRET_KEY`. Without them the form still has a honeypot, a minimum fill time and a
      link limit, but no CAPTCHA.
- [ ] Rate limiting is not built in. If you see abuse, add the host's firewall/rate-limit rules
      (for example Vercel Firewall or Cloudflare) for `POST /api/contact`.

## Ads and affiliate links (Phase 6)

Details in [ADS.md](ADS.md). Ads are off until you do the following.

- [ ] **Required.** Create a Google AdSense account and add the site. AdSense reviews the site
      (content, legal pages, traffic), so launch the legal pages and calculators first.
- [ ] **Required.** Put your publisher ID in `public/ads.txt` (replace `pub-0000000000000000`), then
      confirm `https://yourdomain/ads.txt` loads. Delete the placeholder check in
      `src/lib/__tests__/ads-files.test.ts` once the real ID is in.
- [ ] **Required.** In AdSense, create four responsive display ad units and set
      `NEXT_PUBLIC_ADSENSE_SLOT_BELOW`, `_SIDEBAR`, `_CONTENT` and `_END`.
- [ ] **Required.** Set `NEXT_PUBLIC_ADSENSE_CLIENT` (`ca-pub-...`) and `NEXT_PUBLIC_ADS_ENABLED=true`
      for **Production only**, then redeploy (these values are baked in at build time).
- [ ] **Required.** Turn **Auto ads off** for the site in the AdSense console.
- [ ] On Vercel, enable "Automatically expose System Environment Variables" so preview deployments are
      recognized and never show ads.
- [ ] Before the first live day, try a staging build with `NEXT_PUBLIC_ADS_TEST_MODE=true`.
- [ ] A Google-certified CMP is still required for visitors in the EEA, UK and Switzerland (see
      "Cookie consent" above). Until it is in place, serve ads only after the built-in banner consent,
      as the code does now, and expect AdSense to flag the EEA/UK.
- [ ] Affiliate offers: for each program you join, add the approved link to
      `src/lib/data/affiliates.ts` and set `active: true`. Keep `<AffiliateDisclosure />` visible
      (the card already includes it).

## Still open from earlier phases

- [ ] Replace the "FinCalc" placeholder brand in `src/lib/site-config.ts`.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the production domain at build time.
- [ ] Sign off the 2026 payroll figures in `src/lib/data/payroll-us-2026.ts` (Social Security wage base $184,500,
      Medicare thresholds, 401(k) limits) against the SSA and IRS pages listed in that file, then set `ownerVerified: true`.
      I read each figure on its official page on 2026-10-19; the sign-off is yours.
- [ ] Sign off the 2026 tax figures in `src/lib/data/tax-us-2026.ts` and set `ownerVerified: true`.
      They were compared line by line with IRS Rev. Proc. 2025-32 on 2026-10-17 and the tests check
      the engine against the IRS published base-tax amounts, but the sign-off is yours.
- [ ] Test on a real iPhone and a real Android phone (emulation is covered by `pnpm e2e:browsers`).
- [ ] Install a Google-certified consent platform before serving ads to the EEA, UK or Switzerland.
- [ ] Run the live-site check on production: `pnpm launch-check --base https://your-domain --site-url https://your-domain --no-source`.
- [ ] Re-measure mobile Lighthouse on the deployed site with PageSpeed Insights (the local numbers from 2026-10-19
      were taken on a loaded machine; see `docs/PERFORMANCE.md`), then re-record `docs/perf/final-lighthouse-mobile.json`
      with `pnpm perf` on a quiet computer so `pnpm launch-check` reflects it.
- [ ] Run Google's Rich Results Test on the deployed site.
