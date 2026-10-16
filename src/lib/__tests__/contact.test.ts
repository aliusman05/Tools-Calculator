import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/contact/route";
import {
  checkContact,
  MAX_FORM_AGE_MS,
  MIN_FILL_MS,
  verifyTurnstile,
  type ContactInput,
} from "@/lib/contact";

const NOW = 1_800_000_000_000;

const valid: ContactInput = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Hello, I think the mortgage calculator has a typo in the FAQ.",
  website: "",
  startedAt: NOW - 20_000,
};

describe("checkContact", () => {
  it("accepts a normal message and trims fields", () => {
    const r = checkContact(
      { ...valid, name: "  Ada  ", message: "  A valid message here.  " },
      NOW,
    );
    expect(r).toEqual({
      ok: true,
      value: { name: "Ada", email: "ada@example.com", message: "A valid message here." },
    });
  });

  it("treats a filled honeypot as spam", () => {
    expect(checkContact({ ...valid, website: "http://spam.example" }, NOW)).toEqual({
      ok: false,
      reason: "spam",
    });
  });

  it("asks fast submitters to retry instead of dropping them", () => {
    expect(checkContact({ ...valid, startedAt: NOW - (MIN_FILL_MS - 1) }, NOW)).toEqual({
      ok: false,
      reason: "too_fast",
    });
    expect(checkContact({ ...valid, startedAt: NOW - MIN_FILL_MS }, NOW).ok).toBe(true);
  });

  it("flags forms left open for over a day", () => {
    expect(checkContact({ ...valid, startedAt: NOW - MAX_FORM_AGE_MS - 1 }, NOW)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("treats a missing or future timestamp as spam", () => {
    expect(checkContact({ ...valid, startedAt: Number.NaN }, NOW)).toEqual({
      ok: false,
      reason: "spam",
    });
    expect(checkContact({ ...valid, startedAt: NOW + 5_000 }, NOW)).toEqual({
      ok: false,
      reason: "spam",
    });
  });

  it("allows up to two links and flags more as spam", () => {
    const two = "See https://a.example and https://b.example for details of the bug.";
    expect(checkContact({ ...valid, message: two }, NOW).ok).toBe(true);
    const three = `${two} Also https://c.example please.`;
    expect(checkContact({ ...valid, message: three }, NOW)).toEqual({ ok: false, reason: "spam" });
  });

  it.each([
    ["name", { name: "" }],
    ["name", { name: "x".repeat(101) }],
    ["email", { email: "not-an-email" }],
    ["email", { email: "a@b" }],
    ["message", { message: "short" }],
    ["message", { message: "x".repeat(5_001) }],
  ])("reports an invalid %s", (field, override) => {
    const r = checkContact({ ...valid, ...override }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "invalid")
      expect(r.errors[field as "name" | "email" | "message"]).toBeDefined();
    else throw new Error("expected invalid");
  });

  it("reports every invalid field at once", () => {
    const r = checkContact({ ...valid, name: "", email: "x", message: "y" }, NOW);
    if (r.ok || r.reason !== "invalid") throw new Error("expected invalid");
    expect(Object.keys(r.errors).sort()).toEqual(["email", "message", "name"]);
  });
});

describe("verifyTurnstile", () => {
  const ok = (success: boolean) =>
    vi.fn(async () => ({ json: async () => ({ success }) }) as Response);

  it("is skipped when no secret is configured", async () => {
    expect(await verifyTurnstile(null, undefined)).toBe(true);
  });

  it("fails without a token when a secret is configured", async () => {
    expect(await verifyTurnstile(null, "secret")).toBe(false);
  });

  it("passes only when Cloudflare says success", async () => {
    expect(await verifyTurnstile("tok", "secret", ok(true) as unknown as typeof fetch)).toBe(true);
    expect(await verifyTurnstile("tok", "secret", ok(false) as unknown as typeof fetch)).toBe(
      false,
    );
  });

  it("fails closed if the verification request throws", async () => {
    const boom = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await verifyTurnstile("tok", "secret", boom as unknown as typeof fetch)).toBe(false);
  });

  it("sends the secret and token to Cloudflare", async () => {
    const f = ok(true);
    await verifyTurnstile("tok", "secret", f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(String(init.body)).toContain("secret=secret");
    expect(String(init.body)).toContain("response=tok");
  });
});

describe("POST /api/contact", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const request = (body: unknown) =>
    new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  const payload = (over: Record<string, unknown> = {}) => ({
    name: "Ada",
    email: "ada@example.com",
    message: "This is a perfectly reasonable message.",
    website: "",
    startedAt: Date.now() - 10_000,
    ...over,
  });

  it("rejects a body that is not JSON", async () => {
    expect((await POST(request("not json"))).status).toBe(400);
  });

  it("returns field errors with 422", async () => {
    const res = await POST(request(payload({ email: "nope" })));
    expect(res.status).toBe(422);
    expect((await res.json()).errors.email).toBeDefined();
  });

  it("pretends success to bots and sends nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CONTACT_WEBHOOK_URL", "https://hooks.example/abc");
    const res = await POST(request(payload({ website: "spam" })));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tells fast submitters to wait", async () => {
    const res = await POST(request(payload({ startedAt: Date.now() - 500 })));
    expect(res.status).toBe(429);
  });

  it("answers 503 with an email fallback when no webhook is configured", async () => {
    vi.stubEnv("CONTACT_WEBHOOK_URL", "");
    const res = await POST(request(payload()));
    expect(res.status).toBe(503);
    expect((await res.json()).fallback).toBe("email");
  });

  it("forwards a valid message to the webhook", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CONTACT_WEBHOOK_URL", "https://hooks.example/abc");
    const res = await POST(request(payload()));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example/abc");
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ name: "Ada", email: "ada@example.com" });
    expect(sent.website).toBeUndefined();
    expect(sent.receivedAt).toBeDefined();
  });

  it("reports a delivery failure with 502 and the email fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 500 })),
    );
    vi.stubEnv("CONTACT_WEBHOOK_URL", "https://hooks.example/abc");
    const res = await POST(request(payload()));
    expect(res.status).toBe(502);
    expect((await res.json()).fallback).toBe("email");
  });

  it("requires a Turnstile token when a secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubEnv("CONTACT_WEBHOOK_URL", "https://hooks.example/abc");
    const res = await POST(request(payload()));
    expect(res.status).toBe(400);
  });
});
