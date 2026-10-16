"use client";

import { useMemo } from "react";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { ResultCard, type SecondaryResult } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import { calculateRoi, type RoiInput, type RoiUnit } from "@/lib/calculators/roi";
import { formatCurrency, formatNumber } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  initial: 10_000 as number | null,
  final: 15_000 as number | null,
  time: 5 as number | null,
  unit: "years",
};

type State = typeof DEFAULTS;

const UNITS: RoiUnit[] = ["years", "months", "days"];

function toInput(s: State): RoiInput {
  return {
    initial: required(s.initial),
    final: required(s.final),
    time: optional(s.time),
    unit: UNITS.find((u) => u === s.unit) ?? "years",
  };
}

const pct = (v: number) => `${formatNumber(v, { decimals: 2 })}%`;

export default function RoiCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const input = useMemo(() => toInput(values), [values]);
  const outcome = useMemo(() => calculateRoi(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Your investment</legend>
        <CurrencyInput
          id="roi-initial"
          label="Initial investment"
          value={values.initial}
          onChange={(v) => setValue("initial", v)}
          error={errors.initial}
        />
        <CurrencyInput
          id="roi-final"
          label="Final value"
          value={values.final}
          onChange={(v) => setValue("final", v)}
          error={errors.final}
        />
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <NumericInput
            id="roi-time"
            label="How long you held it"
            grouping={false}
            value={values.time}
            onChange={(v) => setValue("time", v)}
            hint="Optional. Needed to calculate CAGR."
            error={errors.time}
          />
          <Select
            id="roi-unit"
            label="Unit"
            value={input.unit}
            onChange={(e) => setValue("unit", e.target.value)}
            options={[
              { value: "years", label: "Years" },
              { value: "months", label: "Months" },
              { value: "days", label: "Days" },
            ]}
          />
        </div>
      </fieldset>
      <Button variant="secondary" onClick={reset} className="self-start">
        Reset to defaults
      </Button>
    </>
  );

  let results;
  if (!outcome.ok) {
    results = <InvalidNotice />;
  } else {
    const r = outcome.result;
    const secondary: SecondaryResult[] = [
      { label: r.gain >= 0 ? "Gain" : "Loss", value: formatCurrency(Math.abs(r.gain)) },
      { label: "Initial investment", value: formatCurrency(input.initial) },
      { label: "Final value", value: formatCurrency(input.final) },
    ];
    if (r.cagrPct !== null && r.simpleAnnualPct !== null) {
      secondary.push({
        label: "Simple annual return",
        value: pct(r.simpleAnnualPct),
        note: "ROI ÷ years, no compounding",
      });
    }
    if (r.doublingYears !== null) {
      secondary.push({
        label: "Years to double at this CAGR",
        value: formatNumber(r.doublingYears, { decimals: 1 }),
      });
    }

    const chartData = r.series.map((p) => ({
      year: p.year,
      compound: Math.round(p.compound * 100) / 100,
      straight: Math.round(p.straightLine * 100) / 100,
    }));

    results = (
      <>
        <ResultCard
          label="Return on investment (ROI)"
          value={pct(r.roiPct)}
          note={
            r.gain >= 0 ? "Total gain over the whole period" : "Total loss over the whole period"
          }
          secondary={secondary}
        >
          <div className="border-border border-t pt-4" aria-live="polite">
            <p className="text-muted text-sm font-medium">Compound annual growth rate (CAGR)</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {r.cagrPct === null ? "Add a holding period" : pct(r.cagrPct)}
            </p>
            {r.cagrPct !== null && (
              <p className="text-muted mt-1 text-sm">
                The steady yearly rate that gives the same result
              </p>
            )}
          </div>
        </ResultCard>
        {r.series.length > 0 && (
          <ChartSection
            title="Steady growth at the CAGR"
            summary={`At a steady ${pct(r.cagrPct ?? 0)} a year, ${formatCurrency(input.initial, { decimals: 0 })} grows to ${formatCurrency(input.final, { decimals: 0 })}.`}
            data={chartData}
            xKey="year"
            xLabel="Years"
            series={[
              { key: "compound", label: "At constant CAGR", color: "var(--accent)" },
              { key: "straight", label: "Straight line", color: "var(--chart-2)" },
            ]}
          />
        )}
      </>
    );
  }

  return <CalculatorShell title="ROI and CAGR calculator" inputs={inputs} results={results} />;
}
