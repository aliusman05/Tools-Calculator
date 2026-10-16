import { describe, expect, it } from "vitest";
import { parseParams, serializeParams } from "@/lib/url-state";

const defaults = {
  price: 400_000 as number | null,
  rate: 6.5,
  mode: "amount",
  extra: null as number | null,
};

describe("url-state", () => {
  it("returns defaults for an empty query", () => {
    expect(parseParams("", defaults)).toEqual(defaults);
  });

  it("parses numbers and strings", () => {
    const parsed = parseParams("?price=500000&rate=7.25&mode=percent", defaults);
    expect(parsed).toEqual({ price: 500_000, rate: 7.25, mode: "percent", extra: null });
  });

  it("treats an empty number as null", () => {
    expect(parseParams("price=", defaults).price).toBeNull();
  });

  it("ignores non-numeric values and unknown keys", () => {
    const parsed = parseParams("price=abc&unknown=1", defaults);
    expect(parsed).toEqual(defaults);
  });

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
