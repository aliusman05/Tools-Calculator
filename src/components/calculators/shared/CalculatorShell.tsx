import type { ReactNode } from "react";
import { AdSlot } from "@/components/ads/AdSlot";
import { Card } from "@/components/ui/Card";
import { adsConfig, adsOccupySpace } from "@/lib/ads-config";
import { ResultDisclaimer } from "./ResultDisclaimer";

/** Whether ad boxes (real or placeholder) take up room. When false nothing is rendered at all. */
const showAds = adsOccupySpace(adsConfig);

/**
 * Standard calculator layout: inputs on the left, results on the right (stacked on mobile).
 *
 * Ad positions (see docs/ADS.md):
 *  - mobile: one ad BELOW the results, never between the inputs and the results;
 *  - desktop: one ad in the right column under the results.
 * Each is separated from the calculator by the disclaimer text and generous margins, so it is
 * never adjacent to an input or a button. Pass `sidebar` / `below` to override them.
 */
export function CalculatorShell({
  title,
  inputs,
  results,
  afterInputs,
  sidebar,
  below,
}: {
  title: string;
  inputs: ReactNode;
  results: ReactNode;
  afterInputs?: ReactNode;
  sidebar?: ReactNode;
  below?: ReactNode;
}) {
  const sidebarContent =
    sidebar ?? (showAds ? <AdSlot placement="sidebar" minHeight={250} /> : null);
  const belowContent =
    below ??
    (showAds ? (
      <div className="lg:hidden">
        <AdSlot placement="calculatorBelow" minHeight={280} />
      </div>
    ) : null);

  return (
    <div className="my-8 flex flex-col gap-6">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-6">
          <section aria-label={`${title} inputs`}>
            <Card className="flex flex-col gap-5">{inputs}</Card>
          </section>
          {afterInputs && <div className="lg:hidden">{afterInputs}</div>}
        </div>
        <div className="flex flex-col gap-6">
          <section aria-label={`${title} results`} className="flex flex-col gap-6">
            {results}
            <ResultDisclaimer />
          </section>
          {sidebarContent && <div className="hidden lg:block">{sidebarContent}</div>}
        </div>
      </div>
      {belowContent}
    </div>
  );
}
