// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentShareUrl } from "@/lib/share-store";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = { price: 400_000 as number | null, rate: 6.5 as number | null, mode: "amount" };

function setUrl(url: string) {
  window.history.replaceState(null, "", url);
}

beforeEach(() => setUrl("/calc"));
afterEach(cleanup);

describe("useCalculatorState", () => {
  it("starts with the defaults", () => {
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    expect(result.current.values).toEqual(DEFAULTS);
  });

  it("applies the values of a shared link after mount, then cleans the address", () => {
    setUrl("/calc?price=500000&mode=percent");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    expect(result.current.values).toEqual({ price: 500_000, rate: 6.5, mode: "percent" });
    expect(window.location.pathname + window.location.search).toBe("/calc");
  });

  it("keeps unrelated parameters and the fragment when cleaning the address", () => {
    setUrl("/calc?price=500000&utm_source=newsletter#results");
    renderHook(() => useCalculatorState(DEFAULTS));
    expect(window.location.search).toBe("?utm_source=newsletter");
    expect(window.location.hash).toBe("#results");
  });

  it("validates and clamps values from a link", () => {
    setUrl("/calc?price=1e30&rate=abc&mode=%3Cb%3E");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    expect(result.current.values).toEqual({ price: 1_000_000_000_000, rate: 6.5, mode: "amount" });
  });

  it("renders only once on a plain visit (no wasted second render)", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useCalculatorState(DEFAULTS);
    });
    expect(renders).toBe(1);
  });

  it("does not touch the address on a plain visit, even with unrelated parameters", () => {
    setUrl("/calc?utm_source=newsletter");
    const spy = vi.spyOn(window.history, "replaceState");
    renderHook(() => useCalculatorState(DEFAULTS));
    expect(spy).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?utm_source=newsletter");
    spy.mockRestore();
  });

  it("never writes typed values to the address", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    act(() => result.current.setValue("rate", 7.25));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.values.rate).toBe(7.25);
    expect(spy).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    spy.mockRestore();
    vi.useRealTimers();
  });

  it("offers a share link with the current inputs, and only those that were changed", () => {
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    expect(currentShareUrl()).toBe(`${window.location.origin}/calc`);
    act(() => result.current.setValue("rate", 7.25));
    act(() => result.current.setValue("price", null));
    expect(currentShareUrl()).toBe(`${window.location.origin}/calc?price=&rate=7.25`);
  });

  it("round-trips: a copied link restores the same inputs", () => {
    const first = renderHook(() => useCalculatorState(DEFAULTS));
    act(() => first.result.current.setValue("mode", "percent"));
    act(() => first.result.current.setValue("price", 123_456));
    const link = new URL(currentShareUrl());
    first.unmount();
    setUrl(link.pathname + link.search);
    const second = renderHook(() => useCalculatorState(DEFAULTS));
    expect(second.result.current.values).toEqual({ price: 123_456, rate: 6.5, mode: "percent" });
  });

  it("reset returns to the defaults", () => {
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    act(() => result.current.setValue("rate", 9));
    act(() => result.current.reset());
    expect(result.current.values).toEqual(DEFAULTS);
  });
});
