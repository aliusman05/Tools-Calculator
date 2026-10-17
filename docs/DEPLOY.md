# Deploying and launching

Vercel is the tested path (Next.js is built by the same company, and the app reads Vercel's environment
variables to tell production from previews). Other hosts that run Next.js work too; the variables and the
checks below still apply.

## Hosting plan and commercial use

Checked 2026-10-17 against Vercel's [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines):
the free Hobby plan is limited to non-commercial personal use, and commercial use (any deployment used for
the financial gain of anyone involved in producing it, which includes advertising, affiliate links and
payments) needs a Pro or Enterprise plan. An ad-supported calculator site is commercial.

- Plan on **Pro** before AdSense or any affiliate link goes live.
- Launching on Hobby while the site has no ads and no affiliate links is a gray area. Ask Vercel support if
  you want certainty, or start on Pro.
- Terms change. Re-read them before you turn ads on. Cloudflare Pages and Netlify are alternatives, but a
  Next.js app needs extra setup there (an adapter), so test the build and the checks in this document first.

## 1. Before you deploy

- [ ] Push the repository to GitHub and check that the CI workflow passes (see [TESTING.md](TESTING.md)).
- [ ] Work through [LAUNCH-TODO.md](LAUNCH-TODO.md): legal text, brand name, tax sign-off.
- [ ] Buy the domain. Decide the canonical host: `example.com` or `www.example.com`. Pick one and stick to it.

## 2. Create the Vercel project

1. In Vercel, **Add New > Project** and import the GitHub repository.
2. Framework preset **Next.js**. Install command `pnpm install --frozen-lockfile`, build command
   `pnpm build`. Node.js version **22.x** (Project Settings > General).
3. **Settings > Environment Variables > "Automatically expose System Environment Variables": ON.** This is
   what lets the app know a deployment is a preview. Previews then send `noindex`, a `Disallow: /`
   robots.txt, and never load ads or analytics.
4. Add the variables below, then deploy.

### Environment variables

`NEXT_PUBLIC_*` values are baked in at build time: change one, then redeploy.

| Variable                                                                              | Environments        | Value                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                                | Production          | `https://your-domain.com` (no trailing slash). Canonical URLs, the sitemap, Open Graph and schema all use it. |
| `CONTACT_WEBHOOK_URL`                                                                 | Production, Preview | Where contact-form messages are POSTed as JSON (a form service, Zapier or Make hook, or your own endpoint).   |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`                              | Production          | Optional Cloudflare Turnstile CAPTCHA for the contact form.                                                   |
| `NEXT_PUBLIC_GA_ID`                                                                   | Production          | GA4 measurement ID, `G-XXXXXXXXXX`. Loads only after the visitor accepts analytics.                           |
| `NEXT_PUBLIC_ADS_ENABLED`, `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT_*` | Production          | Only after AdSense approves the site. See [ADS.md](ADS.md).                                                   |

Leave ads and analytics variables out of Preview.

## 3. Domain, HTTPS, one canonical host

1. **Settings > Domains**: add both `example.com` and `www.example.com`.
2. Set the one you did _not_ choose to **redirect** to the canonical host (permanent, 308). Visitors and
   search engines then only ever see one host.
3. HTTPS is automatic. The app also sends `Strict-Transport-Security`, so browsers refuse plain HTTP
   after the first visit.
4. Confirm `NEXT_PUBLIC_SITE_URL` uses exactly the canonical host.

## 4. Verify the deployment

```bash
pnpm launch-check --base https://your-domain.com --site-url https://your-domain.com --no-source
```

This repeats the live-site checks of the pre-launch checklist against production: titles and
descriptions, canonicals, structured data, legal pages and footer links, consent defaults, ads.txt,
robots.txt, sitemap, 404, security headers and icons, plus a reminder of the steps only you can do.
Fix anything marked FAIL. (Run it without `--no-source` on your computer to include the source checks.)

Then, by hand:

- [ ] Open the site on a **real iPhone** and a **real Android phone**: try a calculator, the menu and the
      cookie banner. Emulation is tested, hardware is not.
- [ ] Reject all in the banner and check nothing from Google loads; accept analytics and check GA4
      **Realtime** shows your visit, with page paths and no query strings.
- [ ] Run Google's [Rich Results Test](https://search.google.com/test/rich-results) and
      [PageSpeed Insights](https://pagespeed.web.dev/) on a calculator page.
- [ ] Send yourself a message through the contact form.
- [ ] View `https://your-domain.com/robots.txt`, `/sitemap.xml` and `/ads.txt`.

## 5. Search engines

1. **Google Search Console**: add a _Domain_ property (verify with a DNS TXT record), submit
   `https://your-domain.com/sitemap.xml`.
2. **Bing Webmaster Tools**: import the site from Search Console, or verify separately, and submit the sitemap.
3. Do not request indexing page by page; the sitemap is enough. Expect weeks, not days.

## 6. Monetization

1. Apply for AdSense once the legal pages are real, the site is live, and there is some organic traffic.
2. Put your publisher ID in `public/ads.txt`, turn Auto ads off, create the four ad units, set the
   variables, redeploy. [ADS.md](ADS.md) has the details.
3. Install a Google-certified consent management platform before serving ads to the EEA, UK or
   Switzerland ([LAUNCH-TODO.md](LAUNCH-TODO.md)).

## 7. After launch

- Re-run `pnpm launch-check` against production after every significant change.
- Each autumn, when the IRS publishes next year's inflation adjustments, add `tax-us-<year>.ts` and
  repoint `CURRENT_TAX_YEAR` ([tax-us-2026.ts](../src/lib/data/tax-us-2026.ts) explains how).
- To roll back a bad release use Vercel's **Instant Rollback** on the previous deployment.
