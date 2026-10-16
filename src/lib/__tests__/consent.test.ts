import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  consentInitScript,
  DENIED_BY_DEFAULT,
  parseStoredConsent,
  serializeConsent,
  toConsentSignals,
} from "@/lib/consent";

describe("toConsentSignals", () => {
  it("denies every optional signal when nothing is accepted", () => {
    expect(toConsentSignals(DENIED_BY_DEFAULT)).toEqual({
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      functionality_storage: "granted",
      security_storage: "granted",
    });
  });

  it("maps analytics consent to analytics_storage only", () => {
    const s = toConsentSignals({ analytics: true, ads: false });
    expect(s.analytics_storage).toBe("granted");
    expect(s.ad_storage).toBe("denied");
    expect(s.ad_user_data).toBe("denied");
    expect(s.ad_personalization).toBe("denied");
  });

  it("maps advertising consent to all three v2 ad signals", () => {
    const s = toConsentSignals({ analytics: false, ads: true });
    expect(s.analytics_storage).toBe("denied");
    expect(s.ad_storage).toBe("granted");
    expect(s.ad_user_data).toBe("granted");
    expect(s.ad_personalization).toBe("granted");
  });

  it("grants everything when everything is accepted", () => {
    const s = toConsentSignals({ analytics: true, ads: true });
    expect(Object.values(s).every((v) => v === "granted")).toBe(true);
  });
});

describe("stored consent", () => {
  it("round-trips", () => {
    const raw = serializeConsent({ analytics: true, ads: false }, "2026-10-16T00:00:00.000Z");
    expect(parseStoredConsent(raw)).toEqual({
      v: CONSENT_VERSION,
      analytics: true,
      ads: false,
      at: "2026-10-16T00:00:00.000Z",
    });
  });

  it.each([
    ["null", null],
    ["empty", ""],
    ["not JSON", "{oops"],
    ["a string", '"yes"'],
    ["an array", "[]"],
    ["an old version", JSON.stringify({ v: CONSENT_VERSION - 1, analytics: true, ads: true })],
    ["a future version", JSON.stringify({ v: CONSENT_VERSION + 1, analytics: true, ads: true })],
    ["missing fields", JSON.stringify({ v: CONSENT_VERSION, analytics: true })],
    ["wrong types", JSON.stringify({ v: CONSENT_VERSION, analytics: "yes", ads: 1 })],
  ])("treats %s as no decision", (_name, raw) => {
    expect(parseStoredConsent(raw)).toBeNull();
  });
});

/** Run the inline init script in a sandbox where `window` is the global object, as in a browser. */
function sandbox(storage: { getItem: (k: string) => string | null }) {
  const ctx: Record<string, unknown> = { localStorage: storage, Array, JSON };
  ctx.window = ctx;
  runInNewContext(consentInitScript(), ctx);
  // `dataLayer` entries are `arguments` objects; normalise to arrays.
  return (ctx.dataLayer as ArrayLike<unknown>[]).map((a) => Array.from(a));
}

function runInit(stored?: string) {
  return sandbox({
    getItem: (k: string) => (k === CONSENT_STORAGE_KEY && stored !== undefined ? stored : null),
  });
}

describe("consentInitScript", () => {
  it("sets all optional signals to denied by default, before anything else", () => {
    const calls = runInit();
    const first = calls[0]!;
    expect(first[0]).toBe("consent");
    expect(first[1]).toBe("default");
    expect(first[2]).toMatchObject({
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500,
    });
    expect(calls.some((c) => c[1] === "update")).toBe(false);
  });

  it("redacts ads data until consent is given", () => {
    expect(
      runInit().some((c) => c[0] === "set" && c[1] === "ads_data_redaction" && c[2] === true),
    ).toBe(true);
  });

  it("applies a returning visitor's saved choice immediately", () => {
    const calls = runInit(serializeConsent({ analytics: true, ads: false }, "x"));
    const update = calls.find((c) => c[1] === "update");
    expect(update?.[2]).toEqual({
      ad_storage: "denied",
      analytics_storage: "granted",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("ignores a corrupt or outdated saved choice", () => {
    expect(runInit("{oops").some((c) => c[1] === "update")).toBe(false);
    expect(
      runInit(JSON.stringify({ v: 0, analytics: true, ads: true })).some((c) => c[1] === "update"),
    ).toBe(false);
  });

  it("survives storage that throws, still setting the denied defaults", () => {
    const calls = sandbox({
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(calls[0]?.slice(0, 2)).toEqual(["consent", "default"]);
    expect(calls.some((c) => c[1] === "update")).toBe(false);
  });
});
