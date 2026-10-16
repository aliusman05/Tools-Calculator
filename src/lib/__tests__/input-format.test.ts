import { describe, expect, it } from "vitest";
import { groupThousands, parseDisplayNumber, sanitizeNumeric } from "@/lib/input-format";

describe("sanitizeNumeric", () => {
  it("strips non-numeric characters", () => {
    expect(sanitizeNumeric("$1,234abc")).toBe("1234");
  });
  it("keeps only the first decimal point", () => {
    expect(sanitizeNumeric("1.2.3")).toBe("1.23");
  });
  it("rejects negative signs and exponents", () => {
    expect(sanitizeNumeric("-1e5")).toBe("15");
  });
});

describe("groupThousands", () => {
  it("groups integers", () => {
    expect(groupThousands("1234567")).toBe("1,234,567");
  });
  it("leaves short numbers alone", () => {
    expect(groupThousands("999")).toBe("999");
  });
  it("preserves a trailing dot and fractional digits", () => {
    expect(groupThousands("1234.")).toBe("1,234.");
    expect(groupThousands("1234.50")).toBe("1,234.50");
  });
});

describe("parseDisplayNumber", () => {
  it("parses grouped values", () => {
    expect(parseDisplayNumber("1,234.5")).toBe(1234.5);
  });
  it("returns NaN for empty input", () => {
    expect(parseDisplayNumber("")).toBeNaN();
    expect(parseDisplayNumber(".")).toBeNaN();
  });
});
