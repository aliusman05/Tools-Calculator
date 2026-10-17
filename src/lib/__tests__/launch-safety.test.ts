import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gaConfigScript, pageViewParams, resolveAnalyticsConfig } from "@/lib/analytics-config";
import { isProductionDeploy } from "@/lib/deploy";
import { headersFor, securityHeaders } from "@/lib/security-headers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isProductionDeploy", () => {
  it.each([undefined, "", "  ", "production"])("treats %j as production", (v) => {
    expect(isProductionDeploy({ NEXT_PUBLIC_VERCEL_ENV: v })).toBe(true);
  });
  it.each(["preview", "development", "staging"])("treats %s as not production", (v) => {
    expect(isProductionDeploy({ NEXT_PUBLIC_VERCEL_ENV: v })).toBe(false);
  });
});

describe("security headers", () => {
  const byKey = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));

  it("sends the standard protective headers", () => {
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(byKey["Strict-Transport-Security"]).toMatch(/^max-age=\d{7,}/);
  });

  it("keeps paths and query strings out of cross-origin Referer headers", () => {
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("switches off powers the site never uses", () => {
    for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
      expect(byKey["Permissions-Policy"]).toContain(`${feature}=()`);
    }
  });

  it("has no duplicate header names", () => {
    expect(new Set(securityHeaders.map((h) => h.key)).size).toBe(securityHeaders.length);
  });

  it("production responses carry no robots restriction", () => {
    expect(headersFor(true).some((h) => h.key === "X-Robots-Tag")).toBe(false);
    expect(headersFor(true)).toHaveLength(securityHeaders.length);
  });

  it("preview and development responses tell crawlers to stay away", () => {
    const robots = headersFor(false).find((h) => h.key === "X-Robots-Tag");
    expect(robots?.value).toBe("noindex, nofollow");
  });
});

describe("robots.txt on non-production deployments", () => {
  it("allows crawling and lists the sitemap in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    const { default: robots } = await import("@/app/robots");
    const r = robots();
    expect(r.sitemap).toMatch(/sitemap\.xml$/);
    const rule = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    expect(rule.allow).toBe("/");
  });

  it("blocks everything and omits the sitemap on a preview deployment", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    const { default: robots } = await import("@/app/robots");
    const r = robots();
    expect(r.sitemap).toBeUndefined();
    const rule = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    expect(rule.disallow).toBe("/");
    expect(rule.allow).toBeUndefined();
  });
});

describe("resolveAnalyticsConfig", () => {
  const id = "G-ABC123XYZ9";

  it("is enabled with a valid ID on a production build", () => {
    const c = resolveAnalyticsConfig({ NEXT_PUBLIC_GA_ID: id }, "production");
    expect(c.enabled).toBe(true);
    expect(c.disabledReason).toBeNull();
    expect(c.scriptSrc).toBe(`https://www.googletagmanager.com/gtag/js?id=${id}`);
  });

  it("is off by default", () => {
    expect(resolveAnalyticsConfig({}, "production")).toMatchObject({ enabled: false });
    expect(resolveAnalyticsConfig({ NEXT_PUBLIC_GA_ID: "  " }, "production").enabled).toBe(false);
  });

  it.each([
    "UA-12345-1",
    "G-",
    "g-abc123xyz9",
    "G-abc123",
    "G-ABC 123456",
    "ca-pub-123",
    "G-ABC12",
  ])("rejects the malformed ID %j", (bad) => {
    const c = resolveAnalyticsConfig({ NEXT_PUBLIC_GA_ID: bad }, "production");
    expect(c.enabled).toBe(false);
    expect(c.disabledReason).toMatch(/not a GA4/);
  });

  it("is off on a development server and on preview deployments", () => {
    expect(resolveAnalyticsConfig({ NEXT_PUBLIC_GA_ID: id }, "development").disabledReason).toBe(
      "development server",
    );
    const preview = resolveAnalyticsConfig(
      { NEXT_PUBLIC_GA_ID: id, NEXT_PUBLIC_VERCEL_ENV: "preview" },
      "production",
    );
    expect(preview.enabled).toBe(false);
    expect(preview.disabledReason).toBe("preview deployment");
  });
});

describe("what is sent to Google Analytics", () => {
  it("page views carry the origin and path only, never a query string or fragment", () => {
    const p = pageViewParams("https://example.com", "/mortgage-calculator", "Mortgage");
    expect(p).toEqual({
      page_title: "Mortgage",
      page_location: "https://example.com/mortgage-calculator",
      page_path: "/mortgage-calculator",
    });
    expect(JSON.stringify(p)).not.toMatch(/[?#]/);
  });

  it("the config script turns off automatic page views and Google signals", () => {
    const script = gaConfigScript("G-ABC123XYZ9");
    expect(script).toContain("send_page_view: false");
    expect(script).toContain("allow_google_signals: false");
    expect(script).toContain("allow_ad_personalization_signals: false");
  });

  it("the config script runs and queues the right gtag calls", () => {
    const ctx: Record<string, unknown> = { Date };
    ctx.window = ctx;
    runInNewContext(gaConfigScript("G-ABC123XYZ9"), ctx);
    const calls = (ctx.dataLayer as ArrayLike<unknown>[]).map((a) => Array.from(a));
    expect(calls[0]![0]).toBe("js");
    expect(calls[1]).toEqual([
      "config",
      "G-ABC123XYZ9",
      {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      },
    ]);
  });

  it("reuses a gtag function the consent defaults already defined", () => {
    const seen: unknown[][] = [];
    const ctx: Record<string, unknown> = {
      Date,
      dataLayer: [],
      gtag: (...a: unknown[]) => seen.push(a),
    };
    ctx.window = ctx;
    runInNewContext(gaConfigScript("G-ABC123XYZ9"), ctx);
    expect(seen.map((c) => c[0])).toEqual(["js", "config"]);
  });

  it("escapes the measurement ID safely", () => {
    expect(gaConfigScript('G-"</script>')).toContain(JSON.stringify('G-"</script>'));
  });
});
