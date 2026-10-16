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
import { Table, Td, Th } from "@/components/ui/Table";
import { calculateRetirement, type RetirementInput } from "@/lib/calculators/retirement";
import { formatCurrency } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  currentAge: 35 as number | null,
  retirementAge: 65 as number | null,
  currentBalance: 50_000 as number | null,
  salary: 85_000 as number | null,
  contributionPct: 10 as number | null,
  matchPct: 50 as number | null,
  matchLimitPct: 6 as number | null,
  returnPct: 7 as number | null,
  salaryGrowthPct: 3 as number | null,
  inflationPct: 2.5 as number | null,
  withdrawalPct: 4 as number | null,
};

type State = typeof DEFAULTS;

function toInput(s: State): RetirementInput {
  return {
    currentAge: required(s.currentAge),
    retirementAge: required(s.retirementAge),
    currentBalance: optional(s.currentBalance),
    salary: optional(s.salary),
    contributionPct: optional(s.contributionPct),
    matchPct: optional(s.matchPct),
    matchLimitPct: optional(s.matchLimitPct),
    returnPct: required(s.returnPct),
    salaryGrowthPct: optional(s.salaryGrowthPct),
    inflationPct: optional(s.inflationPct),
    withdrawalPct: optional(s.withdrawalPct),
  };
}

const money0 = (v: number) => formatCurrency(v, { decimals: 0 });

export default function RetirementCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const input = useMemo(() => toInput(values), [values]);
  const outcome = useMemo(() => calculateRetirement(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">About you</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumericInput
            id="ret-age"
            label="Current age"
            grouping={false}
            value={values.currentAge}
            onChange={(v) => setValue("currentAge", v)}
            error={errors.currentAge}
          />
          <NumericInput
            id="ret-retire-age"
            label="Retirement age"
            grouping={false}
            value={values.retirementAge}
            onChange={(v) => setValue("retirementAge", v)}
            error={errors.retirementAge}
          />
        </div>
        <CurrencyInput
          id="ret-balance"
          label="Current retirement savings"
          value={values.currentBalance}
          onChange={(v) => setValue("currentBalance", v)}
          error={errors.currentBalance}
        />
        <CurrencyInput
          id="ret-salary"
          label="Annual salary"
          value={values.salary}
          onChange={(v) => setValue("salary", v)}
          error={errors.salary}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Contributions</legend>
        <PercentInput
          id="ret-contribution"
          label="Your contribution (% of salary)"
          value={values.contributionPct}
          onChange={(v) => setValue("contributionPct", v)}
          error={errors.contributionPct}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PercentInput
            id="ret-match"
            label="Employer match rate"
            value={values.matchPct}
            onChange={(v) => setValue("matchPct", v)}
            hint="50% = 50 cents per dollar you put in."
            error={errors.matchPct}
          />
          <PercentInput
            id="ret-match-limit"
            label="Match limit (% of salary)"
            value={values.matchLimitPct}
            onChange={(v) => setValue("matchLimitPct", v)}
            hint="The most of your pay the employer will match."
            error={errors.matchLimitPct}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Assumptions</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <PercentInput
            id="ret-return"
            label="Expected annual return"
            value={values.returnPct}
            onChange={(v) => setValue("returnPct", v)}
            error={errors.returnPct}
          />
          <PercentInput
            id="ret-growth"
            label="Annual salary growth"
            value={values.salaryGrowthPct}
            onChange={(v) => setValue("salaryGrowthPct", v)}
            error={errors.salaryGrowthPct}
          />
          <PercentInput
            id="ret-inflation"
            label="Inflation"
            value={values.inflationPct}
            onChange={(v) => setValue("inflationPct", v)}
            error={errors.inflationPct}
          />
          <PercentInput
            id="ret-withdrawal"
            label="Withdrawal rate"
            value={values.withdrawalPct}
            onChange={(v) => setValue("withdrawalPct", v)}
            hint="4% is the common rule-of-thumb illustration."
            error={errors.withdrawalPct}
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
    const chartData = [
      {
        age: input.currentAge,
        balance: Math.round(input.currentBalance),
        real: Math.round(input.currentBalance),
      },
      ...r.schedule.map((y) => ({
        age: y.age,
        balance: Math.round(y.balance),
        real: Math.round(y.realBalance),
      })),
    ];

    results = (
      <>
        <ResultCard
          label={`Projected balance at age ${input.retirementAge}`}
          value={formatCurrency(r.balanceAtRetirement, { decimals: 0 })}
          note={`About ${money0(r.realBalance)} in today's dollars`}
          secondary={[
            { label: "Your contributions", value: money0(r.employeeContributions) },
            { label: "Employer match", value: money0(r.employerContributions) },
            { label: "Investment growth", value: money0(r.growth) },
            { label: "Starting balance", value: money0(input.currentBalance) },
            {
              label: `Yearly income at ${input.withdrawalPct}% (today's dollars)`,
              value: money0(r.annualIncomeReal),
              note: "An illustration of the withdrawal-rate rule, not advice",
            },
            { label: "Monthly income (today's dollars)", value: money0(r.monthlyIncomeReal) },
          ]}
        />
        {!r.matchCaptured && (
          <Card role="status" className="border-accent">
            <p className="font-semibold">You may be missing part of your employer match</p>
            <p className="text-muted mt-1">
              Your employer matches up to {input.matchLimitPct}% of your salary. Contributing at
              least {input.matchLimitPct}% would capture all of it.
            </p>
          </Card>
        )}
        <ChartSection
          title="Projected savings by age"
          summary={`Savings grow from ${money0(input.currentBalance)} to ${money0(r.balanceAtRetirement)} by age ${input.retirementAge}, which is ${money0(r.realBalance)} in today's dollars.`}
          data={chartData}
          xKey="age"
          xLabel="Age"
          series={[
            { key: "balance", label: "Balance", color: "var(--accent)" },
            { key: "real", label: "In today's dollars", color: "var(--chart-2)" },
          ]}
        />
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Year-by-year projection</h3>
          <Table caption="Retirement savings year-by-year projection">
            <thead>
              <tr>
                <Th>Age</Th>
                <Th align="right">Salary</Th>
                <Th align="right">You</Th>
                <Th align="right">Employer</Th>
                <Th align="right">Growth</Th>
                <Th align="right">Balance</Th>
                <Th align="right">Today&apos;s dollars</Th>
              </tr>
            </thead>
            <tbody>
              {r.schedule.map((y) => (
                <tr key={y.age}>
                  <Td>{y.age}</Td>
                  <Td align="right">{money0(y.salary)}</Td>
                  <Td align="right">{money0(y.employee)}</Td>
                  <Td align="right">{money0(y.employer)}</Td>
                  <Td align="right">{money0(y.growth)}</Td>
                  <Td align="right">{money0(y.balance)}</Td>
                  <Td align="right">{money0(y.realBalance)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </>
    );
  }

  return <CalculatorShell title="Retirement calculator" inputs={inputs} results={results} />;
}
