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
  calculateSavingsGoal,
  MAX_GOAL_MONTHS,
  type SavingsGoalInput,
} from "@/lib/calculators/savings-goal";
import { formatCurrency, formatDuration } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  mode: "contribution",
  target: 50_000 as number | null,
  current: 5_000 as number | null,
  annualRatePct: 4 as number | null,
  years: 10 as number | null,
  monthlyContribution: 300 as number | null,
};

type State = typeof DEFAULTS;

function toInput(s: State): SavingsGoalInput {
  return {
    mode: s.mode === "time" ? "time" : "contribution",
    target: required(s.target),
    current: optional(s.current),
    annualRatePct: required(s.annualRatePct),
    years: required(s.years),
    monthlyContribution: optional(s.monthlyContribution),
  };
}

export default function SavingsGoalCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const input = useMemo(() => toInput(values), [values]);
  const outcome = useMemo(() => calculateSavingsGoal(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;
  const timeMode = input.mode === "time";

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Your goal</legend>
        <Select
          id="sg-mode"
          label="What do you want to find?"
          value={values.mode}
          onChange={(e) => setValue("mode", e.target.value)}
          options={[
            { value: "contribution", label: "How much to save each month" },
            { value: "time", label: "How long it will take" },
          ]}
        />
        <CurrencyInput
          id="sg-target"
          label="Savings goal"
          value={values.target}
          onChange={(v) => setValue("target", v)}
          error={errors.target}
        />
        <CurrencyInput
          id="sg-current"
          label="Already saved"
          value={values.current}
          onChange={(v) => setValue("current", v)}
          error={errors.current}
        />
        <PercentInput
          id="sg-rate"
          label="Annual interest rate"
          value={values.annualRatePct}
          onChange={(v) => setValue("annualRatePct", v)}
          hint="Compounded monthly."
          error={errors.annualRatePct}
        />
        {timeMode ? (
          <CurrencyInput
            id="sg-monthly"
            label="Monthly saving"
            value={values.monthlyContribution}
            onChange={(v) => setValue("monthlyContribution", v)}
            error={errors.monthlyContribution}
          />
        ) : (
          <NumericInput
            id="sg-years"
            label="Time to reach the goal"
            suffix="yrs"
            grouping={false}
            value={values.years}
            onChange={(v) => setValue("years", v)}
            error={errors.years}
          />
        )}
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
    if (r.months === null) {
      results = (
        <Card role="status" className="flex flex-col gap-2">
          <p className="text-lg font-semibold">This goal is out of reach at this pace</p>
          <p className="text-muted">
            At {formatCurrency(r.monthlyContribution)} a month and this interest rate, you would not
            reach {formatCurrency(input.target, { decimals: 0 })} within {MAX_GOAL_MONTHS / 12}{" "}
            years. Try saving more each month or lowering the goal.
          </p>
        </Card>
      );
    } else {
      const secondary: SecondaryResult[] = [];
      if (timeMode) {
        secondary.push({ label: "Monthly saving", value: formatCurrency(r.monthlyContribution) });
      } else {
        secondary.push({ label: "Time to goal", value: formatDuration(r.months) });
      }
      secondary.push(
        {
          label: "Total you deposit",
          value: formatCurrency(r.totalDeposited),
          note: "Including what you already have",
        },
        { label: "Interest earned", value: formatCurrency(r.interestEarned) },
        { label: "Balance at the end", value: formatCurrency(r.finalBalance) },
      );

      const chartData = [
        { year: 0, balance: Math.round(input.current), goal: Math.round(input.target) },
        ...r.schedule.map((y) => ({
          year: y.year,
          balance: Math.round(y.balance),
          goal: Math.round(input.target),
        })),
      ];

      const primary = timeMode
        ? {
            label: "Time to reach your goal",
            value: r.alreadyThere ? "Already there" : formatDuration(r.months),
            note: r.alreadyThere
              ? "Your savings already meet the goal"
              : `Saving ${formatCurrency(r.monthlyContribution)} a month`,
          }
        : {
            label: "Monthly saving needed",
            value: formatCurrency(r.monthlyContribution),
            note: r.alreadyThere
              ? "Your current savings will grow to the goal on their own"
              : `To reach ${formatCurrency(input.target, { decimals: 0 })} in ${formatDuration(r.months)}`,
          };

      results = (
        <>
          <ResultCard {...primary} secondary={secondary} />
          {r.schedule.length > 0 && (
            <>
              <ChartSection
                title="Progress toward your goal"
                summary={`Savings grow from ${formatCurrency(input.current, { decimals: 0 })} to ${formatCurrency(r.finalBalance, { decimals: 0 })}, reaching the ${formatCurrency(input.target, { decimals: 0 })} goal after ${formatDuration(r.months)}.`}
                data={chartData}
                xKey="year"
                xLabel="Year"
                series={[
                  { key: "balance", label: "Your savings", color: "var(--accent)" },
                  { key: "goal", label: "Goal", color: "var(--chart-2)" },
                ]}
              />
              <Card className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold">Year-by-year progress</h3>
                <Table caption="Savings goal year-by-year progress">
                  <thead>
                    <tr>
                      <Th>Year</Th>
                      <Th align="right">Total deposited</Th>
                      <Th align="right">Interest so far</Th>
                      <Th align="right">Balance</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.schedule.map((y) => (
                      <tr key={y.year}>
                        <Td>{y.year}</Td>
                        <Td align="right">{formatCurrency(y.totalDeposited)}</Td>
                        <Td align="right">{formatCurrency(y.interest)}</Td>
                        <Td align="right">{formatCurrency(y.balance)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </>
      );
    }
  }

  return <CalculatorShell title="Savings goal calculator" inputs={inputs} results={results} />;
}
