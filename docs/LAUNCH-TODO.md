# Launch to-do: things only the site owner can do

Items marked **Required** block launch or AdSense approval. Everything here is outside the code.

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

## Affiliate links (Phase 6)

- [ ] Show `<AffiliateDisclosure />` (`src/components/legal/AffiliateDisclosure.tsx`) next to every
      affiliate link or offer. The disclaimer page already has the matching `#affiliate` section.

## Still open from earlier phases

- [ ] Replace the "FinCalc" placeholder brand in `src/lib/site-config.ts`.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the production domain at build time.
- [ ] Confirm the 2026 tax figures in `src/lib/data/tax-us-2026.ts` against IRS Rev. Proc. 2025-32
      and set `ownerVerified: true`.
- [ ] Run Google's Rich Results Test on the deployed site.
