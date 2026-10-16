import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Disclosure to show next to any affiliate link or offer. Keep it visible and close to the link,
 * not buried in the footer.
 */
export function AffiliateDisclosure({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <p className={cn("text-muted text-xs", className)} data-testid="affiliate-disclosure">
      <strong className="text-foreground font-semibold">Advertising disclosure:</strong>{" "}
      {compact
        ? "We may earn a commission if you use this link, at no extra cost to you."
        : "This page may contain affiliate links. If you apply for or buy a product through them we may earn a commission, at no extra cost to you. It does not change our calculators or how we write about them."}{" "}
      <Link href="/disclaimer#affiliate" className="text-accent underline underline-offset-2">
        Learn more
      </Link>
      .
    </p>
  );
}
