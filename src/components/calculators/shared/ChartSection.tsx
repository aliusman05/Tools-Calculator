"use client";

import dynamic from "next/dynamic";
import type { LineChartProps } from "@/components/charts/LineChart";

const Chart = dynamic(() => import("@/components/charts/LineChart"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="rounded-control bg-surface-muted h-full w-full animate-pulse"
    />
  ),
});

type Props = Omit<LineChartProps, "height"> & {
  title: string;
  /** Short text alternative; the data is also available in the schedule table. */
  summary: string;
  height?: number;
};

/** Lazy-loads Recharts and reserves the chart's height up front so nothing shifts when it loads. */
export function ChartSection({ title, summary, height = 320, ...chart }: Props) {
  return (
    <figure className="rounded-card border-border bg-surface border p-4">
      <figcaption className="mb-3 font-semibold">{title}</figcaption>
      <div role="img" aria-label={summary} style={{ height }}>
        <Chart {...chart} height={height} />
      </div>
    </figure>
  );
}
