import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  hasCalculatorParams,
  MAX_SHARED_NUMBER,
  parseParams,
  serializeParams,
  stripParams,
} from "@/lib/url-state";

const defaults = {
  price: 400_000 as number | null,
  rate: 6.5,
  mode: "amount",
  extra: null as number | null,
};

describe("parseParams", () => {
  it("returns defaults for an empty query", () => {
    expect(parseParams("", defaults)).toEqual(defaults);
  });

  it("parses numbers and strings", () => {
    const parsed = parseParams("?price=500000&rate=7.25&mode=percent", defaults);
    expect(parsed).toEqual({ price: 500_000, rate: 7.25, mode: "percent", extra: null });
  });

  it("treats an empty or blank number as null", () => {
    expect(parseParams("price=", defaults).price).toBeNull();
    expect(parseParams("price=%20", defaults).price).toBeNull();
  });

  it("ignores non-numeric values and unknown keys", () => {
    expect(parseParams("price=abc&unknown=1", defaults)).toEqual(defaults);
    expect(parseParams("price=Infinity&rate=NaN", defaults)).toEqual(defaults);
  });

  it("clamps absurd numbers", () => {
    const parsed = parseParams("price=1e30&rate=-1e30", defaults);
    expect(parsed.price).toBe(MAX_SHARED_NUMBER);
    expect(parsed.rate).toBe(-MAX_SHARED_NUMBER);
  });

  it("rejects text that is long or not plain", () => {
    expect(parseParams(`mode=${"a".repeat(41)}`, defaults).mode).toBe("amount");
    expect(parseParams("mode=%3Cscript%3E", defaults).mode).toBe("amount");
    expect(parseParams("mode=years", defaults).mode).toBe("years");
  });
});

describe("serializeParams", () => {
  it("only serializes values that differ from defaults", () => {
    expect(serializeParams(defaults, defaults)).toBe("");
    expect(serializeParams({ ...defaults, rate: 7 }, defaults)).toBe("rate=7");
  });

  it("round-trips", () => {
    const values = { price: 123_456, rate: 3.125, mode: "percent", extra: 50 };
    expect(parseParams(serializeParams(values, defaults), defaults)).toEqual(values);
  });

  it("round-trips a cleared field", () => {
    const values = { ...defaults, price: null };
    expect(parseParams(serializeParams(values, defaults), defaults)).toEqual(values);
  });
});

describe("hasCalculatorParams / stripParams", () => {
  it("detects the calculator's own parameters only", () => {
    expect(hasCalculatorParams("?utm_source=x", defaults)).toBe(false);
    expect(hasCalculatorParams("?rate=7", defaults)).toBe(true);
    expect(hasCalculatorParams("", defaults)).toBe(false);
  });

  it("removes the calculator's parameters and keeps unrelated ones", () => {
    expect(stripParams("?price=1&rate=7&utm_source=news", defaults)).toBe("utm_source=news");
    expect(stripParams("?price=1", defaults)).toBe("");
  });
});

describe("buildShareUrl", () => {
  it("is just the page when nothing was changed", () => {
    expect(buildShareUrl("https://x.test", "/calc", defaults, defaults)).toBe(
      "https://x.test/calc",
    );
  });

  it("carries only the changed inputs, with no fragment or other parameters", () => {
    const url = buildShareUrl(
      "https://x.test",
      "/calc",
      { ...defaults, rate: 7, extra: 50 },
      defaults,
    );
    expect(url).toBe("https://x.test/calc?rate=7&extra=50");
  });
});
