"use client";

import { useMemo } from "react";
import { AmortizationTable } from "@/components/calculators/shared/AmortizationTable";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { PaymentStartFields } from "@/components/calculators/shared/PaymentStartFields";
import { ResultCard } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Select } from "@/components/ui/Select";
import type { ScheduleRow } from "@/lib/calculators/amortization";
import { calculateCreditCard, type CreditCardInput } from "@/lib/calculators/credit-card";
import { paymentDate } from "@/lib/calculators/mortgage";
import { monthlyChartData } from "@/lib/chart-data";
import { formatCurrency, formatDuration, formatMonthYear } from "@/lib/format";
import { optional, required, validMonth, validYear } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  mode: "payment",
  balance: 5_000 as number | null,
  aprPct: 20 as number | null,
  monthlyPayment: 200 as number | null,
  targetMonths: 24 as number | null,
  startMonth: 11 as number | null,
  startYear: 2026 as number | null,
};

type State = typeof DEFAULTS;

function toInput(s: State): CreditCardInput {
  return {
    mode: s.mode === "target" ? "target" : "payment",
    balance: required(s.balance),
    aprPct: required(s.aprPct),
    monthlyPayment: optional(s.monthlyPayment),
    targetMonths: required(s.targetMonths),
  };
}

export default function CreditCardCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const input = useMemo(() => toInput(values), [values]);
  const outcome = useMemo(() => calculateCreditCard(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;
  const firstMonth = validMonth(values.startMonth);
  const firstYear = validYear(values.startYear, 2026);
  const targetMode = input.mode === "target";

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Your card</legend>
        <Select
          id="cc-mode"
          label="What do you want to know?"
          value={values.mode}
          onChange={(e) => setValue("mode", e.target.value)}
          options={[
            { value: "payment", label: "How long it takes at my monthly payment" },
            { value: "target", label: "What to pay to be debt-free by a date" },
          ]}
        />
        <CurrencyInput
          id="cc-balance"
          label="Current balance"
          value={values.balance}
          onChange={(v) => setValue("balance", v)}
          error={errors.balance}
        />
        <PercentInput
          id="cc-apr"
          label="APR"
          value={values.aprPct}
          onChange={(v) => setValue("aprPct", v)}
          hint="Interest is charged monthly at APR ÷ 12."
          error={errors.aprPct}
        />
        {targetMode ? (
          <NumericInput
            id="cc-target"
            label="Pay it off within"
            suffix="mo"
            grouping={false}
            value={values.targetMonths}
            onChange={(v) => setValue("targetMonths", v)}
            error={errors.targetMonths}
          />
        ) : (
          <CurrencyInput
            id="cc-payment"
            label="Monthly payment"
            value={values.monthlyPayment}
            onChange={(v) => setValue("monthlyPayment", v)}
            error={errors.monthlyPayment}
          />
        )}
        <PaymentStartFields
          idPrefix="cc"
          month={firstMonth}
          year={values.startYear}
          onMonthChange={(m) => setValue("startMonth", m)}
          onYearChange={(y) => setValue("startYear", y)}
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
    if (r.neverPaysOff || r.months === null) {
      const minimum = Math.ceil((r.firstMonthInterest + 0.01) * 100) / 100;
      results = (
        <Card role="alert" className="border-danger flex flex-col gap-2">
          <p className="text-danger text-lg font-semibold">
            This payment will not pay off the card
          </p>
          <p>
            Interest on this balance is about {formatCurrency(r.firstMonthInterest)} a month, and
            your payment of {formatCurrency(r.monthlyPayment)} does not cover it enough to clear the
            debt within 100 years. The balance would just keep growing or barely shrink.
          </p>
          <p className="text-muted">
            Pay more than {formatCurrency(r.firstMonthInterest)} a month, and ideally a good deal
            more. Even {formatCurrency(minimum)} would only just begin to reduce the balance.
          </p>
        </Card>
      );
    } else {
      const last = paymentDate(firstMonth, firstYear, r.months);
      const rows: ScheduleRow[] = r.schedule.map((row) => ({
        month: row.month,
        openingBalance: row.balance + row.principal,
        payment: row.payment,
        principal: row.principal,
        interest: row.interest,
        extra: 0,
        balance: row.balance,
      }));
      const chartData = monthlyChartData({
        balance: [input.balance, ...r.schedule.map((row) => row.balance)],
        interest: [0, ...r.schedule.map((row) => row.cumulativeInterest)],
      });

      const primary = targetMode
        ? {
            label: "Monthly payment needed",
            value: formatCurrency(r.monthlyPayment),
            note: `To pay off ${formatCurrency(input.balance, { decimals: 0 })} in ${formatDuration(r.months)}`,
          }
        : {
            label: "Time to pay off",
            value: formatDuration(r.months),
            note: `Paying ${formatCurrency(r.monthlyPayment)} a month`,
          };

      results = (
        <>
          <ResultCard
            {...primary}
            secondary={[
              ...(targetMode
                ? []
                : [{ label: "Monthly payment", value: formatCurrency(r.monthlyPayment) }]),
              ...(targetMode
                ? [{ label: "Time to pay off", value: formatDuration(r.months) }]
                : []),
              { label: "Total interest", value: formatCurrency(r.totalInterest) },
              { label: "Total you will pay", value: formatCurrency(r.totalPaid) },
              { label: "Interest in the first month", value: formatCurrency(r.firstMonthInterest) },
              { label: "Debt-free by", value: formatMonthYear(last.month, last.year) },
            ]}
          />
          <ChartSection
            title="Balance and interest over time"
            summary={`The balance falls from ${formatCurrency(input.balance, { decimals: 0 })} to zero over ${formatDuration(r.months)} and you pay ${formatCurrency(r.totalInterest, { decimals: 0 })} in interest.`}
            data={chartData}
            xKey="month"
            xLabel="Month"
            series={[
              { key: "balance", label: "Remaining balance", color: "var(--accent)" },
              { key: "interest", label: "Interest paid so far", color: "var(--chart-2)" },
            ]}
          />
          <AmortizationTable schedule={rows} firstMonth={firstMonth} firstYear={firstYear} />
        </>
      );
    }
  }

  return (
    <CalculatorShell title="Credit card payoff calculator" inputs={inputs} results={results} />
  );
}
