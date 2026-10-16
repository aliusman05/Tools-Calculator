/**
 * Affiliate offers. This is the only place affiliate links live.
 *
 * Every offer is INACTIVE until you fill in a real, approved link and set `active: true`; an
 * inactive offer renders nothing. Do not add an offer you have not been approved for, and keep
 * the claims in `description` factual and consistent with the partner's own terms.
 *
 * Offers appear only on pages whose calculator has the matching `affiliateContext` in the
 * registry, and always with the advertising disclosure.
 */

export type AffiliateContext =
  | "credit-card"
  | "personal-loan"
  | "mortgage"
  | "auto-loan"
  | "savings-account"
  | "investing"
  | "tax-software"
  | "debt-consolidation";

export type AffiliateOffer = {
  /** Stable ID, used for tracking and tests. */
  id: string;
  /** Partner name shown on the card. */
  partner: string;
  headline: string;
  description: string;
  /** Button text, for example "See the offer". */
  cta: string;
  /** The tracking link from the affiliate network. */
  url: string;
  /** Pages (by calculator `affiliateContext`) where this offer may appear. */
  contexts: readonly AffiliateContext[];
  /** Nothing is rendered unless this is true. */
  active: boolean;
};

export const affiliates: readonly AffiliateOffer[] = [
  {
    id: "example-balance-transfer-card",
    partner: "Example Bank",
    headline: "Looking for a 0% intro APR balance transfer card?",
    description:
      "Moving a card balance to a 0% introductory rate can cut interest while you pay it down. Check the transfer fee and when the intro rate ends.",
    cta: "See the offer",
    url: "",
    contexts: ["credit-card", "debt-consolidation"],
    active: false,
  },
];

const isUsable = (o: AffiliateOffer) => o.active && /^https:\/\//.test(o.url);

/** Active offers for a page context, at most `limit` of them. */
export function offersFor(
  context: AffiliateContext | undefined,
  list: readonly AffiliateOffer[] = affiliates,
  limit = 1,
): AffiliateOffer[] {
  if (!context) return [];
  return list.filter((o) => isUsable(o) && o.contexts.includes(context)).slice(0, limit);
}
