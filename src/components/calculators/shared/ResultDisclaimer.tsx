import Link from "next/link";

/** Short note shown under every calculator's results. */
export function ResultDisclaimer() {
  return (
    <p className="text-muted text-xs" data-testid="result-disclaimer">
      Estimates for educational purposes only, based on the inputs and assumptions above. Not
      financial, tax or legal advice. Your lender, plan or tax return may differ.{" "}
      <Link href="/disclaimer" className="text-accent underline underline-offset-2">
        Read the full disclaimer
      </Link>
      .
    </p>
  );
}
