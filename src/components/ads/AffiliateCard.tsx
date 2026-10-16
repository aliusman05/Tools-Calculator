import { AffiliateDisclosure } from "@/components/legal/AffiliateDisclosure";
import { Card } from "@/components/ui/Card";
import { offersFor, type AffiliateContext, type AffiliateOffer } from "@/lib/data/affiliates";

/**
 * One affiliate offer. The link carries rel="sponsored noopener" and the card always shows the
 * advertising disclosure right next to it.
 */
export function AffiliateCard({ offer }: { offer: AffiliateOffer }) {
  return (
    <Card className="flex flex-col gap-3" data-affiliate-id={offer.id}>
      <p className="text-muted text-xs font-semibold tracking-wide uppercase">Sponsored</p>
      <div>
        <h3 className="text-lg font-semibold">{offer.headline}</h3>
        <p className="text-muted mt-1">{offer.description}</p>
        <p className="text-muted mt-1 text-sm">Offered by {offer.partner}.</p>
      </div>
      <a
        href={offer.url}
        target="_blank"
        rel="sponsored noopener"
        className="rounded-control bg-accent text-accent-foreground hover:bg-accent-hover inline-flex min-h-11 items-center justify-center self-start px-4 py-2 text-sm font-semibold"
      >
        {offer.cta}
        <span className="sr-only"> (opens in a new tab, sponsored link)</span>
      </a>
      <AffiliateDisclosure compact />
    </Card>
  );
}

/** Shows the active offer(s) for a page's context, or nothing at all. */
export function AffiliateSlot({
  context,
  limit = 1,
}: {
  context: AffiliateContext | undefined;
  limit?: number;
}) {
  const offers = offersFor(context, undefined, limit);
  if (offers.length === 0) return null;
  return (
    <section aria-label="Sponsored offer" className="my-10 max-w-3xl">
      {offers.map((o) => (
        <AffiliateCard key={o.id} offer={o} />
      ))}
    </section>
  );
}
