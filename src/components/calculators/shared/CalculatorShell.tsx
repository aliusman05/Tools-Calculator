import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/**
 * Standard calculator layout: inputs on the left, results on the right (stacked on mobile).
 * `afterInputs` renders under the inputs on mobile; `sidebar` renders under the results on
 * desktop. Phase 6 places ad slots in these positions.
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
          </section>
          {sidebar && <div className="hidden lg:block">{sidebar}</div>}
        </div>
      </div>
      {below}
    </div>
  );
}
