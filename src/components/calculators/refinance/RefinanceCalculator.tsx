"use client";

import { useMemo } from "react";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { ResultCard, type SecondaryResult } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Select } from "@/components/ui/Select";
import {
  calculateRefinance,
  type RefinanceInput,
  type RefinanceResult,
} from "@/lib/calculators/refinance";
import { formatCurrency, formatDuration } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  balance: 300_000 as number | null,
  currentRatePct: 7 as number | null,
  currentTerm: 25 as number | null,
  currentTermUnit: "years",
  newRatePct: 5.5 as number | null,
  newTerm: 25 as number | null,
  newTermUnit: "years",
  closingCosts: 4_500 as number | null,
  costsPaid: "cash",
  horizonYears: 7 as number | null,
};

type State = typeof DEFAULTS;

const unit = (v: string): "years" | "months" => (v === "months" ? "months" : "years");

function toInput(s: State): RefinanceInput {
  return {
    balance: required(s.balance),
    currentRatePct: required(s.currentRatePct),
    currentTerm: required(s.currentTerm),
    currentTermUnit: unit(s.currentTermUnit),
    newRatePct: required(s.newRatePct),
    newTerm: required(s.newTerm),
    newTermUnit: unit(s.newTermUnit),
    closingCosts: optional(s.closingCosts),
    rollCosts: s.costsPaid === "rolled",
    horizonYears: required(s.horizonYears),
  };
}

const UNIT_OPTIONS = [
  { value: "years", label: "Years" },
  { value: "months", label: "Months" },
];

/** "You save $1,200" / "You lose $1,200", so the sign is never the only signal. */
function savedOrLost(amount: number): string {
  return amount >= 0
    ? `Ahead by ${formatCurrency(amount, { decimals: 0 })}`
    : `Behind by ${formatCurrency(-amount, { decimals: 0 })}`;
}

function breakEvenNote(r: RefinanceResult): string {
  if (r.breakEvenMonth === null) {
    return r.monthlySavings > 0
      ? "The lower payment comes from a longer loan, so you pay more in total. Over the full terms you end up behind."
      : "On these numbers the new loan never overtakes your current one.";
  }
  if (r.lifetimeNet < 0) {
    return "You are ahead for a while, but the longer new term means you finish behind over the full loan.";
  }
  return "After this point the new loan has cost you less in total than keeping your current one.";
}

export default function RefinanceCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const outcome = useMemo(() => calculateRefinance(toInput(values)), [values]);
  const errors = outcome.ok ? {} : outcome.errors;

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Your current loan</legend>
        <CurrencyInput
          id="refi-balance"
          label="Balance you still owe"
          value={values.balance}
          onChange={(v) => setValue("balance", v)}
          hint="From your latest statement."
          error={errors.balance}
        />
        <PercentInput
          id="refi-current-rate"
          label="Current interest rate"
          value={values.currentRatePct}
          onChange={(v) => setValue("currentRatePct", v)}
          error={errors.currentRatePct}
        />
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <NumericInput
            id="refi-current-term"
            label="Time left on current loan"
            grouping={false}
            value={values.currentTerm}
            onChange={(v) => setValue("currentTerm", v)}
            error={errors.currentTerm}
          />
          <Select
            id="refi-current-term-unit"
            label="Unit"
            value={values.currentTermUnit}
            onChange={(e) => setValue("currentTermUnit", e.target.value)}
            options={UNIT_OPTIONS}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">The new loan</legend>
        <PercentInput
          id="refi-new-rate"
          label="New interest rate"
          value={values.newRatePct}
          onChange={(v) => setValue("newRatePct", v)}
          error={errors.newRatePct}
        />
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <NumericInput
            id="refi-new-term"
            label="New loan term"
            grouping={false}
            value={values.newTerm}
            onChange={(v) => setValue("newTerm", v)}
            error={errors.newTerm}
          />
          <Select
            id="refi-new-term-unit"
            label="Unit"
            value={values.newTermUnit}
            onChange={(e) => setValue("newTermUnit", e.target.value)}
            options={UNIT_OPTIONS}
          />
        </div>
        <CurrencyInput
          id="refi-costs"
          label="Closing costs"
          value={values.closingCosts}
          onChange={(v) => setValue("closingCosts", v)}
          hint="Lender fees, appraisal, title and similar. Optional."
          error={errors.closingCosts}
        />
        <Select
          id="refi-costs-paid"
          label="How are the costs paid?"
          value={values.costsPaid}
          onChange={(e) => setValue("costsPaid", e.target.value)}
          options={[
            { value: "cash", label: "In cash at closing" },
            { value: "rolled", label: "Added to the new loan" },
          ]}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Your plans</legend>
        <NumericInput
          id="refi-horizon"
          label="Years you expect to keep the new loan"
          grouping={false}
          suffix="years"
          value={values.horizonYears}
          onChange={(v) => setValue("horizonYears", v)}
          hint="Used for the 'if you stay' figure. Selling or refinancing again ends the benefit."
          error={errors.horizonYears}
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
    const saving = r.monthlySavings >= 0;
    const secondary: SecondaryResult[] = [
      {
        label: "Current payment",
        value: formatCurrency(r.currentPayment),
        note: "Principal and interest",
      },
      { label: "New payment", value: formatCurrency(r.newPayment), note: "Principal and interest" },
      {
        label: saving ? "Monthly saving" : "Monthly increase",
        value: formatCurrency(Math.abs(r.monthlySavings)),
      },
      { label: "New loan amount", value: formatCurrency(r.newLoanAmount, { decimals: 0 }) },
      { label: "Cash due at closing", value: formatCurrency(r.upfrontCosts, { decimals: 0 }) },
    ];
    if (r.simpleBreakEvenMonths !== null) {
      secondary.push({
        label: "Quick estimate (costs ÷ monthly saving)",
        value: `about ${Math.max(1, Math.round(r.simpleBreakEvenMonths))} ${Math.round(r.simpleBreakEvenMonths) === 1 ? "month" : "months"}`,
        note: "How lenders usually quote it. Looks only at the payment, not the balance you still owe.",
      });
    }
    secondary.push(
      {
        label: `If you keep it ${values.horizonYears ?? ""} years`,
        value: savedOrLost(r.netAtHorizon),
        note: "Payments plus what you still owe",
      },
      {
        label: "Over the full terms",
        value: savedOrLost(r.lifetimeNet),
        note: "Both loans run to the end",
      },
      {
        label: "Interest left on current loan",
        value: formatCurrency(r.currentInterestRemaining, { decimals: 0 }),
      },
      { label: "Interest on new loan", value: formatCurrency(r.newInterestTotal, { decimals: 0 }) },
    );

    const chartData = r.series.map((p) => ({ year: p.year, net: Math.round(p.net) }));
    const lowest = Math.min(...r.series.map((p) => p.net));
    const highest = Math.max(...r.series.map((p) => p.net));

    results = (
      <>
        <ResultCard
          label="Break-even point"
          value={r.breakEvenMonth === null ? "No break-even" : formatDuration(r.breakEvenMonth)}
          note={breakEvenNote(r)}
          secondary={secondary}
        />
        <ChartSection
          title="Refinancing vs keeping your loan"
          summary={`Net benefit of refinancing starts at ${formatCurrency(r.series[0]?.net ?? 0, { decimals: 0 })} at closing, ranges from ${formatCurrency(lowest, { decimals: 0 })} to ${formatCurrency(highest, { decimals: 0 })}, and ends at ${formatCurrency(r.lifetimeNet, { decimals: 0 })} when both loans are paid off.`}
          data={chartData}
          xKey="year"
          xLabel="Years from closing"
          series={[{ key: "net", label: "Net benefit of refinancing", color: "var(--accent)" }]}
        />
      </>
    );
  }

  return <CalculatorShell title="Refinance calculator" inputs={inputs} results={results} />;
}
