"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export type ChartSeries = { key: string; label: string; color: string };

export type LineChartProps = {
  data: Array<Record<string, number>>;
  xKey: string;
  xLabel: string;
  series: ChartSeries[];
  height: number;
};

const compact = (v: number) => formatCurrency(v, { decimals: 0 }).replace(/,\d{3}$/, "k");

/** Recharts line chart. Loaded lazily through ChartSection; do not import this directly in pages. */
export default function LineChart({ data, xKey, xLabel, series, height }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
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
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
