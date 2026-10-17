// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartSection } from "@/components/calculators/shared/ChartSection";

// ChartSection declares two lazy charts at module level, the line chart first, then the stacked
// bar chart. Replace next/dynamic with plain components so we can tell them apart.
const dynamic = vi.hoisted(() => ({ calls: 0 }));
vi.mock("next/dynamic", () => ({
  default: () => {
    const kind = dynamic.calls++ === 0 ? "line" : "stackedBar";
    return function FakeChart(props: { height: number }) {
      return <div data-testid={`chart-${kind}`} data-height={props.height} />;
    };
  },
}));

type Entry = {
  cb: IntersectionObserverCallback;
  el?: Element;
  disconnected: boolean;
  options?: IntersectionObserverInit;
};
const observers: Entry[] = [];

class FakeObserver {
  entry: Entry;
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.entry = { cb, disconnected: false, options };
    observers.push(this.entry);
  }
  observe(el: Element) {
    this.entry.el = el;
  }
  disconnect() {
    this.entry.disconnected = true;
  }
  unobserve() {}
}

const props = {
  title: "Balance over time",
  summary: "The balance falls to zero.",
  data: [{ year: 0, balance: 100 }],
  xKey: "year",
  xLabel: "Year",
  series: [{ key: "balance", label: "Balance", color: "red" }],
};

function intersect(entry: Entry, isIntersecting: boolean) {
  act(() => {
    entry.cb(
      [{ isIntersecting, target: entry.el! } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChartSection", () => {
  it("is a captioned figure with a text alternative and a reserved height", () => {
    render(<ChartSection {...props} height={320} />);
    expect(screen.getByRole("figure")).toBeInTheDocument();
    expect(screen.getByText("Balance over time").tagName).toBe("FIGCAPTION");
    const img = screen.getByRole("img", { name: "The balance falls to zero." });
    expect(img).toHaveStyle({ height: "320px" });
  });

  it("defaults to 320px tall", () => {
    render(<ChartSection {...props} />);
    expect(screen.getByRole("img")).toHaveStyle({ height: "320px" });
  });

  it("shows only a placeholder until the chart is near the viewport", () => {
    render(<ChartSection {...props} />);
    expect(screen.queryByTestId("chart-line")).toBeNull();
    expect(screen.queryByTestId("chart-stackedBar")).toBeNull();
    expect(observers).toHaveLength(1);
    expect(observers[0]!.options?.rootMargin).toBe("200px 0px");
  });

  it("ignores intersection updates that are not intersecting", () => {
    render(<ChartSection {...props} />);
    intersect(observers[0]!, false);
    expect(screen.queryByTestId("chart-line")).toBeNull();
    expect(observers[0]!.disconnected).toBe(false);
  });

  it("loads the line chart once it is near, then stops observing", () => {
    render(<ChartSection {...props} height={300} />);
    intersect(observers[0]!, true);
    const chart = screen.getByTestId("chart-line");
    expect(chart).toHaveAttribute("data-height", "300");
    expect(observers[0]!.disconnected).toBe(true);
  });

  it("uses the stacked bar chart when asked", () => {
    render(<ChartSection {...props} kind="stackedBar" />);
    intersect(observers[0]!, true);
    expect(screen.getByTestId("chart-stackedBar")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-line")).toBeNull();
  });

  it("stops observing when unmounted before the chart was needed", () => {
    const { unmount } = render(<ChartSection {...props} />);
    unmount();
    expect(observers[0]!.disconnected).toBe(true);
  });

  it("falls back to loading on the next frame when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.useFakeTimers();
    render(<ChartSection {...props} />);
    expect(screen.queryByTestId("chart-line")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("chart-line")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("module setup", () => {
  it("declares exactly two lazy charts", () => {
    expect(dynamic.calls).toBe(2);
  });
});
