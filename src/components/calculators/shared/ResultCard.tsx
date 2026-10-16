import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export type SecondaryResult = { label: string; value: string; note?: string };

/** Primary result shown large, with secondary results beneath. */
export function ResultCard({
  label,
  value,
  note,
  secondary = [],
  children,
}: {
  label: string;
  value: string;
  note?: string;
  secondary?: SecondaryResult[];
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-5">
      <div aria-live="polite" aria-atomic="true">
        <p className="text-muted text-sm font-medium">{label}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{value}</p>
        {note && <p className="text-muted mt-1 text-sm">{note}</p>}
      </div>
      {secondary.length > 0 && (
        <dl className="border-border grid gap-x-6 gap-y-3 border-t pt-4 sm:grid-cols-2">
          {secondary.map((item) => (
            <div key={item.label}>
              <dt className="text-muted text-sm">{item.label}</dt>
              <dd className="font-semibold tabular-nums">{item.value}</dd>
              {item.note && <dd className="text-muted text-xs">{item.note}</dd>}
            </div>
          ))}
        </dl>
      )}
      {children}
    </Card>
  );
}
