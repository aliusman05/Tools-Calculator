"use client";

import { useMemo } from "react";
import { AmortizationTable } from "@/components/calculators/shared/AmortizationTable";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { PaymentStartFields } from "@/components/calculators/shared/PaymentStartFields";
import { ResultCard, type SecondaryResult } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Select } from "@/components/ui/Select";
import { balanceSeries } from "@/lib/calculators/amortization";
import { calculateLoan, type LoanInput } from "@/lib/calculators/loan";
import { paymentDate } from "@/lib/calculators/mortgage";
import { formatCurrency, formatDuration, formatMonthYear } from "@/lib/format";
import { optional, required, validMonth, validYear } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  amount: 25_000 as number | null,
  annualRatePct: 6.9 as number | null,
  term: 5 as number | null,
  termUnit: "years",
  extraMonthly: 0 as number | null,
  startMonth: 11 as number | null,
  startYear: 2026 as number | null,
};

type State = typeof DEFAULTS;

function toInput(s: State): LoanInput {
  return {
    amount: required(s.amount),
    annualRatePct: required(s.annualRatePct),
    term: required(s.term),
    termUnit: s.termUnit === "months" ? "months" : "years",
    extraMonthly: optional(s.extraMonthly),
  };
}

export default function LoanCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const outcome = useMemo(() => calculateLoan(toInput(values)), [values]);
  const errors = outcome.ok ? {} : outcome.errors;
  const firstMonth = validMonth(values.startMonth);
  const firstYear = validYear(values.startYear, 2026);

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Loan details</legend>
        <CurrencyInput
          id="loan-amount"
          label="Loan amount"
          value={values.amount}
          onChange={(v) => setValue("amount", v)}
          error={errors.amount}
        />
        <PercentInput
          id="loan-rate"
          label="Interest rate (APR)"
          value={values.annualRatePct}
          onChange={(v) => setValue("annualRatePct", v)}
          error={errors.annualRatePct}
        />
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <NumericInput
            id="loan-term"
            label="Loan term"
            grouping={false}
            value={values.term}
            onChange={(v) => setValue("term", v)}
            error={errors.term}
          />
          <Select
            id="loan-term-unit"
            label="Unit"
            value={values.termUnit}
            onChange={(e) => setValue("termUnit", e.target.value)}
            options={[
              { value: "years", label: "Years" },
              { value: "months", label: "Months" },
            ]}
          />
        </div>
        <PaymentStartFields
          idPrefix="loan"
          month={firstMonth}
          year={values.startYear}
          onMonthChange={(m) => setValue("startMonth", m)}
          onYearChange={(y) => setValue("startYear", y)}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Extra payments</legend>
        <CurrencyInput
          id="loan-extra"
          label="Extra every month"
          value={values.extraMonthly}
          onChange={(v) => setValue("extraMonthly", v)}
          hint="Optional. Goes straight to principal."
          error={errors.extraMonthly}
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
    const last = paymentDate(firstMonth, firstYear, r.months);
    const secondary: SecondaryResult[] = [
      { label: "Loan amount", value: formatCurrency(r.schedule[0]?.openingBalance ?? 0) },
      { label: "Total interest", value: formatCurrency(r.totalInterest) },
      {
        label: "Total of payments",
        value: formatCurrency(r.totalPaid),
        note: "Principal + interest",
      },
      { label: "Payoff date", value: formatMonthYear(last.month, last.year) },
      { label: "Time to pay off", value: formatDuration(r.months) },
    ];
    if (r.monthsSaved > 0) {
      secondary.push(
        {
          label: "Interest saved",
          value: formatCurrency(r.interestSaved),
          note: "From extra payments",
        },
        { label: "Time saved", value: formatDuration(r.monthsSaved) },
      );
    }
    const amount = r.schedule[0]?.openingBalance ?? 0;
    const chartData = balanceSeries(amount, r.schedule).map((p) => ({
      year: p.year,
      balance: Math.round(p.balance),
      interest: Math.round(p.cumulativeInterest),
    }));

    results = (
      <>
        <ResultCard
          label="Monthly payment"
          value={formatCurrency(r.monthlyPayment)}
          note={
            r.monthsSaved > 0
              ? "Plus your extra payment each month"
              : `${r.termMonths} payments, principal and interest`
          }
          secondary={secondary}
        />
        <ChartSection
          title="Balance and interest over time"
          summary={`Remaining balance falls from ${formatCurrency(amount, { decimals: 0 })} to zero over ${formatDuration(r.months)} while cumulative interest reaches ${formatCurrency(r.totalInterest, { decimals: 0 })}.`}
          data={chartData}
          xKey="year"
          xLabel="Year"
          series={[
            { key: "balance", label: "Remaining balance", color: "var(--accent)" },
            { key: "interest", label: "Interest paid so far", color: "var(--chart-2)" },
          ]}
        />
        <AmortizationTable schedule={r.schedule} firstMonth={firstMonth} firstYear={firstYear} />
      </>
    );
  }

  return <CalculatorShell title="Loan calculator" inputs={inputs} results={results} />;
}
