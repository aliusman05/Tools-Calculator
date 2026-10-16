"use client";

import { useMemo } from "react";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { ResultCard } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Select } from "@/components/ui/Select";
import type { Compounding } from "@/lib/calculators/compound";
import {
  calculateSimpleInterest,
  type SimpleInterestInput,
  type TimeUnit,
} from "@/lib/calculators/simple-interest";
import { formatCurrency } from "@/lib/format";
import { required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  principal: 5_000 as number | null,
  annualRatePct: 6 as number | null,
  time: 3 as number | null,
  unit: "years",
  compareWith: "annually",
};

type State = typeof DEFAULTS;

const UNITS: TimeUnit[] = ["years", "months", "days"];
const COMPOUNDING: Compounding[] = ["daily", "monthly", "quarterly", "annually"];

function toInput(s: State): SimpleInterestInput {
  return {
    principal: required(s.principal),
    annualRatePct: required(s.annualRatePct),
    time: required(s.time),
    unit: UNITS.find((u) => u === s.unit) ?? "years",
    compareWith: COMPOUNDING.find((c) => c === s.compareWith) ?? "annually",
  };
}

export default function SimpleInterestCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const outcome = useMemo(() => calculateSimpleInterest(toInput(values)), [values]);
  const errors = outcome.ok ? {} : outcome.errors;

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Simple interest</legend>
        <CurrencyInput
          id="si-principal"
          label="Principal"
          value={values.principal}
          onChange={(v) => setValue("principal", v)}
          error={errors.principal}
        />
        <PercentInput
          id="si-rate"
          label="Annual interest rate"
          value={values.annualRatePct}
          onChange={(v) => setValue("annualRatePct", v)}
          error={errors.annualRatePct}
        />
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <NumericInput
            id="si-time"
            label="Time"
            grouping={false}
            value={values.time}
            onChange={(v) => setValue("time", v)}
            error={errors.time}
          />
          <Select
            id="si-unit"
            label="Unit"
            value={values.unit}
            onChange={(e) => setValue("unit", e.target.value)}
            options={[
              { value: "years", label: "Years" },
              { value: "months", label: "Months" },
              { value: "days", label: "Days" },
            ]}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Compare with compound interest</legend>
        <Select
          id="si-compare"
          label="Compounding"
          value={values.compareWith}
          onChange={(e) => setValue("compareWith", e.target.value)}
          options={[
            { value: "annually", label: "Annually" },
            { value: "quarterly", label: "Quarterly" },
            { value: "monthly", label: "Monthly" },
            { value: "daily", label: "Daily" },
          ]}
        />
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
    const chartData = r.series.map((p) => ({
      year: p.year,
      simple: Math.round(p.simple * 100) / 100,
      compound: Math.round(p.compound * 100) / 100,
    }));
    results = (
      <>
        <ResultCard
          label="Simple interest earned"
          value={formatCurrency(r.interest)}
          note={`Total of ${formatCurrency(r.total)} after ${values.time} ${values.unit}`}
          secondary={[
            { label: "Total with simple interest", value: formatCurrency(r.total) },
            { label: "Total with compound interest", value: formatCurrency(r.compoundTotal) },
            { label: "Compound interest earned", value: formatCurrency(r.compoundInterest) },
            {
              label: "Extra earned by compounding",
              value: formatCurrency(r.difference),
              note: "Compound minus simple",
            },
          ]}
        />
        <ChartSection
          title="Simple vs. compound growth"
          summary={`Simple interest grows to ${formatCurrency(r.total, { decimals: 0 })}; compound interest grows to ${formatCurrency(r.compoundTotal, { decimals: 0 })} over the same period.`}
          data={chartData}
          xKey="year"
          xLabel="Years"
          series={[
            { key: "simple", label: "Simple interest", color: "var(--accent)" },
            { key: "compound", label: "Compound interest", color: "var(--chart-2)" },
          ]}
        />
      </>
    );
  }

  return <CalculatorShell title="Simple interest calculator" inputs={inputs} results={results} />;
}
