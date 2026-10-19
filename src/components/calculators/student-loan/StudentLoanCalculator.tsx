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
import { paymentDate } from "@/lib/calculators/mortgage";
import { calculateStudentLoan, type StudentLoanInput } from "@/lib/calculators/student-loan";
import { formatCurrency, formatDuration, formatMonthYear } from "@/lib/format";
import { optional, required, validMonth, validYear } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  balance: 35_000 as number | null,
  annualRatePct: 5.5 as number | null,
  term: 10 as number | null,
  termUnit: "years",
  extraMonthly: 0 as number | null,
  lumpSum: 0 as number | null,
  lumpSumMonth: 12 as number | null,
  startMonth: 11 as number | null,
  startYear: 2026 as number | null,
};

type State = typeof DEFAULTS;

function toInput(s: State): StudentLoanInput {
  return {
    balance: required(s.balance),
    annualRatePct: required(s.annualRatePct),
    term: required(s.term),
    termUnit: s.termUnit === "months" ? "months" : "years",
    extraMonthly: optional(s.extraMonthly),
    lumpSum: optional(s.lumpSum),
    // An empty month box only matters when there is a lump sum, and then validation reports it.
    lumpSumMonth: required(s.lumpSumMonth),
  };
}

export default function StudentLoanCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const outcome = useMemo(() => calculateStudentLoan(toInput(values)), [values]);
  const errors = outcome.ok ? {} : outcome.errors;
  const firstMonth = validMonth(values.startMonth);
  const firstYear = validYear(values.startYear, 2026);

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Your loan</legend>
        <CurrencyInput
          id="sl-balance"
          label="Balance to repay"
          value={values.balance}
          onChange={(v) => setValue("balance", v)}
          hint="Include interest that has already been added. See the notes on this page."
          error={errors.balance}
        />
        <PercentInput
          id="sl-rate"
          label="Interest rate"
          value={values.annualRatePct}
          onChange={(v) => setValue("annualRatePct", v)}
          hint="If you have several loans, run each one separately."
          error={errors.annualRatePct}
        />
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <NumericInput
            id="sl-term"
            label="Repayment term"
            grouping={false}
            value={values.term}
            onChange={(v) => setValue("term", v)}
            error={errors.term}
          />
          <Select
            id="sl-term-unit"
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
          idPrefix="sl"
          month={firstMonth}
          year={values.startYear}
          onMonthChange={(m) => setValue("startMonth", m)}
          onYearChange={(y) => setValue("startYear", y)}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Pay it off faster</legend>
        <CurrencyInput
          id="sl-extra"
          label="Extra every month"
          value={values.extraMonthly}
          onChange={(v) => setValue("extraMonthly", v)}
          hint="Optional. Applied to principal each month."
          error={errors.extraMonthly}
        />
        <CurrencyInput
          id="sl-lump"
          label="One-time lump sum"
          value={values.lumpSum}
          onChange={(v) => setValue("lumpSum", v)}
          hint="Optional. A bonus, tax refund or gift."
          error={errors.lumpSum}
        />
        <NumericInput
          id="sl-lump-month"
          label="Paid with payment number"
          grouping={false}
          value={values.lumpSumMonth}
          onChange={(v) => setValue("lumpSumMonth", v)}
          hint="1 is your first payment, 12 is the twelfth."
          error={errors.lumpSumMonth}
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
    const hasExtras = optional(values.extraMonthly) > 0 || optional(values.lumpSum) > 0;
    const last = paymentDate(firstMonth, firstYear, r.months);
    const baselineLast = paymentDate(firstMonth, firstYear, r.baseline.months);
    const extraMonthly = optional(values.extraMonthly);

    const secondary: SecondaryResult[] = [
      { label: "Total interest", value: formatCurrency(r.totalInterest) },
      {
        label: "Total of payments",
        value: formatCurrency(r.totalPaid),
        note: "Principal + interest",
      },
      { label: "Payoff date", value: formatMonthYear(last.month, last.year) },
      { label: "Time to pay off", value: formatDuration(r.months) },
    ];
    if (hasExtras) {
      secondary.push(
        {
          label: "Interest saved",
          value: formatCurrency(r.interestSaved),
          note: `Without extras: ${formatCurrency(r.baseline.totalInterest)}`,
        },
        {
          label: "Time saved",
          value: formatDuration(r.monthsSaved),
          note: `Without extras: ${formatMonthYear(baselineLast.month, baselineLast.year)}`,
        },
      );
    }

    const amount = r.schedule[0]?.openingBalance ?? 0;
    const chartData = balanceSeries(amount, r.schedule).map((p) => ({
      year: p.year,
      balance: Math.round(p.balance),
      interest: Math.round(p.cumulativeInterest),
    }));

    let note = `${r.termMonths} scheduled payments, principal and interest`;
    if (extraMonthly > 0) {
      note = `Scheduled payment. With your extra, you pay ${formatCurrency(r.monthlyPayment + extraMonthly)} a month.`;
    }

    results = (
      <>
        <ResultCard
          label="Monthly payment"
          value={formatCurrency(r.monthlyPayment)}
          note={note}
          secondary={secondary}
        >
          {optional(values.lumpSum) > 0 && !r.lumpSumApplied && (
            <p className="text-muted text-sm" role="note">
              Your lump sum is scheduled after the loan would already be paid off, so it has no
              effect. Choose an earlier payment number.
            </p>
          )}
        </ResultCard>
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

  return (
    <CalculatorShell title="Student loan payoff calculator" inputs={inputs} results={results} />
  );
}
