// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from "@/lib/consent";
import { saveConsent, useConsent } from "@/lib/consent-store";

type Gtag = (...args: unknown[]) => void;

function stored() {
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  window.localStorage.clear();
  delete (window as unknown as { gtag?: Gtag }).gtag;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useConsent", () => {
  it("is undecided when nothing is stored", () => {
    const { result } = renderHook(() => useConsent());
    expect(result.current.status).toEqual({ status: "undecided" });
    expect(result.current.analyticsGranted).toBe(false);
    expect(result.current.adsGranted).toBe(false);
    expect(result.current.settingsOpen).toBe(false);
  });

  it("reads a stored choice", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ v: CONSENT_VERSION, analytics: true, ads: false, at: "t" }),
    );
    const { result } = renderHook(() => useConsent());
    expect(result.current.status).toEqual({ status: "decided", analytics: true, ads: false });
    expect(result.current.analyticsGranted).toBe(true);
    expect(result.current.adsGranted).toBe(false);
  });

  it("ignores an outdated or corrupt stored choice", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ v: 0, analytics: true, ads: true }),
    );
    expect(renderHook(() => useConsent()).result.current.status.status).toBe("undecided");
    cleanup();
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "{oops");
    expect(renderHook(() => useConsent()).result.current.status.status).toBe("undecided");
  });

  it("acceptAll stores and exposes a full grant", () => {
    const { result } = renderHook(() => useConsent());
    act(() => result.current.acceptAll());
    expect(result.current.status).toEqual({ status: "decided", analytics: true, ads: true });
    expect(stored()).toMatchObject({ v: CONSENT_VERSION, analytics: true, ads: true });
  });

  it("rejectAll stores and exposes a full refusal", () => {
    const { result } = renderHook(() => useConsent());
    act(() => result.current.rejectAll());
    expect(result.current.status).toEqual({ status: "decided", analytics: false, ads: false });
    expect(stored()).toMatchObject({ analytics: false, ads: false });
  });

  it("save stores a partial choice", () => {
    const { result } = renderHook(() => useConsent());
    act(() => result.current.save({ analytics: true, ads: false }));
    expect(result.current.analyticsGranted).toBe(true);
    expect(result.current.adsGranted).toBe(false);
  });

  it("notifies every subscribed component when the choice changes", () => {
    const a = renderHook(() => useConsent());
    const b = renderHook(() => useConsent());
    act(() => a.result.current.acceptAll());
    expect(b.result.current.adsGranted).toBe(true);
  });

  it("opens and closes the settings panel, and closes it when a choice is saved", () => {
    const { result } = renderHook(() => useConsent());
    act(() => result.current.openSettings());
    expect(result.current.settingsOpen).toBe(true);
    act(() => result.current.closeSettings());
    expect(result.current.settingsOpen).toBe(false);
    act(() => result.current.openSettings());
    act(() => result.current.rejectAll());
    expect(result.current.settingsOpen).toBe(false);
  });

  it("reacts to a change made in another tab", () => {
    const { result } = renderHook(() => useConsent());
    expect(result.current.adsGranted).toBe(false);
    act(() => {
      window.localStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify({ v: CONSENT_VERSION, analytics: false, ads: true, at: "t" }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: CONSENT_STORAGE_KEY }));
    });
    expect(result.current.adsGranted).toBe(true);
  });

  it("ignores storage events for other keys", () => {
    const { result } = renderHook(() => useConsent());
    const before = result.current.status;
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    });
    expect(result.current.status).toBe(before);
  });
});

describe("saveConsent and Google Consent Mode", () => {
  it("sends a consent update with the four v2 signals", () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: Gtag }).gtag = gtag;
    saveConsent({ analytics: true, ads: false });
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      ad_storage: "denied",
      analytics_storage: "granted",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("works when Google tags are not on the page", () => {
    expect(() => saveConsent({ analytics: true, ads: true })).not.toThrow();
  });

  it("still applies the choice for this session when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const gtag = vi.fn();
    (window as unknown as { gtag: Gtag }).gtag = gtag;
    expect(() => saveConsent({ analytics: true, ads: true })).not.toThrow();
    expect(gtag).toHaveBeenCalled();
  });

  it("treats unreadable storage as undecided", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useConsent());
    expect(result.current.status.status).toBe("undecided");
  });
});
