"use client";

import { useMemo } from "react";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { ResultCard } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import { Table, Td, Th } from "@/components/ui/Table";
import {
  calculateIncomeTax,
  CURRENT_TAX_YEAR,
  FILING_STATUS_LABELS,
  maxAgeBlindCount,
  type FilingStatus,
  type IncomeTaxInput,
} from "@/lib/calculators/income-tax";
import { formatCurrency, formatPercent } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  status: "single",
  grossIncome: 85_000 as number | null,
  adjustments: 0 as number | null,
  deductionType: "standard",
  itemized: 0 as number | null,
  ageBlind: 0 as number | null,
  credits: 0 as number | null,
  withheld: 0 as number | null,
};

type State = typeof DEFAULTS;

const STATUSES = Object.keys(FILING_STATUS_LABELS) as FilingStatus[];

function toInput(s: State): IncomeTaxInput {
  const status = STATUSES.find((x) => x === s.status) ?? "single";
  return {
    status,
    grossIncome: required(s.grossIncome),
    adjustments: optional(s.adjustments),
    deductionType: s.deductionType === "itemized" ? "itemized" : "standard",
    itemizedDeductions: optional(s.itemized),
    age65OrBlindCount: optional(s.ageBlind),
    credits: optional(s.credits),
    withheld: optional(s.withheld),
  };
}

const money0 = (v: number) => formatCurrency(v, { decimals: 0 });

export default function IncomeTaxCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const input = useMemo(() => toInput(values), [values]);
  const outcome = useMemo(() => calculateIncomeTax(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;
  const maxCount = maxAgeBlindCount(input.status);
  const data = CURRENT_TAX_YEAR;

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Income</legend>
        <Select
          id="tax-status"
          label="Filing status"
          value={input.status}
          onChange={(e) => setValue("status", e.target.value)}
          options={STATUSES.map((s) => ({ value: s, label: FILING_STATUS_LABELS[s] }))}
        />
        <CurrencyInput
          id="tax-income"
          label="Total income for the year"
          value={values.grossIncome}
          onChange={(v) => setValue("grossIncome", v)}
          hint="Wages and other ordinary income."
          error={errors.grossIncome}
        />
        <CurrencyInput
          id="tax-adjustments"
          label="Pre-tax contributions & adjustments"
          value={values.adjustments}
          onChange={(v) => setValue("adjustments", v)}
          hint="For example traditional 401(k), IRA or HSA contributions."
          error={errors.adjustments}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Deductions &amp; credits</legend>
        <Select
          id="tax-deduction-type"
          label="Deduction"
          value={values.deductionType}
          onChange={(e) => setValue("deductionType", e.target.value)}
          options={[
            {
              value: "standard",
              label: `Standard deduction (${money0(data.standardDeduction[input.status])})`,
            },
            { value: "itemized", label: "Itemized deductions" },
          ]}
        />
        {input.deductionType === "itemized" ? (
          <CurrencyInput
            id="tax-itemized"
            label="Total itemized deductions"
            value={values.itemized}
            onChange={(v) => setValue("itemized", v)}
            error={errors.itemizedDeductions}
          />
        ) : (
          <Select
            id="tax-age-blind"
            label="People who are 65 or older or blind"
            value={String(Math.min(Number(values.ageBlind) || 0, maxCount))}
            onChange={(e) => setValue("ageBlind", Number(e.target.value))}
            hint="Adds to the standard deduction."
            options={Array.from({ length: maxCount + 1 }, (_, i) => ({
              value: String(i),
              label: String(i),
            }))}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <CurrencyInput
            id="tax-credits"
            label="Tax credits"
            value={values.credits}
            onChange={(v) => setValue("credits", v)}
            hint="Reduces your tax, not below zero."
            error={errors.credits}
          />
          <CurrencyInput
            id="tax-withheld"
            label="Tax already withheld"
            value={values.withheld}
            onChange={(v) => setValue("withheld", v)}
            hint="Optional. Shows a refund or amount owed."
            error={errors.withheld}
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
    const secondary = [
      { label: "Taxable income", value: money0(r.taxableIncome) },
      {
        label: r.deductionKind === "standard" ? "Standard deduction" : "Itemized deductions",
        value: money0(r.deduction),
      },
      {
        label: "Marginal tax rate",
        value: `${r.marginalRatePct}%`,
        note: "Rate on your next dollar",
      },
      {
        label: "Effective tax rate",
        value: formatPercent(r.effectiveRatePct / 100),
        note: "Tax ÷ total income",
      },
    ];
    if (r.creditsApplied > 0)
      secondary.push({ label: "Credits applied", value: formatCurrency(r.creditsApplied) });
    if (input.withheld > 0) {
      secondary.push({
        label: r.refundOrOwed >= 0 ? "Estimated refund" : "Estimated amount owed",
        value: formatCurrency(Math.abs(r.refundOrOwed)),
      });
    }

    results = (
      <>
        <ResultCard
          label={`Estimated ${r.year} federal income tax`}
          value={formatCurrency(r.totalTax)}
          note={`${FILING_STATUS_LABELS[input.status]} · ordinary income only`}
          secondary={secondary}
        />
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">How your tax is built up</h2>
          <Table caption="Federal income tax by bracket">
            <thead>
              <tr>
                <Th>Rate</Th>
                <Th>Bracket</Th>
                <Th align="right">Your income in bracket</Th>
                <Th align="right">Tax</Th>
              </tr>
            </thead>
            <tbody>
              {r.breakdown.map((line) => (
                <tr key={line.rate} className={line.amount === 0 ? "text-muted" : undefined}>
                  <Td>{line.rate}%</Td>
                  <Td>
                    {money0(line.from)} – {line.to === null ? "and up" : money0(line.to)}
                  </Td>
                  <Td align="right">{money0(line.amount)}</Td>
                  <Td align="right">{formatCurrency(line.tax)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card role="note" className="text-muted flex flex-col gap-1 text-sm">
          <p className="text-foreground font-semibold">This is an estimate, not tax advice</p>
          <p>
            It uses the {data.year} federal brackets and deductions from {data.source.name} and
            covers ordinary income only. It leaves out payroll taxes, state and local taxes, capital
            gains rates, self-employment tax, the QBI deduction, AMT and income-based phase-outs.
            Your actual tax depends on your full return.
          </p>
        </Card>
      </>
    );
  }

  return <CalculatorShell title="Income tax estimator" inputs={inputs} results={results} />;
}
