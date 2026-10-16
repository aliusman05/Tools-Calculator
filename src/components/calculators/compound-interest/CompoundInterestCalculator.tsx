"use client";

import { useMemo } from "react";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { ResultCard } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Select } from "@/components/ui/Select";
import { Table, Td, Th } from "@/components/ui/Table";
import {
  calculateCompound,
  type CompoundInput,
  type Compounding,
  type ContributionTiming,
} from "@/lib/calculators/compound";
import { formatCurrency } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  principal: 10_000 as number | null,
  monthlyContribution: 200 as number | null,
  annualRatePct: 5 as number | null,
  years: 10 as number | null,
  compounding: "monthly",
  timing: "end",
};

type State = typeof DEFAULTS;

const COMPOUNDING_VALUES: Compounding[] = ["daily", "monthly", "quarterly", "annually"];

function toInput(s: State): CompoundInput {
  return {
    principal: optional(s.principal),
    monthlyContribution: optional(s.monthlyContribution),
    annualRatePct: required(s.annualRatePct),
    years: required(s.years),
    compounding: COMPOUNDING_VALUES.find((c) => c === s.compounding) ?? "monthly",
    timing: (s.timing === "start" ? "start" : "end") satisfies ContributionTiming,
  };
}

const money0 = (v: number) => formatCurrency(v, { decimals: 0 });

export default function CompoundInterestCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const outcome = useMemo(() => calculateCompound(toInput(values)), [values]);
  const errors = outcome.ok ? {} : outcome.errors;

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Your savings</legend>
        <CurrencyInput
          id="ci-principal"
          label="Starting amount"
          value={values.principal}
          onChange={(v) => setValue("principal", v)}
          error={errors.principal}
        />
        <CurrencyInput
          id="ci-contribution"
          label="Monthly deposit"
          value={values.monthlyContribution}
          onChange={(v) => setValue("monthlyContribution", v)}
          error={errors.monthlyContribution}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PercentInput
            id="ci-rate"
            label="Annual interest rate"
            value={values.annualRatePct}
            onChange={(v) => setValue("annualRatePct", v)}
            error={errors.annualRatePct}
          />
          <NumericInput
            id="ci-years"
            label="Time"
            suffix="yrs"
            grouping={false}
            value={values.years}
            onChange={(v) => setValue("years", v)}
            error={errors.years}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Options</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="ci-compounding"
            label="Compounding"
            value={values.compounding}
            onChange={(e) => setValue("compounding", e.target.value)}
            options={[
              { value: "daily", label: "Daily" },
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "annually", label: "Annually" },
            ]}
          />
          <Select
            id="ci-timing"
            label="Deposits are made"
            value={values.timing}
            onChange={(e) => setValue("timing", e.target.value)}
            options={[
              { value: "end", label: "At the end of each month" },
              { value: "start", label: "At the start of each month" },
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
    const chartData = r.schedule.map((y) => ({
      year: y.year,
      start: Math.round(r.principal),
      deposits: Math.round(y.totalDeposited - r.principal),
      interest: Math.round(y.cumulativeInterest),
    }));

    results = (
      <>
        <ResultCard
          label="Future value"
          value={formatCurrency(r.finalBalance)}
          note={`After ${r.months % 12 === 0 ? `${r.months / 12} ${r.months / 12 === 1 ? "year" : "years"}` : `${r.months} months`}`}
          secondary={[
            { label: "Starting amount", value: formatCurrency(r.principal) },
            { label: "Total deposits", value: formatCurrency(r.totalContributions) },
            { label: "Total interest earned", value: formatCurrency(r.totalInterest) },
            {
              label: "Interest share of balance",
              value: `${r.finalBalance > 0 ? ((r.totalInterest / r.finalBalance) * 100).toFixed(1) : "0.0"}%`,
            },
          ]}
        />
        <ChartSection
          kind="stackedBar"
          title="How your balance grows"
          summary={`Balance grows to ${money0(r.finalBalance)}: ${money0(r.principal)} starting amount, ${money0(r.totalContributions)} in deposits and ${money0(r.totalInterest)} in interest.`}
          data={chartData}
          xKey="year"
          xLabel="Year"
          series={[
            { key: "start", label: "Starting amount", color: "var(--accent)" },
            { key: "deposits", label: "Deposits", color: "var(--chart-3)" },
            { key: "interest", label: "Interest", color: "var(--chart-2)" },
          ]}
        />
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Year-by-year breakdown</h3>
          <Table caption="Compound interest year-by-year breakdown">
            <thead>
              <tr>
                <Th>Year</Th>
                <Th align="right">Deposits</Th>
                <Th align="right">Interest</Th>
                <Th align="right">Balance</Th>
              </tr>
            </thead>
            <tbody>
              {r.schedule.map((y) => (
                <tr key={y.year}>
                  <Td>{y.year}</Td>
                  <Td align="right">{formatCurrency(y.contributions)}</Td>
                  <Td align="right">{formatCurrency(y.interest)}</Td>
                  <Td align="right">{formatCurrency(y.balance)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </>
    );
  }

  return <CalculatorShell title="Compound interest calculator" inputs={inputs} results={results} />;
}
