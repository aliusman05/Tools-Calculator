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
import { Table, Td, Th } from "@/components/ui/Table";
import {
  calculateRentVsBuy,
  rentVsBuySensitivity,
  type RentVsBuyInput,
} from "@/lib/calculators/rent-vs-buy";
import { formatCurrency, formatDuration } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import { useCalculatorState } from "@/lib/use-calculator-state";

/**
 * Every figure below is an assumption, not a fact about your market. They are starting points to
 * replace with your own numbers.
 */
const DEFAULTS = {
  homePrice: 400_000 as number | null,
  downPaymentPct: 20 as number | null,
  mortgageRatePct: 6.5 as number | null,
  mortgageTermYears: 30 as number | null,
  buyingCostsPct: 3 as number | null,
  propertyTaxPct: 1.1 as number | null,
  homeInsuranceYearly: 1_500 as number | null,
  maintenancePct: 1 as number | null,
  otherMonthlyCosts: 0 as number | null,
  appreciationPct: 3 as number | null,
  sellingCostsPct: 6 as number | null,
  monthlyRent: 2_200 as number | null,
  rentGrowthPct: 3 as number | null,
  rentersInsuranceYearly: 240 as number | null,
  investmentReturnPct: 5 as number | null,
  costGrowthPct: 3 as number | null,
  years: 7 as number | null,
};

type State = typeof DEFAULTS;

function toInput(s: State): RentVsBuyInput {
  return {
    homePrice: required(s.homePrice),
    downPaymentPct: required(s.downPaymentPct),
    mortgageRatePct: required(s.mortgageRatePct),
    mortgageTermYears: required(s.mortgageTermYears),
    buyingCostsPct: optional(s.buyingCostsPct),
    propertyTaxPct: optional(s.propertyTaxPct),
    homeInsuranceYearly: optional(s.homeInsuranceYearly),
    maintenancePct: optional(s.maintenancePct),
    otherMonthlyCosts: optional(s.otherMonthlyCosts),
    appreciationPct: optional(s.appreciationPct),
    sellingCostsPct: optional(s.sellingCostsPct),
    monthlyRent: required(s.monthlyRent),
    rentGrowthPct: optional(s.rentGrowthPct),
    rentersInsuranceYearly: optional(s.rentersInsuranceYearly),
    investmentReturnPct: optional(s.investmentReturnPct),
    costGrowthPct: optional(s.costGrowthPct),
    years: required(s.years),
  };
}

const money0 = (n: number) => formatCurrency(n, { decimals: 0 });
const signed = (n: number) => (n >= 0 ? `Buying +${money0(n)}` : `Renting +${money0(-n)}`);
const pct = (n: number) => `${Number(n.toFixed(2))}%`;

export default function RentVsBuyCalculator() {
  const { values, setValue, reset } = useCalculatorState<State>(DEFAULTS);
  const input = useMemo(() => toInput(values), [values]);
  const outcome = useMemo(() => calculateRentVsBuy(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;
  const grid = useMemo(() => (outcome.ok ? rentVsBuySensitivity(input) : []), [outcome.ok, input]);

  const inputs = (
    <>
      <p className="text-muted text-sm">
        The numbers filled in are example assumptions, not facts about your area. Replace each one
        with your own. Anything you leave empty counts as zero.
      </p>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Buying</legend>
        <CurrencyInput
          id="rvb-price"
          label="Home price"
          value={values.homePrice}
          onChange={(v) => setValue("homePrice", v)}
          error={errors.homePrice}
        />
        <PercentInput
          id="rvb-down"
          label="Down payment"
          value={values.downPaymentPct}
          onChange={(v) => setValue("downPaymentPct", v)}
          hint="Percent of the price."
          error={errors.downPaymentPct}
        />
        <PercentInput
          id="rvb-rate"
          label="Mortgage rate"
          value={values.mortgageRatePct}
          onChange={(v) => setValue("mortgageRatePct", v)}
          error={errors.mortgageRatePct}
        />
        <NumericInput
          id="rvb-term"
          label="Mortgage term"
          grouping={false}
          suffix="years"
          value={values.mortgageTermYears}
          onChange={(v) => setValue("mortgageTermYears", v)}
          error={errors.mortgageTermYears}
        />
        <PercentInput
          id="rvb-buying-costs"
          label="Closing and buying costs"
          value={values.buyingCostsPct}
          onChange={(v) => setValue("buyingCostsPct", v)}
          hint="Percent of the price, paid in cash at closing."
          error={errors.buyingCostsPct}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Owning costs</legend>
        <PercentInput
          id="rvb-tax"
          label="Property tax"
          value={values.propertyTaxPct}
          onChange={(v) => setValue("propertyTaxPct", v)}
          hint="Percent of the home's value per year. Use your local rate."
          error={errors.propertyTaxPct}
        />
        <CurrencyInput
          id="rvb-insurance"
          label="Homeowners insurance per year"
          value={values.homeInsuranceYearly}
          onChange={(v) => setValue("homeInsuranceYearly", v)}
          error={errors.homeInsuranceYearly}
        />
        <PercentInput
          id="rvb-maintenance"
          label="Maintenance and repairs"
          value={values.maintenancePct}
          onChange={(v) => setValue("maintenancePct", v)}
          hint="Percent of the home's value per year."
          error={errors.maintenancePct}
        />
        <CurrencyInput
          id="rvb-other"
          label="HOA and other monthly costs"
          value={values.otherMonthlyCosts}
          onChange={(v) => setValue("otherMonthlyCosts", v)}
          hint="Include mortgage insurance if your down payment is small."
          error={errors.otherMonthlyCosts}
        />
        <PercentInput
          id="rvb-selling"
          label="Selling costs"
          value={values.sellingCostsPct}
          onChange={(v) => setValue("sellingCostsPct", v)}
          hint="Percent of the sale price, paid when you sell at the end."
          error={errors.sellingCostsPct}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Renting</legend>
        <CurrencyInput
          id="rvb-rent"
          label="Monthly rent"
          value={values.monthlyRent}
          onChange={(v) => setValue("monthlyRent", v)}
          error={errors.monthlyRent}
        />
        <PercentInput
          id="rvb-rent-growth"
          label="Rent increase per year"
          value={values.rentGrowthPct}
          onChange={(v) => setValue("rentGrowthPct", v)}
          error={errors.rentGrowthPct}
        />
        <CurrencyInput
          id="rvb-renters-insurance"
          label="Renters insurance per year"
          value={values.rentersInsuranceYearly}
          onChange={(v) => setValue("rentersInsuranceYearly", v)}
          error={errors.rentersInsuranceYearly}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Assumptions about the future</legend>
        <NumericInput
          id="rvb-years"
          label="How long you compare"
          grouping={false}
          suffix="years"
          value={values.years}
          onChange={(v) => setValue("years", v)}
          hint="You are assumed to sell at the end."
          error={errors.years}
        />
        <PercentInput
          id="rvb-appreciation"
          label="Home value change per year"
          value={values.appreciationPct}
          onChange={(v) => setValue("appreciationPct", v)}
          hint="Can be negative. Nobody knows this number; see the table of what-ifs."
          error={errors.appreciationPct}
        />
        <PercentInput
          id="rvb-invest"
          label="Investment return per year"
          value={values.investmentReturnPct}
          onChange={(v) => setValue("investmentReturnPct", v)}
          hint="What money you do not spend on housing would earn after fees. Not guaranteed."
          error={errors.investmentReturnPct}
        />
        <PercentInput
          id="rvb-cost-growth"
          label="Insurance and fixed costs rise per year"
          value={values.costGrowthPct}
          onChange={(v) => setValue("costGrowthPct", v)}
          error={errors.costGrowthPct}
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
    const years = input.years;
    const buyingAhead = r.advantage >= 0;
    const m = r.monthOne;

    const secondary: SecondaryResult[] = [
      {
        label: "Buying stays ahead from",
        value: r.breakEvenMonth === null ? "Not within 30 years" : formatDuration(r.breakEvenMonth),
        note: "Counting every month after it, not just the first time it is ahead",
      },
      {
        label: "Buyer's net worth",
        value: money0(r.buyerNetWorth),
        note: `After selling, in year ${years}`,
      },
      { label: "Renter's net worth", value: money0(r.renterNetWorth), note: "Invested savings" },
      {
        label: "Cash needed to buy",
        value: money0(r.cashAtClosing),
        note: "Down payment and buying costs",
      },
      {
        label: "Monthly cost of owning, year 1",
        value: formatCurrency(m.ownerTotal),
        note: `Mortgage ${formatCurrency(m.mortgage)}, tax ${formatCurrency(m.propertyTax)}, insurance ${formatCurrency(m.insurance)}, upkeep ${formatCurrency(m.maintenance)}${m.other > 0 ? `, other ${formatCurrency(m.other)}` : ""}`,
      },
      {
        label: "Monthly cost of renting, year 1",
        value: formatCurrency(m.renterTotal),
        note: `Rent ${formatCurrency(m.rent)}, renters insurance ${formatCurrency(m.rentersInsurance)}`,
      },
      {
        label: "Home value when sold",
        value: money0(r.homeValue),
        note: `Selling costs ${money0(r.sellingCosts)}`,
      },
      { label: "Loan left when sold", value: money0(r.loanBalance) },
    ];

    const chartData = r.series.map((p) => ({ year: p.year, advantage: Math.round(p.advantage) }));

    results = (
      <>
        <ResultCard
          label={`After ${years} ${years === 1 ? "year" : "years"}, ${buyingAhead ? "buying" : "renting"} comes out ahead by`}
          value={money0(Math.abs(r.advantage))}
          note="A difference in net worth. It depends on every assumption on the left."
          secondary={secondary}
        />

        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">How sensitive is this answer?</h2>
          <p className="text-muted text-sm">
            Home values and investment returns are the two things nobody can predict. This table
            shows who comes out ahead after {years} {years === 1 ? "year" : "years"} if each is 2
            points lower or higher than you entered. The middle cell is your result.
          </p>
          <Table caption="Net worth difference by home value change and investment return">
            <thead>
              <tr>
                <Th>Home value change</Th>
                {grid[0]?.map((c) => (
                  <Th key={c.investmentReturnPct} align="right">
                    Investments {pct(c.investmentReturnPct)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row) => (
                <tr key={row[0]?.appreciationPct}>
                  <th
                    scope="row"
                    className="border-border border-t px-4 py-2.5 text-left font-medium"
                  >
                    {pct(row[0]?.appreciationPct ?? 0)} a year
                  </th>
                  {row.map((c) => (
                    <Td key={c.investmentReturnPct} align="right">
                      {signed(c.advantage)}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <ChartSection
          title="Who is ahead as the years pass"
          summary={`The difference in net worth (buyer minus renter) starts at ${money0(r.series[0]?.advantage ?? 0)} on the day of purchase because of buying and selling costs, and is ${money0(r.advantage)} after ${years} years. Above zero means buying is ahead.`}
          data={chartData}
          xKey="year"
          xLabel="Years"
          series={[{ key: "advantage", label: "Buyer minus renter", color: "var(--accent)" }]}
        />

        <Card className="text-muted flex flex-col gap-2 text-sm" role="note">
          <p className="text-foreground font-semibold">What this leaves out</p>
          <p>
            Income tax effects (mortgage interest and property tax deductions, tax on a home sale,
            tax on investment gains), mortgage insurance, refinancing, moving costs, changes in your
            income or family, and the value many people place on owning or on flexibility. Rates and
            prices stay the same for the whole comparison.
          </p>
        </Card>
      </>
    );
  }

  return <CalculatorShell title="Rent vs buy calculator" inputs={inputs} results={results} />;
}
