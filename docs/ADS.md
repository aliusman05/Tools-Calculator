# Ads and affiliate links

How advertising works on the site, how to switch it on, and the rules the layout follows.

## Switching ads on

Ads are **off by default**. They render only when every one of these is true:

| Condition                                | How to set it                                        |
| ---------------------------------------- | ---------------------------------------------------- |
| The flag is on                           | `NEXT_PUBLIC_ADS_ENABLED=true`                       |
| A valid publisher ID                     | `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX` |
| It is a production build                 | automatic: never on `next dev`                       |
| It is not a preview deployment           | `NEXT_PUBLIC_VERCEL_ENV` unset or `production`       |
| The visitor accepted advertising cookies | the cookie banner (`ConsentGate`)                    |

A placement also needs its own ad-unit ID, otherwise it renders nothing:

| Env var                            | Placement                            |
| ---------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_ADSENSE_SLOT_BELOW`   | below the calculator (mobile only)   |
| `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR` | under the results (desktop only)     |
| `NEXT_PUBLIC_ADSENSE_SLOT_CONTENT` | in the article, after "How it works" |
| `NEXT_PUBLIC_ADSENSE_SLOT_END`     | near the end of the page             |

`NEXT_PUBLIC_*` values are baked in at **build time**, so change them in the hosting dashboard and redeploy.

**Preview deployments.** On Vercel, turn on "Automatically expose System Environment Variables" so
`NEXT_PUBLIC_VERCEL_ENV` exists. Previews then never show ads, even if the variables are set for them.

**Checking layout without ads.** Set `NEXT_PUBLIC_ADS_PLACEHOLDER=true` (or run `next dev`, which does it
automatically) to see labelled empty boxes of the real size where ads would go.

**Test ads.** `NEXT_PUBLIC_ADS_TEST_MODE=true` adds `data-adtest="on"`, so AdSense serves test ads.
Use it on a staging build, never in production.

All of this logic lives in `src/lib/ads-config.ts` and is unit tested.

## Placement rules

Each calculator page has at most three ads at any screen size:

| Position                                            | Mobile | Desktop |
| --------------------------------------------------- | ------ | ------- |
| Below the calculator, after the results             | yes    | no      |
| Right column, under the results                     | no     | yes     |
| Inside the article, after "How it works"            | yes    | yes     |
| Near the end of the page, after related calculators | yes    | yes     |

Rules the code and tests enforce:

- Never above the page heading or the calculator inputs, and never between the inputs and the results.
- Never within 24px of an input, button or link. Ads sit inside generous margins and below the
  disclaimer text; this is measured in the ads e2e suite.
- The in-content ad is placed by `<ContentAd />` in each calculator's MDX file, exactly once, after
  "How it works" and before "Worked example". A unit test checks every file.
- Ads take up under 25% of the page height.
- No ads on the home page, category pages, About, Contact, legal pages or search results.
- Every ad is labelled "Advertisement".

## Loading behaviour

- The AdSense library loads only after the visitor accepts advertising cookies, via `next/script`
  (`afterInteractive`) inside `ConsentGate`. Before that, nothing is requested.
- Each slot reserves its full height (`minHeight`) as soon as it renders, so an ad arriving later
  moves nothing. The e2e suite measures layout shift while scrolling the whole page.
- A slot asks for its ad only when it scrolls within about 300px of the viewport. Slots hidden by
  CSS (for example the desktop sidebar on a phone) never request an ad.
- Withdrawing consent removes the slots immediately. The library itself stays loaded until the next
  page load; that is a limitation of the AdSense script.

## Things to set in the AdSense console

- **Turn Auto ads off** (or exclude the site from them). Auto ads can inject ads anywhere, including
  next to inputs and buttons, which this site is built to avoid and which AdSense policy forbids.
- Create four display ad units (responsive) and put their IDs in the env vars above.
- Keep `public/ads.txt` in step with your publisher ID.

## Affiliate links

- Offers live in `src/lib/data/affiliates.ts`. Every offer ships **inactive**; an inactive offer renders
  nothing. To use one, add your approved tracking URL (must be `https://`) and set `active: true`.
- Offers appear only on calculators whose registry entry has a matching `affiliateContext`
  (for example the credit card payoff calculator uses `"credit-card"`), at most one per page, between
  the calculator and the FAQ.
- Links use `rel="sponsored noopener"` and open in a new tab. The card is labelled "Sponsored" and
  always carries the advertising disclosure, which links to the `#affiliate` section of the
  disclaimer page.
- Do not add an offer you are not approved for, and keep its claims consistent with the partner's
  own terms.
