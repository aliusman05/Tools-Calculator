"use client";

import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import { MONTH_OPTIONS } from "@/lib/format";

/** First-payment month and year, used to label schedule dates and the payoff date. */
export function PaymentStartFields({
  idPrefix,
  month,
  year,
  onMonthChange,
  onYearChange,
}: {
  idPrefix: string;
  month: number;
  year: number | null;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number | null) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select
        id={`${idPrefix}-start-month`}
        label="First payment month"
        value={String(month)}
        onChange={(e) => onMonthChange(Number(e.target.value))}
        options={MONTH_OPTIONS}
      />
      <NumericInput
        id={`${idPrefix}-start-year`}
        label="First payment year"
        grouping={false}
        value={year}
        onChange={onYearChange}
      />
    </div>
  );
}
