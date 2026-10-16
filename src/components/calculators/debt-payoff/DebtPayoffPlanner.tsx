"use client";

import { useMemo } from "react";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { ChartSection } from "@/components/calculators/shared/ChartSection";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Input } from "@/components/ui/Input";
import { PercentInput } from "@/components/ui/PercentInput";
import {
  calculateDebtPlan,
  MAX_DEBTS,
  type Debt,
  type StrategyResult,
} from "@/lib/calculators/debt-payoff";
import { monthlyChartData } from "@/lib/chart-data";
import { formatCurrency, formatDuration } from "@/lib/format";
import { optional, required } from "@/lib/inputs";
import type { StateValue } from "@/lib/url-state";
import { useCalculatorState } from "@/lib/use-calculator-state";

const SLOTS = MAX_DEBTS;

const SAMPLE = [
  { name: "Credit card", balance: 4_500, apr: 24.9, min: 120 },
  { name: "Car loan", balance: 9_000, apr: 7.5, min: 260 },
  { name: "Store card", balance: 800, apr: 19.9, min: 35 },
];

function buildDefaults(): Record<string, StateValue> {
  const d: Record<string, StateValue> = { count: SAMPLE.length, extra: 150 };
  for (let i = 0; i < SLOTS; i++) {
    const s = SAMPLE[i];
    d[`n${i}`] = s?.name ?? `Debt ${i + 1}`;
    d[`b${i}`] = s?.balance ?? null;
    d[`a${i}`] = s?.apr ?? null;
    d[`m${i}`] = s?.min ?? null;
  }
  return d;
}

const DEFAULTS = buildDefaults();
type State = typeof DEFAULTS;

function toDebts(s: State): Debt[] {
  const count = Math.min(SLOTS, Math.max(0, Math.round(Number(s.count) || 0)));
  return Array.from({ length: count }, (_, i) => ({
    name: String(s[`n${i}`] || `Debt ${i + 1}`),
    balance: required(s[`b${i}`] as number | null),
    aprPct: required(s[`a${i}`] as number | null),
    minPayment: required(s[`m${i}`] as number | null),
  }));
}

function StrategyCard({
  title,
  blurb,
  result,
  best,
}: {
  title: string;
  blurb: string;
  result: StrategyResult;
  best: boolean;
}) {
  return (
    <Card className={best ? "border-accent flex flex-col gap-3 border-2" : "flex flex-col gap-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {best && (
          <span className="rounded-control bg-accent-soft text-foreground px-2 py-0.5 text-xs font-semibold">
            Lowest interest
          </span>
        )}
      </div>
      <p className="text-muted text-sm">{blurb}</p>
      {result.months === null ? (
        <p className="text-danger font-medium">Not paid off within 100 years at this budget.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted text-sm">Debt-free in</dt>
              <dd className="text-xl font-bold tabular-nums">{formatDuration(result.months)}</dd>
            </div>
            <div>
              <dt className="text-muted text-sm">Total interest</dt>
              <dd className="text-xl font-bold tabular-nums">
                {formatCurrency(result.totalInterest)}
              </dd>
            </div>
          </dl>
          <div>
            <p className="text-muted mb-1 text-sm">Payoff order</p>
            <ol className="list-decimal space-y-0.5 pl-5">
              {result.payoffOrder.map((p) => (
                <li key={p.name}>
                  {p.name} <span className="text-muted">(month {p.month})</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </Card>
  );
}

export default function DebtPayoffPlanner() {
  const { values, setValue, setValues, reset } = useCalculatorState<State>(DEFAULTS);
  const count = Math.min(SLOTS, Math.max(1, Math.round(Number(values.count) || 1)));
  const input = useMemo(
    () => ({ debts: toDebts(values), extraMonthly: optional(values.extra as number | null) }),
    [values],
  );
  const outcome = useMemo(() => calculateDebtPlan(input), [input]);
  const errors = outcome.ok ? null : outcome.errors;

  const inputs = (
    <>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">Monthly budget</legend>
        <CurrencyInput
          id="dp-extra"
          label="Extra payment each month"
          value={values.extra as number | null}
          onChange={(v) => setValue("extra", v)}
          hint="On top of all the minimum payments."
          error={errors?.extraMonthly}
        />
      </fieldset>

      {Array.from({ length: count }, (_, i) => {
        const e = errors?.debtFields?.[i];
        return (
          <fieldset key={i} className="border-border rounded-card flex flex-col gap-3 border p-4">
            <legend className="px-1 text-base font-semibold">Debt {i + 1}</legend>
            <Input
              id={`dp-name-${i}`}
              label="Name"
              value={String(values[`n${i}`] ?? "")}
              onChange={(ev) => setValue(`n${i}`, ev.target.value)}
              maxLength={40}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <CurrencyInput
                id={`dp-balance-${i}`}
                label="Balance"
                value={values[`b${i}`] as number | null}
                onChange={(v) => setValue(`b${i}`, v)}
                error={e?.balance}
              />
              <PercentInput
                id={`dp-apr-${i}`}
                label="APR"
                value={values[`a${i}`] as number | null}
                onChange={(v) => setValue(`a${i}`, v)}
                error={e?.aprPct}
              />
              <CurrencyInput
                id={`dp-min-${i}`}
                label="Minimum payment"
                value={values[`m${i}`] as number | null}
                onChange={(v) => setValue(`m${i}`, v)}
                error={e?.minPayment}
              />
            </div>
          </fieldset>
        );
      })}

      {errors?.debts && (
        <p role="alert" className="text-danger text-sm font-medium">
          {errors.debts}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={count >= SLOTS}
          onClick={() => setValue("count", count + 1)}
        >
          Add a debt
        </Button>
        <Button
          variant="secondary"
          disabled={count <= 1}
          onClick={() => setValues({ ...values, count: count - 1 })}
        >
          Remove last debt
        </Button>
        <Button variant="ghost" onClick={reset}>
          Reset to example
        </Button>
      </div>
    </>
  );

  let results;
  if (!outcome.ok) {
    results = (
      <InvalidNotice>Check the highlighted fields to compare your payoff plans.</InvalidNotice>
    );
  } else {
    const r = outcome.result;
    const bestInterest = Math.min(
      ...[r.snowball, r.avalanche].filter((s) => s.months !== null).map((s) => s.totalInterest),
    );
    const chartData = monthlyChartData({
      snowball: r.snowball.balanceByMonth,
      avalanche: r.avalanche.balanceByMonth,
      minimum: r.minimumOnly.balanceByMonth,
    });

    const sameInterest = Math.abs(r.avalancheAdvantage) < 0.005;

    results = (
      <>
        <Card className="flex flex-col gap-2" aria-live="polite">
          <p className="text-muted text-sm font-medium">Total debt</p>
          <p className="text-4xl font-bold tabular-nums">{formatCurrency(r.totalBalance)}</p>
          <p className="text-muted text-sm">
            Minimums add up to {formatCurrency(r.totalMinimum)} a month. With your extra{" "}
            {formatCurrency(input.extraMonthly)} you will put{" "}
            {formatCurrency(r.totalMinimum + input.extraMonthly)} toward debt each month.
          </p>
          {r.avalanche.months !== null && r.snowball.months !== null && (
            <p className="font-medium">
              {sameInterest
                ? "Both methods cost the same interest for these debts."
                : `The avalanche method saves ${formatCurrency(r.avalancheAdvantage)} in interest compared with the snowball method.`}
            </p>
          )}
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <StrategyCard
            title="Debt snowball"
            blurb="Pay the smallest balance first for quick wins."
            result={r.snowball}
            best={r.snowball.months !== null && r.snowball.totalInterest <= bestInterest + 0.005}
          />
          <StrategyCard
            title="Debt avalanche"
            blurb="Pay the highest interest rate first to pay the least interest."
            result={r.avalanche}
            best={r.avalanche.months !== null && r.avalanche.totalInterest <= bestInterest + 0.005}
          />
        </div>

        <Card className="flex flex-col gap-1">
          <h3 className="font-semibold">If you only paid the minimums</h3>
          {r.minimumOnly.months === null ? (
            <p className="text-danger">
              At least one minimum payment is too low to cover its interest, so that debt would
              never be paid off.
            </p>
          ) : (
            <p className="text-muted">
              You would be debt-free in {formatDuration(r.minimumOnly.months)} and pay{" "}
              {formatCurrency(r.minimumOnly.totalInterest)} in interest.
              {r.avalanche.months !== null &&
                ` The avalanche plan saves ${formatCurrency(r.minimumOnly.totalInterest - r.avalanche.totalInterest)} and ${formatDuration(r.minimumOnly.months - r.avalanche.months)}.`}
            </p>
          )}
        </Card>

        <ChartSection
          title="Total debt remaining"
          summary={`Total debt of ${formatCurrency(r.totalBalance, { decimals: 0 })} falls to zero fastest with the snowball and avalanche plans compared with paying only the minimums.`}
          data={chartData}
          xKey="month"
          xLabel="Month"
          series={[
            { key: "avalanche", label: "Avalanche", color: "var(--accent)" },
            { key: "snowball", label: "Snowball", color: "var(--chart-3)" },
            { key: "minimum", label: "Minimums only", color: "var(--chart-2)" },
          ]}
        />
      </>
    );
  }

  return <CalculatorShell title="Debt payoff planner" inputs={inputs} results={results} />;
}
