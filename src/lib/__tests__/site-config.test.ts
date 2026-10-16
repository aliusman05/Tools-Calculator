import { describe, expect, it } from "vitest";
import { siteConfig } from "@/lib/site-config";

describe("siteConfig", () => {
  it("has a valid ISO last-updated date", () => {
    expect(Number.isNaN(Date.parse(siteConfig.lastUpdated))).toBe(false);
  });

  it("has a parseable site URL", () => {
    expect(() => new URL(siteConfig.url)).not.toThrow();
  });
});
