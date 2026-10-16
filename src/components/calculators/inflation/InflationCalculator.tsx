"use client";

import { useMemo } from "react";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { ResultCard, type SecondaryResult } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Select } from "@/components/ui/Select";
import { Table, Td, Th } from "@/components/ui/Table";
import {
  calculateInflation,
  type InflationInput,
  type InflationMode,
} from "@/lib/calculators/inflation";
import { formatCurrency, formatNumber } from "@/lib/format";
import { required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  mode: "future",
  amount: 1_000 as number | null,
  ratePct: 3 as number | null,
  years: 20 as number | null,
  endAmount: 1_800 as number | null,
};

type State = typeof DEFAULTS;

const MODES: InflationMode[] = ["future", "power", "rate"];

function toInput(s: State): InflationInput {
  return {
    mode: MODES.find((m) => m === s.mode) ?? "future",
    amount: required(s.amount),
    ratePct: required(s.ratePct),
    years: required(s.years),
    endAmount: required(s.endAmount),
  };
}

const pct = (v: number) => `${formatNumber(v, { decimals: 2 })}%`;

export default function InflationCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const input = useMemo(() => toInput(values), [values]);
  const outcome = useMemo(() => calculateInflation(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Inflation</legend>
        <Select
          id="inf-mode"
          label="What do you want to find?"
          value={input.mode}
          onChange={(e) => setValue("mode", e.target.value)}
          options={[
            { value: "future", label: "What something will cost in the future" },
            { value: "power", label: "What money will be worth in today's dollars" },
            { value: "rate", label: "The average inflation rate between two prices" },
          ]}
        />
        <CurrencyInput
          id="inf-amount"
          label={input.mode === "rate" ? "Price at the start" : "Amount in today's dollars"}
          value={values.amount}
          onChange={(v) => setValue("amount", v)}
          error={errors.amount}
        />
        {input.mode === "rate" ? (
          <CurrencyInput
            id="inf-end"
            label="Price at the end"
            value={values.endAmount}
            onChange={(v) => setValue("endAmount", v)}
            error={errors.endAmount}
          />
        ) : (
          <PercentInput
            id="inf-rate"
            label="Annual inflation rate"
            value={values.ratePct}
            onChange={(v) => setValue("ratePct", v)}
            error={errors.ratePct}
          />
        )}
        <NumericInput
          id="inf-years"
          label="Number of years"
          suffix="yrs"
          grouping={false}
          value={values.years}
          onChange={(v) => setValue("years", v)}
          error={errors.years}
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
    const yearsText = `${formatNumber(r.years, { decimals: r.years % 1 === 0 ? 0 : 2 })} ${r.years === 1 ? "year" : "years"}`;

    const primary =
      r.mode === "power"
        ? {
            label: `Purchasing power in today's dollars`,
            value: formatCurrency(r.headline),
            note: `${formatCurrency(input.amount)} in ${yearsText} will buy what ${formatCurrency(r.headline)} buys now`,
          }
        : r.mode === "rate"
          ? {
              label: "Average annual inflation",
              value: pct(r.ratePct),
              note: `Prices went from ${formatCurrency(input.amount)} to ${formatCurrency(input.endAmount)} in ${yearsText}`,
            }
          : {
              label: `Cost in ${yearsText}`,
              value: formatCurrency(r.headline),
              note: `What costs ${formatCurrency(input.amount)} today, at ${pct(r.ratePct)} inflation`,
            };

    const secondary: SecondaryResult[] = [
      { label: "Total price increase", value: pct(r.totalInflationPct) },
      { label: "Purchasing power lost", value: pct(r.powerLostPct) },
    ];
    if (r.mode !== "rate")
      secondary.push({ label: "Annual inflation rate", value: pct(r.ratePct) });
    if (r.doublingYears !== null) {
      secondary.push({
        label: "Years for prices to double",
        value: formatNumber(r.doublingYears, { decimals: 1 }),
      });
    }

    const chartData = r.schedule.map((row) => ({
      year: row.year,
      cost: Math.round(row.futureCost * 100) / 100,
      power: Math.round(row.purchasingPower * 100) / 100,
    }));

    results = (
      <>
        <ResultCard {...primary} secondary={secondary} />
        <ChartSection
          title="Prices up, purchasing power down"
          summary={`Over ${yearsText} at ${pct(r.ratePct)} a year, something costing ${formatCurrency(input.amount, { decimals: 0 })} today would cost ${formatCurrency(input.amount * (1 + r.totalInflationPct / 100), { decimals: 0 })}, and ${formatCurrency(input.amount, { decimals: 0 })} would buy what ${formatCurrency(input.amount / (1 + r.totalInflationPct / 100), { decimals: 0 })} buys today.`}
          data={chartData}
          xKey="year"
          xLabel="Year"
          series={[
            { key: "cost", label: "Future cost", color: "var(--chart-2)" },
            { key: "power", label: "Purchasing power", color: "var(--accent)" },
          ]}
        />
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Year by year</h3>
          <Table caption="Inflation year-by-year table">
            <thead>
              <tr>
                <Th>Year</Th>
                <Th align="right">Future cost</Th>
                <Th align="right">Purchasing power</Th>
              </tr>
            </thead>
            <tbody>
              {r.schedule.map((row) => (
                <tr key={row.year}>
                  <Td>{formatNumber(row.year, { decimals: row.year % 1 === 0 ? 0 : 2 })}</Td>
                  <Td align="right">{formatCurrency(row.futureCost)}</Td>
                  <Td align="right">{formatCurrency(row.purchasingPower)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </>
    );
  }

  return <CalculatorShell title="Inflation calculator" inputs={inputs} results={results} />;
}
