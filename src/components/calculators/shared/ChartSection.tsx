"use client";

import dynamic from "next/dynamic";
import type { LineChartProps } from "@/components/charts/LineChart";

const placeholder = () => (
  <div
    aria-hidden="true"
    className="rounded-control bg-surface-muted h-full w-full animate-pulse"
  />
);

const LineChart = dynamic(() => import("@/components/charts/LineChart"), {
  ssr: false,
  loading: placeholder,
});
const StackedBarChart = dynamic(() => import("@/components/charts/StackedBarChart"), {
  ssr: false,
  loading: placeholder,
});

type Props = Omit<LineChartProps, "height"> & {
  title: string;
  /** Short text alternative; the data is also available in a table. */
  summary: string;
  kind?: "line" | "stackedBar";
  height?: number;
};

/** Lazy-loads Recharts and reserves the chart's height up front so nothing shifts when it loads. */
export function ChartSection({ title, summary, kind = "line", height = 320, ...chart }: Props) {
  const Chart = kind === "stackedBar" ? StackedBarChart : LineChart;
  return (
    <figure className="rounded-card border-border bg-surface border p-4">
      <figcaption className="mb-3 font-semibold">{title}</figcaption>
      <div role="img" aria-label={summary} style={{ height }}>
        <Chart {...chart} height={height} />
      </div>
    </figure>
  );
}
