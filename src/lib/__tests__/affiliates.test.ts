import { describe, expect, it } from "vitest";
import { affiliates, offersFor, type AffiliateOffer } from "@/lib/data/affiliates";
import { calculators } from "@/lib/registry";

const offer = (over: Partial<AffiliateOffer> = {}): AffiliateOffer => ({
  id: "o1",
  partner: "Partner",
  headline: "Headline",
  description: "Description",
  cta: "Go",
  url: "https://partner.example/ref?id=1",
  contexts: ["credit-card"],
  active: true,
  ...over,
});

describe("offersFor", () => {
  it("returns active offers that match the context", () => {
    expect(offersFor("credit-card", [offer()])).toHaveLength(1);
  });

  it("ignores inactive offers", () => {
    expect(offersFor("credit-card", [offer({ active: false })])).toEqual([]);
  });

  it("ignores offers whose link is empty or not HTTPS", () => {
    expect(offersFor("credit-card", [offer({ url: "" })])).toEqual([]);
    expect(offersFor("credit-card", [offer({ url: "http://partner.example" })])).toEqual([]);
    expect(offersFor("credit-card", [offer({ url: "javascript:alert(1)" })])).toEqual([]);
  });

  it("ignores offers for other contexts", () => {
    expect(offersFor("mortgage", [offer()])).toEqual([]);
  });

  it("returns nothing without a context", () => {
    expect(offersFor(undefined, [offer()])).toEqual([]);
  });

  it("matches an offer that lists several contexts", () => {
    const o = offer({ contexts: ["credit-card", "debt-consolidation"] });
    expect(offersFor("debt-consolidation", [o])).toHaveLength(1);
  });

  it("limits the number of offers per page, keeping data order", () => {
    const list = [offer({ id: "a" }), offer({ id: "b" }), offer({ id: "c" })];
    expect(offersFor("credit-card", list).map((o) => o.id)).toEqual(["a"]);
    expect(offersFor("credit-card", list, 2).map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("affiliate data", () => {
  it("has unique ids", () => {
    expect(new Set(affiliates.map((a) => a.id)).size).toBe(affiliates.length);
  });

  it("never publishes an active offer without a secure link and real copy", () => {
    for (const a of affiliates.filter((x) => x.active)) {
      expect(a.url, a.id).toMatch(/^https:\/\//);
      expect(a.headline.length, a.id).toBeGreaterThan(10);
      expect(a.description.length, a.id).toBeGreaterThan(30);
      expect(a.contexts.length, a.id).toBeGreaterThan(0);
    }
  });

  it("ships with the example offer switched off", () => {
    expect(affiliates.every((a) => !a.active)).toBe(true);
    expect(offersFor("credit-card")).toEqual([]);
  });

  it("is only referenced by contexts that some calculator actually uses", () => {
    const used = new Set(calculators.map((c) => c.affiliateContext).filter(Boolean));
    for (const a of affiliates) {
      expect(
        a.contexts.some((c) => used.has(c)),
        a.id,
      ).toBe(true);
    }
  });
});
