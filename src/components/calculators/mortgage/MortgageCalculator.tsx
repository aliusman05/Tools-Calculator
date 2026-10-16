"use client";

import { useMemo } from "react";
import { AmortizationTable } from "@/components/calculators/shared/AmortizationTable";
import { PaymentStartFields } from "@/components/calculators/shared/PaymentStartFields";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { ResultCard, type SecondaryResult } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Select } from "@/components/ui/Select";
import { balanceSeries } from "@/lib/calculators/amortization";
import {
  calculateMortgage,
  downPaymentFromPercent,
  paymentDate,
  type MortgageErrors,
  type MortgageInput,
} from "@/lib/calculators/mortgage";
import { formatCurrency, formatDuration, formatMonthYear, formatNumber } from "@/lib/format";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  homePrice: 400_000 as number | null,
  downInput: 80_000 as number | null,
  downMode: "amount",
  annualRatePct: 6.5 as number | null,
  termYears: 30 as number | null,
  startMonth: 11 as number | null,
  startYear: 2026 as number | null,
  propertyTaxPct: 1.1 as number | null,
  insuranceAnnual: 1_500 as number | null,
  hoaMonthly: 0 as number | null,
  pmiRatePct: 0.5 as number | null,
  extraMonthly: 0 as number | null,
  extraYearly: 0 as number | null,
  oneTimeExtra: 0 as number | null,
  oneTimeMonth: 12 as number | null,
};

type State = typeof DEFAULTS;

const nan = (v: number | null) => (v === null ? Number.NaN : v);
const zero = (v: number | null) => v ?? 0;

function toMortgageInput(s: State): MortgageInput {
  const homePrice = nan(s.homePrice);
  const downPayment =
    s.downMode === "percent"
      ? downPaymentFromPercent(homePrice, nan(s.downInput))
      : nan(s.downInput);
  return {
    homePrice,
    downPayment,
    annualRatePct: nan(s.annualRatePct),
    termYears: nan(s.termYears),
    propertyTaxPct: zero(s.propertyTaxPct),
    insuranceAnnual: zero(s.insuranceAnnual),
    hoaMonthly: zero(s.hoaMonthly),
    pmiRatePct: zero(s.pmiRatePct),
    extraMonthly: zero(s.extraMonthly),
    extraYearly: zero(s.extraYearly),
    oneTimeExtra: zero(s.oneTimeExtra),
    oneTimeMonth: nan(s.oneTimeMonth),
  };
}

/** Map engine errors (keyed by engine field) onto the form's field names. */
function formErrors(e: MortgageErrors) {
  return { ...e, downInput: e.downPayment };
}

export default function MortgageCalculator() {
  const { values, setValue, setValues, reset } = useCalculatorState<State>(DEFAULTS);

  const input = useMemo(() => toMortgageInput(values), [values]);
  const outcome = useMemo(() => calculateMortgage(input), [input]);
  const errors: MortgageErrors & { downInput?: string } = outcome.ok
    ? {}
    : formErrors(outcome.errors);

  const firstMonth =
    values.startMonth && values.startMonth >= 1 && values.startMonth <= 12 ? values.startMonth : 1;
  const firstYear =
    values.startYear && values.startYear >= 1900 && values.startYear <= 2200
      ? values.startYear
      : 2026;

  function changeDownMode(mode: string) {
    if (mode === values.downMode) return;
    const price = values.homePrice;
    const current = values.downInput;
    let converted: number | null = current;
    if (price && price > 0 && current !== null) {
      converted =
        mode === "percent"
          ? Math.round((current / price) * 10_000) / 100
          : Math.round(downPaymentFromPercent(price, current));
    }
    setValues({ ...values, downMode: mode, downInput: converted });
  }

  const downHint = (() => {
    if (values.downInput === null || !values.homePrice) return undefined;
    return values.downMode === "percent"
      ? `= ${formatCurrency(downPaymentFromPercent(values.homePrice, values.downInput), { decimals: 0 })}`
      : `= ${formatNumber((values.downInput / values.homePrice) * 100, { decimals: 1 })}% of the price`;
  })();

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Loan details</legend>
        <CurrencyInput
          id="mortgage-price"
          label="Home price"
          value={values.homePrice}
          onChange={(v) => setValue("homePrice", v)}
          error={errors.homePrice}
        />
        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <NumericInput
            id="mortgage-down"
            label="Down payment"
            value={values.downInput}
            onChange={(v) => setValue("downInput", v)}
            prefix={values.downMode === "amount" ? "$" : undefined}
            suffix={values.downMode === "percent" ? "%" : undefined}
            grouping={values.downMode === "amount"}
            hint={downHint}
            error={errors.downInput}
          />
          <Select
            id="mortgage-down-mode"
            label="Type"
            value={values.downMode}
            onChange={(e) => changeDownMode(e.target.value)}
            options={[
              { value: "amount", label: "$" },
              { value: "percent", label: "%" },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PercentInput
            id="mortgage-rate"
            label="Interest rate (APR)"
            value={values.annualRatePct}
            onChange={(v) => setValue("annualRatePct", v)}
            error={errors.annualRatePct}
          />
          <NumericInput
            id="mortgage-term"
            label="Loan term"
            suffix="yrs"
            grouping={false}
            value={values.termYears}
            onChange={(v) => setValue("termYears", v)}
            error={errors.termYears}
          />
        </div>
        <PaymentStartFields
          idPrefix="mortgage"
          month={firstMonth}
          year={values.startYear}
          onMonthChange={(m) => setValue("startMonth", m)}
          onYearChange={(y) => setValue("startYear", y)}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Taxes, insurance &amp; fees</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <PercentInput
            id="mortgage-tax"
            label="Property tax (per year)"
            value={values.propertyTaxPct}
            onChange={(v) => setValue("propertyTaxPct", v)}
            error={errors.propertyTaxPct}
          />
          <CurrencyInput
            id="mortgage-insurance"
            label="Home insurance (per year)"
            value={values.insuranceAnnual}
            onChange={(v) => setValue("insuranceAnnual", v)}
            error={errors.insuranceAnnual}
          />
          <CurrencyInput
            id="mortgage-hoa"
            label="HOA dues (per month)"
            value={values.hoaMonthly}
            onChange={(v) => setValue("hoaMonthly", v)}
            error={errors.hoaMonthly}
          />
          <PercentInput
            id="mortgage-pmi"
            label="PMI rate (per year)"
            value={values.pmiRatePct}
            onChange={(v) => setValue("pmiRatePct", v)}
            hint="Applies while you owe more than 80% of the price."
            error={errors.pmiRatePct}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Extra payments</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CurrencyInput
            id="mortgage-extra-monthly"
            label="Extra every month"
            value={values.extraMonthly}
            onChange={(v) => setValue("extraMonthly", v)}
            error={errors.extraMonthly}
          />
          <CurrencyInput
            id="mortgage-extra-yearly"
            label="Extra once a year"
            value={values.extraYearly}
            onChange={(v) => setValue("extraYearly", v)}
            hint="Paid with every 12th payment."
            error={errors.extraYearly}
          />
          <CurrencyInput
            id="mortgage-extra-once"
            label="One-time extra payment"
            value={values.oneTimeExtra}
            onChange={(v) => setValue("oneTimeExtra", v)}
            error={errors.oneTimeExtra}
          />
          <NumericInput
            id="mortgage-extra-once-month"
            label="One-time payment number"
            grouping={false}
            value={values.oneTimeMonth}
            onChange={(v) => setValue("oneTimeMonth", v)}
            hint="Which payment it is added to (1 = first)."
            error={errors.oneTimeMonth}
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
    results = (
      <Card role="alert" className="text-danger font-medium">
        Check the highlighted fields to see your payment.
      </Card>
    );
  } else {
    const r = outcome.result;
    const last = paymentDate(firstMonth, firstYear, r.months);
    const hasEscrow = r.monthlyPropertyTax + r.monthlyInsurance + r.monthlyHoa + r.monthlyPmi > 0;

    const secondary: SecondaryResult[] = [
      { label: "Loan amount", value: formatCurrency(r.loanAmount) },
      { label: "Principal & interest", value: formatCurrency(r.monthlyPrincipalInterest) },
    ];
    if (r.monthlyPropertyTax > 0)
      secondary.push({ label: "Property tax", value: formatCurrency(r.monthlyPropertyTax) });
    if (r.monthlyInsurance > 0)
      secondary.push({ label: "Home insurance", value: formatCurrency(r.monthlyInsurance) });
    if (r.monthlyHoa > 0)
      secondary.push({ label: "HOA dues", value: formatCurrency(r.monthlyHoa) });
    if (r.monthlyPmi > 0 && r.pmiEndsAfterMonth !== null) {
      const ends = paymentDate(firstMonth, firstYear, r.pmiEndsAfterMonth);
      secondary.push({
        label: "PMI",
        value: formatCurrency(r.monthlyPmi),
        note: `Last charged ${formatMonthYear(ends.month, ends.year)}`,
      });
    }
    secondary.push(
      { label: "Total interest", value: formatCurrency(r.totalInterest) },
      {
        label: "Total of payments",
        value: formatCurrency(r.totalPaid),
        note: "Principal + interest",
      },
      { label: "Payoff date", value: formatMonthYear(last.month, last.year) },
      { label: "Time to pay off", value: formatDuration(r.months) },
    );
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

    const chartData = balanceSeries(r.loanAmount, r.schedule).map((p) => ({
      year: p.year,
      balance: Math.round(p.balance),
      interest: Math.round(p.cumulativeInterest),
    }));

    results = (
      <>
        <ResultCard
          label="Estimated monthly payment"
          value={formatCurrency(r.monthlyTotal)}
          note={hasEscrow ? "Includes taxes, insurance, HOA and PMI" : "Principal and interest"}
          secondary={secondary}
        />
        <ChartSection
          title="Balance and interest over time"
          summary={`Remaining balance falls from ${formatCurrency(r.loanAmount, { decimals: 0 })} to zero over ${formatDuration(r.months)} while cumulative interest reaches ${formatCurrency(r.totalInterest, { decimals: 0 })}.`}
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

  return <CalculatorShell title="Mortgage calculator" inputs={inputs} results={results} />;
}
