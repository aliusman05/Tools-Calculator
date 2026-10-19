"use client";

import { useMemo } from "react";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { ResultCard, type SecondaryResult } from "@/components/calculators/shared/ResultCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { Select } from "@/components/ui/Select";
import { Table, Td, Th } from "@/components/ui/Table";
import { FILING_STATUS_LABELS, type FilingStatus } from "@/lib/calculators/income-tax";
import {
  calculateTakeHome,
  CURRENT_PAYROLL_YEAR,
  PAY_FREQUENCY_LABELS,
  PERIODS_PER_YEAR,
  type AgeGroup,
  type PayFrequency,
  type TakeHomeInput,
} from "@/lib/calculators/take-home-pay";
import { formatCurrency, formatPercent } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = {
  annualGross: 75_000 as number | null,
  frequency: "biweekly",
  status: "single",
  retirementPct: 5 as number | null,
  ageGroup: "under50",
  preTaxBenefitsPerPaycheck: 150 as number | null,
  afterTaxDeductionsPerPaycheck: 0 as number | null,
};

type State = typeof DEFAULTS;

const frequencyOf = (v: string): PayFrequency =>
  v in PERIODS_PER_YEAR ? (v as PayFrequency) : "biweekly";
const statusOf = (v: string): FilingStatus =>
  v === "mfj" || v === "hoh" || v === "mfs" ? v : "single";
const ageGroupOf = (v: string): AgeGroup => (v === "50plus" || v === "60to63" ? v : "under50");

function toInput(s: State): TakeHomeInput {
  return {
    annualGross: required(s.annualGross),
    frequency: frequencyOf(s.frequency),
    status: statusOf(s.status),
    retirementPct: optional(s.retirementPct),
    ageGroup: ageGroupOf(s.ageGroup),
    preTaxBenefitsPerPaycheck: optional(s.preTaxBenefitsPerPaycheck),
    afterTaxDeductionsPerPaycheck: optional(s.afterTaxDeductionsPerPaycheck),
  };
}

export default function TakeHomePayCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const outcome = useMemo(() => calculateTakeHome(toInput(values)), [values]);
  const errors = outcome.ok ? {} : outcome.errors;
  const frequency = frequencyOf(values.frequency);

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Your pay</legend>
        <CurrencyInput
          id="thp-gross"
          label="Yearly pay before anything is taken out"
          value={values.annualGross}
          onChange={(v) => setValue("annualGross", v)}
          hint="Your salary, as a yearly figure."
          error={errors.annualGross}
        />
        <Select
          id="thp-frequency"
          label="How often you are paid"
          value={values.frequency}
          onChange={(e) => setValue("frequency", e.target.value)}
          options={Object.entries(PAY_FREQUENCY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          error={errors.frequency}
        />
        <Select
          id="thp-status"
          label="Tax filing status"
          value={values.status}
          onChange={(e) => setValue("status", e.target.value)}
          options={Object.entries(FILING_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          error={errors.status}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Taken out before tax</legend>
        <PercentInput
          id="thp-401k"
          label="Traditional 401(k) contribution"
          value={values.retirementPct}
          onChange={(v) => setValue("retirementPct", v)}
          hint="Percent of your pay. Lowers income tax, not Social Security or Medicare tax."
          error={errors.retirementPct}
        />
        <Select
          id="thp-age"
          label="Age, for the 401(k) limit"
          value={values.ageGroup}
          onChange={(e) => setValue("ageGroup", e.target.value)}
          options={[
            { value: "under50", label: "Under 50" },
            { value: "50plus", label: "50 to 59, or 64 and older" },
            { value: "60to63", label: "60 to 63" },
          ]}
          error={errors.ageGroup}
        />
        <CurrencyInput
          id="thp-benefits"
          label="Health insurance, HSA and FSA per paycheck"
          value={values.preTaxBenefitsPerPaycheck}
          onChange={(v) => setValue("preTaxBenefitsPerPaycheck", v)}
          hint="Taken through your employer's payroll before tax. Lowers income tax and payroll tax."
          error={errors.preTaxBenefitsPerPaycheck}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Taken out after tax</legend>
        <CurrencyInput
          id="thp-after-tax"
          label="Roth 401(k), union dues and similar per paycheck"
          value={values.afterTaxDeductionsPerPaycheck}
          onChange={(v) => setValue("afterTaxDeductionsPerPaycheck", v)}
          hint="Lowers your take-home pay but not your taxes."
          error={errors.afterTaxDeductionsPerPaycheck}
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
    const money = (n: number) => formatCurrency(n);
    const share = (annual: number) => formatPercent(annual / r.gross.annual, { decimals: 1 });

    const secondary: SecondaryResult[] = [
      { label: "Take-home pay per year", value: money(r.takeHome.annual) },
      { label: "Gross pay per paycheck", value: money(r.gross.perPaycheck) },
      {
        label: "Taxes per paycheck",
        value: money(r.totalTaxes.perPaycheck),
        note: `${formatPercent(r.totalTaxRatePct / 100, { decimals: 1 })} of your pay`,
      },
      {
        label: "Federal income tax rate on your next dollar",
        value: `${r.marginalIncomeTaxRatePct}%`,
        note: "The bracket your top dollars fall in",
      },
    ];
    const stop = r.socialSecurityStopsAtPaycheck;
    if (stop !== null) {
      const range = (from: number, to: number) =>
        from === to ? `Paycheck ${from}` : `Paychecks ${from} to ${to}`;
      secondary.push({
        label: "Social Security tax stops in",
        value: `Paycheck ${stop}`,
        note: `Your pay passes the ${formatCurrency(CURRENT_PAYROLL_YEAR.socialSecurity.wageBase, { decimals: 0 })} yearly limit`,
      });
      if (r.earlyPaycheckTakeHome !== null) {
        secondary.push({
          label: range(1, stop - 1),
          value: money(r.earlyPaycheckTakeHome),
          note: "With Social Security tax taken out",
        });
      }
      if (r.latePaycheckTakeHome !== null) {
        secondary.push({
          label: range(stop + 1, r.periods),
          value: money(r.latePaycheckTakeHome),
          note: "No more Social Security tax this year",
        });
      }
    }
    const medicareTimingApplies =
      stop !== null &&
      r.payrollTaxWages > CURRENT_PAYROLL_YEAR.medicare.additional.employerWithholdingStart;

    const rows: Array<{
      label: string;
      amount: { annual: number; perPaycheck: number };
      sign: -1 | 1;
    }> = [
      { label: "Gross pay", amount: r.gross, sign: 1 },
      { label: "Health insurance, HSA and FSA", amount: r.preTaxBenefits, sign: -1 },
      { label: "Traditional 401(k)", amount: r.retirement, sign: -1 },
      { label: "Federal income tax", amount: r.federalIncomeTax, sign: -1 },
      { label: "Social Security tax", amount: r.socialSecurity, sign: -1 },
      { label: "Medicare tax", amount: r.medicare, sign: -1 },
      { label: "Additional Medicare tax", amount: r.additionalMedicare, sign: -1 },
      { label: "After-tax deductions", amount: r.afterTaxDeductions, sign: -1 },
    ];
    const shown = rows.filter((row) => row.label === "Gross pay" || row.amount.annual > 0);

    results = (
      <>
        <ResultCard
          label={
            stop !== null
              ? `Average take-home pay per paycheck over the year, ${PAY_FREQUENCY_LABELS[frequency].toLowerCase()}`
              : `Estimated take-home pay, ${PAY_FREQUENCY_LABELS[frequency].toLowerCase()}`
          }
          value={money(r.takeHome.perPaycheck)}
          note={
            stop !== null
              ? `Tax year ${r.year}. About ${formatPercent(r.takeHomePct / 100, { decimals: 1 })} of your pay. Paychecks are not all equal: Social Security tax stops partway through the year, so early ones are smaller and later ones larger (see below).`
              : `Tax year ${r.year}. About ${formatPercent(r.takeHomePct / 100, { decimals: 1 })} of your pay, over ${r.periods} paychecks a year`
          }
          secondary={secondary}
        />

        {medicareTimingApplies && (
          <p className="text-muted text-sm" role="note">
            Paychecks after Social Security tax stops may be a little smaller than shown. Employers
            also begin withholding the 0.9% Additional Medicare tax once your pay for the year
            passes{" "}
            {formatCurrency(CURRENT_PAYROLL_YEAR.medicare.additional.employerWithholdingStart, {
              decimals: 0,
            })}
            , and this calculator spreads that tax evenly over the year.
          </p>
        )}

        <Card className="text-muted flex flex-col gap-2 text-sm" role="note">
          <p className="text-foreground font-semibold">An estimate, not your paycheck</p>
          <p>
            Your real paycheck depends on how you filled in your Form W-4 and how your employer
            withholds tax. This calculator works out the {r.year} federal tax for a single salary
            and spreads it evenly over the year. It does not include state or local taxes, tax
            credits, a second job or other income.
          </p>
        </Card>

        <Table caption="Where your pay goes">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th align="right">{stop !== null ? "Average per paycheck" : "Per paycheck"}</Th>
              <Th align="right">Per year</Th>
              <Th align="right">Share of pay</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="border-border border-t px-4 py-2.5 text-left font-medium"
                >
                  {row.label}
                </th>
                <Td align="right">
                  {row.sign < 0 ? "−" : ""}
                  {money(row.amount.perPaycheck)}
                </Td>
                <Td align="right">
                  {row.sign < 0 ? "−" : ""}
                  {money(row.amount.annual)}
                </Td>
                <Td align="right">{share(row.amount.annual)}</Td>
              </tr>
            ))}
            <tr>
              <th
                scope="row"
                className="border-border border-t px-4 py-2.5 text-left font-semibold"
              >
                Take-home pay
              </th>
              <Td align="right">
                <strong>{money(r.takeHome.perPaycheck)}</strong>
              </Td>
              <Td align="right">
                <strong>{money(r.takeHome.annual)}</strong>
              </Td>
              <Td align="right">{share(r.takeHome.annual)}</Td>
            </tr>
          </tbody>
        </Table>

        {r.retirementCapped && (
          <p className="text-muted text-sm" role="note">
            That percent would be more than the yearly 401(k) limit of{" "}
            {formatCurrency(r.retirementLimit, { decimals: 0 })}, so it was reduced to the limit.
          </p>
        )}
      </>
    );
  }

  return <CalculatorShell title="Take-home pay calculator" inputs={inputs} results={results} />;
}
