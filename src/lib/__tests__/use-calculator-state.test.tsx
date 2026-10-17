// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalculatorState } from "@/lib/use-calculator-state";

const DEFAULTS = { price: 400_000 as number | null, rate: 6.5 as number | null, mode: "amount" };

function setUrl(url: string) {
  window.history.replaceState(null, "", url);
}

beforeEach(() => {
  vi.useFakeTimers();
  setUrl("/calc");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useCalculatorState", () => {
  it("starts with the defaults", () => {
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    expect(result.current.values).toEqual(DEFAULTS);
  });

  it("restores saved values from the address after mount", () => {
    setUrl("/calc?price=500000&mode=percent");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    expect(result.current.values).toEqual({ price: 500_000, rate: 6.5, mode: "percent" });
  });

  it("renders only once on a plain visit (no wasted second render)", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useCalculatorState(DEFAULTS);
    });
    expect(renders).toBe(1);
  });

  it("leaves the address alone on a plain visit, even with unrelated parameters", () => {
    setUrl("/calc?utm_source=newsletter");
    renderHook(() => useCalculatorState(DEFAULTS));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(window.location.search).toBe("?utm_source=newsletter");
  });

  it("does not touch the address when restoring saved values", () => {
    setUrl("/calc?price=500000&utm_source=newsletter");
    const spy = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS, 100));
    expect(result.current.values.price).toBe(500_000);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?price=500000&utm_source=newsletter");
    spy.mockRestore();
  });

  it("keeps unrelated parameters when the visitor changes something", () => {
    setUrl("/calc?utm_source=newsletter");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS, 100));
    act(() => result.current.setValue("rate", 5));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(window.location.search).toBe("?utm_source=newsletter&rate=5");
  });

  it("updates a value and writes it to the address after the debounce", () => {
    const { result } = renderHook(() => useCalculatorState(DEFAULTS, 400));
    act(() => result.current.setValue("rate", 7.25));
    expect(result.current.values.rate).toBe(7.25);
    expect(window.location.search).toBe(""); // not yet
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(window.location.search).toBe("");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(window.location.search).toBe("?rate=7.25");
  });

  it("debounces: rapid changes produce a single write with the last value", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS, 400));
    for (const v of [1, 2, 3, 4]) {
      act(() => result.current.setValue("price", v * 1000));
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?price=4000");
    spy.mockRestore();
  });

  it("writes only values that differ from the defaults", () => {
    const { result } = renderHook(() => useCalculatorState(DEFAULTS, 100));
    act(() => result.current.setValue("rate", 3));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current.setValue("rate", 6.5)); // back to the default
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(window.location.search).toBe("");
  });

  it("keeps the path and hash when writing", () => {
    setUrl("/calc#results");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS, 100));
    act(() => result.current.setValue("mode", "percent"));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(window.location.pathname).toBe("/calc");
    expect(window.location.hash).toBe("#results");
    expect(window.location.search).toBe("?mode=percent");
  });

  it("writes an emptied field as an empty parameter and restores it as null", () => {
    const { result } = renderHook(() => useCalculatorState(DEFAULTS, 100));
    act(() => result.current.setValue("price", null));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(window.location.search).toBe("?price=");

    cleanup();
    const again = renderHook(() => useCalculatorState(DEFAULTS));
    expect(again.result.current.values.price).toBeNull();
  });

  it("reset returns every value to its default and clears the address", () => {
    setUrl("/calc?price=1&rate=2&mode=percent");
    const { result } = renderHook(() => useCalculatorState(DEFAULTS, 100));
    expect(result.current.values.price).toBe(1);
    act(() => result.current.reset());
    expect(result.current.values).toEqual(DEFAULTS);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(window.location.search).toBe("");
  });

  it("setValues replaces several values at once", () => {
    const { result } = renderHook(() => useCalculatorState(DEFAULTS));
    act(() => result.current.setValues({ price: 1, rate: 2, mode: "percent" }));
    expect(result.current.values).toEqual({ price: 1, rate: 2, mode: "percent" });
  });

  it("does not write after unmount", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    const { result, unmount } = renderHook(() => useCalculatorState(DEFAULTS, 400));
    act(() => result.current.setValue("price", 5));
    unmount();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
