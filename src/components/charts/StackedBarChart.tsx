"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { LineChartProps } from "./LineChart";

const compact = (v: number) => formatCurrency(v, { decimals: 0 }).replace(/,\d{3}$/, "k");

/** Stacked bar chart with the same props as LineChart. Loaded lazily through ChartSection. */
export default function StackedBarChart({ data, xKey, xLabel, series, height }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          stroke="var(--border)"
          label={{
            value: xLabel,
            position: "insideBottom",
            offset: -2,
            fill: "var(--muted)",
            fontSize: 12,
          }}
          height={36}
        />
        <YAxis
          tickFormatter={(v: number) =>
            v >= 1000 ? compact(v) : formatCurrency(v, { decimals: 0 })
          }
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          stroke="var(--border)"
          width={64}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value), { decimals: 0 })}
          labelFormatter={(label) => `${xLabel} ${label}`}
          cursor={{ fill: "var(--surface-muted)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="total"
            fill={s.color}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
