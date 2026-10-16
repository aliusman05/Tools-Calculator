import type { ReactNode } from "react";

export type AccordionItem = { question: string; answer: ReactNode };

/** FAQ accordion built on native details/summary: keyboard accessible with no client JS. */
export function Accordion({ items }: { items: AccordionItem[] }) {
  return (
    <div className="divide-border rounded-card border-border bg-surface divide-y border">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
            {item.question}
            <span
              aria-hidden="true"
              className="text-muted text-xl leading-none transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="text-muted px-4 pb-4">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
