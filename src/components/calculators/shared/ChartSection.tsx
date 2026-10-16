"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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

/**
 * Lazy-loads Recharts and reserves the chart's height up front so nothing shifts when it loads.
 *
 * The chart library (the single biggest piece of JavaScript on a calculator page) is not even
 * requested until the chart is within ~200px of the viewport. On a phone the chart sits below the
 * fold, so it costs nothing during the initial load, which keeps the page responsive while it is
 * hydrating.
 */
export function ChartSection({ title, summary, kind = "line", height = 320, ...chart }: Props) {
  const Chart = kind === "stackedBar" ? StackedBarChart : LineChart;
  const box = useRef<HTMLDivElement>(null);
  // Always start false so the server and the first client render match.
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      // Very old browser: no way to tell when the chart is near, so load it on the next frame.
      const frame = requestAnimationFrame(() => setNear(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  return (
    <figure className="rounded-card border-border bg-surface border p-4">
      <figcaption className="mb-3 font-semibold">{title}</figcaption>
      <div ref={box} role="img" aria-label={summary} style={{ height }}>
        {near ? <Chart {...chart} height={height} /> : placeholder()}
      </div>
    </figure>
  );
}
