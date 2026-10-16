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
import { balanceSeries } from "@/lib/calculators/amortization";
import { calculateCarLoan, type CarLoanInput } from "@/lib/calculators/car-loan";
import { paymentDate } from "@/lib/calculators/mortgage";
import { formatCurrency, formatDuration, formatMonthYear } from "@/lib/format";
import { optional, required, validMonth, validYear } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  price: 32_000 as number | null,
  downPayment: 4_000 as number | null,
  tradeInValue: 3_000 as number | null,
  tradeInOwed: 0 as number | null,
  salesTaxPct: 7 as number | null,
  taxAfterTradeIn: "yes",
  fees: 500 as number | null,
  annualRatePct: 6.5 as number | null,
  termMonths: 60 as number | null,
  startMonth: 11 as number | null,
  startYear: 2026 as number | null,
};

type State = typeof DEFAULTS;

function toInput(s: State): CarLoanInput {
  return {
    price: required(s.price),
    downPayment: optional(s.downPayment),
    tradeInValue: optional(s.tradeInValue),
    tradeInOwed: optional(s.tradeInOwed),
    salesTaxPct: optional(s.salesTaxPct),
    taxAfterTradeIn: s.taxAfterTradeIn !== "no",
    fees: optional(s.fees),
    annualRatePct: required(s.annualRatePct),
    termMonths: required(s.termMonths),
  };
}

export default function CarLoanCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const outcome = useMemo(() => calculateCarLoan(toInput(values)), [values]);
  const errors = outcome.ok ? {} : outcome.errors;
  const firstMonth = validMonth(values.startMonth);
  const firstYear = validYear(values.startYear, 2026);

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">The car</legend>
        <CurrencyInput
          id="car-price"
          label="Vehicle price"
          value={values.price}
          onChange={(v) => setValue("price", v)}
          error={errors.price}
        />
        <CurrencyInput
          id="car-down"
          label="Down payment"
          value={values.downPayment}
          onChange={(v) => setValue("downPayment", v)}
          error={errors.downPayment}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CurrencyInput
            id="car-trade"
            label="Trade-in value"
            value={values.tradeInValue}
            onChange={(v) => setValue("tradeInValue", v)}
            error={errors.tradeInValue}
          />
          <CurrencyInput
            id="car-owed"
            label="Still owed on trade-in"
            value={values.tradeInOwed}
            onChange={(v) => setValue("tradeInOwed", v)}
            hint="Added to the new loan."
            error={errors.tradeInOwed}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Tax &amp; fees</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <PercentInput
            id="car-tax"
            label="Sales tax"
            value={values.salesTaxPct}
            onChange={(v) => setValue("salesTaxPct", v)}
            error={errors.salesTaxPct}
          />
          <CurrencyInput
            id="car-fees"
            label="Title, registration & fees"
            value={values.fees}
            onChange={(v) => setValue("fees", v)}
            error={errors.fees}
          />
        </div>
        <Select
          id="car-tax-rule"
          label="Is the trade-in subtracted before tax?"
          value={values.taxAfterTradeIn}
          onChange={(e) => setValue("taxAfterTradeIn", e.target.value)}
          options={[
            { value: "yes", label: "Yes, tax the price minus the trade-in" },
            { value: "no", label: "No, tax the full price" },
          ]}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Financing</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <PercentInput
            id="car-rate"
            label="Interest rate (APR)"
            value={values.annualRatePct}
            onChange={(v) => setValue("annualRatePct", v)}
            error={errors.annualRatePct}
          />
          <NumericInput
            id="car-term"
            label="Loan term"
            suffix="mo"
            grouping={false}
            value={values.termMonths}
            onChange={(v) => setValue("termMonths", v)}
            error={errors.termMonths}
          />
        </div>
        <PaymentStartFields
          idPrefix="car"
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
    const loan = r.loan;
    if (!loan) {
      results = (
        <ResultCard
          label="Monthly payment"
          value={formatCurrency(0)}
          note="Your down payment and trade-in cover the full cost, so nothing is financed."
          secondary={[
            { label: "Sales tax", value: formatCurrency(r.salesTax) },
            { label: "Out-the-door price", value: formatCurrency(r.outTheDoorPrice) },
          ]}
        />
      );
    } else {
      const last = paymentDate(firstMonth, firstYear, loan.months);
      const chartData = balanceSeries(r.amountFinanced, loan.schedule).map((p) => ({
        year: p.year,
        balance: Math.round(p.balance),
        interest: Math.round(p.cumulativeInterest),
      }));
      results = (
        <>
          <ResultCard
            label="Estimated monthly payment"
            value={formatCurrency(r.monthlyPayment)}
            note={`${loan.months} payments of principal and interest`}
            secondary={[
              { label: "Amount financed", value: formatCurrency(r.amountFinanced) },
              { label: "Sales tax", value: formatCurrency(r.salesTax) },
              {
                label: "Out-the-door price",
                value: formatCurrency(r.outTheDoorPrice),
                note: "Price + tax + fees",
              },
              { label: "Total interest", value: formatCurrency(r.totalInterest) },
              {
                label: "Total cost of the car",
                value: formatCurrency(r.totalCost),
                note: "Out-the-door + interest",
              },
              { label: "Final payment", value: formatMonthYear(last.month, last.year) },
              { label: "Loan length", value: formatDuration(loan.months) },
            ]}
          />
          {Number(values.tradeInOwed) > 0 && (
            <Card role="status">
              <p className="text-muted">
                {formatCurrency(Number(values.tradeInOwed))} owed on your trade-in is rolled into
                this loan, so you pay interest on it too.
              </p>
            </Card>
          )}
          <ChartSection
            title="Loan balance and interest over time"
            summary={`The loan balance falls from ${formatCurrency(r.amountFinanced, { decimals: 0 })} to zero over ${formatDuration(loan.months)} while total interest reaches ${formatCurrency(r.totalInterest, { decimals: 0 })}.`}
            data={chartData}
            xKey="year"
            xLabel="Year"
            series={[
              { key: "balance", label: "Remaining balance", color: "var(--accent)" },
              { key: "interest", label: "Interest paid so far", color: "var(--chart-2)" },
            ]}
          />
          <AmortizationTable
            schedule={loan.schedule}
            firstMonth={firstMonth}
            firstYear={firstYear}
          />
        </>
      );
    }
  }

  return <CalculatorShell title="Car loan calculator" inputs={inputs} results={results} />;
}
