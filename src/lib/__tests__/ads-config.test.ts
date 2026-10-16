import { describe, expect, it } from "vitest";
import { adsOccupySpace, resolveAdsConfig, type AdsEnv } from "@/lib/ads-config";

const live: AdsEnv = {
  NEXT_PUBLIC_ADS_ENABLED: "true",
  NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1234567890123456",
  NEXT_PUBLIC_ADSENSE_SLOT_BELOW: "1111111111",
  NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR: "2222222222",
  NEXT_PUBLIC_ADSENSE_SLOT_CONTENT: "3333333333",
  NEXT_PUBLIC_ADSENSE_SLOT_END: "4444444444",
};

describe("resolveAdsConfig: when ads are enabled", () => {
  it("is enabled with the flag, a valid publisher ID and a production build", () => {
    const c = resolveAdsConfig(live, "production");
    expect(c.enabled).toBe(true);
    expect(c.disabledReason).toBeNull();
    expect(c.client).toBe("ca-pub-1234567890123456");
    expect(c.placeholder).toBe(false);
  });

  it("reads the four slot IDs", () => {
    expect(resolveAdsConfig(live, "production").slots).toEqual({
      calculatorBelow: "1111111111",
      sidebar: "2222222222",
      inContent: "3333333333",
      pageEnd: "4444444444",
    });
  });

  it("builds the AdSense script URL from the publisher ID", () => {
    expect(resolveAdsConfig(live, "production").scriptSrc).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456",
    );
  });

  it("is enabled on a Vercel production deployment", () => {
    expect(
      resolveAdsConfig({ ...live, NEXT_PUBLIC_VERCEL_ENV: "production" }, "production").enabled,
    ).toBe(true);
  });

  it("passes test mode through", () => {
    expect(
      resolveAdsConfig({ ...live, NEXT_PUBLIC_ADS_TEST_MODE: "true" }, "production").testMode,
    ).toBe(true);
    expect(resolveAdsConfig(live, "production").testMode).toBe(false);
  });
});

describe("resolveAdsConfig: when ads are off", () => {
  it("is off by default", () => {
    const c = resolveAdsConfig({}, "production");
    expect(c.enabled).toBe(false);
    expect(c.disabledReason).toMatch(/ADS_ENABLED/);
  });

  it.each([undefined, "", "false", "TRUE", "1", "yes"])(
    "is off when ADS_ENABLED is %j",
    (value) => {
      expect(
        resolveAdsConfig({ ...live, NEXT_PUBLIC_ADS_ENABLED: value }, "production").enabled,
      ).toBe(false);
    },
  );

  it.each([undefined, "", "pub-123", "ca-pub-abc", "ca-pub-123", "ca-pub-1234567890123456 x"])(
    "is off with the invalid publisher ID %j",
    (client) => {
      const c = resolveAdsConfig({ ...live, NEXT_PUBLIC_ADSENSE_CLIENT: client }, "production");
      expect(c.enabled).toBe(false);
      expect(c.disabledReason).toMatch(/ADSENSE_CLIENT/);
    },
  );

  it("is off on a development server even when fully configured", () => {
    const c = resolveAdsConfig(live, "development");
    expect(c.enabled).toBe(false);
    expect(c.disabledReason).toBe("development server");
  });

  it.each(["preview", "development"])("is off on a Vercel %s deployment", (env) => {
    const c = resolveAdsConfig({ ...live, NEXT_PUBLIC_VERCEL_ENV: env }, "production");
    expect(c.enabled).toBe(false);
    expect(c.disabledReason).toBe(`${env} deployment`);
  });
});

describe("resolveAdsConfig: slot IDs", () => {
  it("drops missing or malformed slot IDs so the placement renders nothing", () => {
    const c = resolveAdsConfig(
      {
        ...live,
        NEXT_PUBLIC_ADSENSE_SLOT_BELOW: "",
        NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR: "abc",
        NEXT_PUBLIC_ADSENSE_SLOT_CONTENT: "123",
        NEXT_PUBLIC_ADSENSE_SLOT_END: undefined,
      },
      "production",
    );
    expect(c.slots).toEqual({ calculatorBelow: "", sidebar: "", inContent: "", pageEnd: "" });
  });

  it("trims whitespace around a valid slot ID", () => {
    const c = resolveAdsConfig(
      { ...live, NEXT_PUBLIC_ADSENSE_SLOT_END: " 4444444444 " },
      "production",
    );
    expect(c.slots.pageEnd).toBe("4444444444");
  });
});

describe("resolveAdsConfig: placeholders", () => {
  it("shows placeholders on a development server", () => {
    const c = resolveAdsConfig({}, "development");
    expect(c.placeholder).toBe(true);
    expect(adsOccupySpace(c)).toBe(true);
  });

  it("shows placeholders in production only when asked to", () => {
    expect(resolveAdsConfig({}, "production").placeholder).toBe(false);
    expect(
      resolveAdsConfig({ NEXT_PUBLIC_ADS_PLACEHOLDER: "true" }, "production").placeholder,
    ).toBe(true);
  });

  it("shows no placeholders when real ads are enabled", () => {
    expect(
      resolveAdsConfig({ ...live, NEXT_PUBLIC_ADS_PLACEHOLDER: "true" }, "production").placeholder,
    ).toBe(false);
  });

  it("takes up no room when ads are off and placeholders are not requested", () => {
    expect(adsOccupySpace(resolveAdsConfig({}, "production"))).toBe(false);
    expect(adsOccupySpace(resolveAdsConfig(live, "production"))).toBe(true);
  });

  it("shows placeholders on preview deployments when asked, to check layout without ads", () => {
    const c = resolveAdsConfig(
      { ...live, NEXT_PUBLIC_VERCEL_ENV: "preview", NEXT_PUBLIC_ADS_PLACEHOLDER: "true" },
      "production",
    );
    expect(c.enabled).toBe(false);
    expect(c.placeholder).toBe(true);
  });
});
