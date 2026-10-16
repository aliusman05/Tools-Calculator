// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_STORAGE_KEY, serializeConsent } from "@/lib/consent";

type SlotProps = {
  placement: "sidebar" | "inContent";
  minHeight: number;
  format?: "auto" | "rectangle";
};

const LIVE_ENV: Record<string, string> = {
  NEXT_PUBLIC_ADS_ENABLED: "true",
  NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1234567890123456",
  NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR: "2222222222",
  NEXT_PUBLIC_ADSENSE_SLOT_CONTENT: "3333333333",
};

async function loadSlot(env: Record<string, string>, nodeEnv = "production") {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", nodeEnv);
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const mod = await import("@/components/ads/AdSlot");
  return mod.AdSlot as ComponentType<SlotProps>;
}

const consent = (ads: boolean) =>
  window.localStorage.setItem(
    CONSENT_STORAGE_KEY,
    serializeConsent({ analytics: false, ads }, "t"),
  );

beforeEach(() => {
  window.localStorage.clear();
  delete window.adsbygoogle;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("AdSlot", () => {
  it("renders nothing when ads are disabled", async () => {
    const AdSlot = await loadSlot({});
    const { container } = render(<AdSlot placement="sidebar" minHeight={250} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a labelled placeholder of the right height when placeholders are requested", async () => {
    const AdSlot = await loadSlot({ NEXT_PUBLIC_ADS_PLACEHOLDER: "true" });
    const { container } = render(<AdSlot placement="sidebar" minHeight={250} />);
    const ph = container.querySelector("[data-ad-placeholder='sidebar']");
    expect(ph).not.toBeNull();
    expect(container).toHaveTextContent("Advertisement (placeholder)");
    const box = ph!.querySelector("div") as HTMLElement;
    expect(box.style.minHeight).toBe("250px");
    expect(container.querySelector("ins")).toBeNull();
  });

  it("renders nothing for a placement that has no ad-unit ID", async () => {
    const AdSlot = await loadSlot({ ...LIVE_ENV, NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR: "" });
    consent(true);
    const { container } = render(<AdSlot placement="sidebar" minHeight={250} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing before the visitor has chosen", async () => {
    const AdSlot = await loadSlot(LIVE_ENV);
    const { container } = render(<AdSlot placement="sidebar" minHeight={250} />);
    expect(container).toBeEmptyDOMElement();
    expect(window.adsbygoogle).toBeUndefined();
  });

  it("renders nothing when the visitor rejected advertising", async () => {
    const AdSlot = await loadSlot(LIVE_ENV);
    consent(false);
    const { container } = render(<AdSlot placement="sidebar" minHeight={250} />);
    expect(container).toBeEmptyDOMElement();
    expect(window.adsbygoogle).toBeUndefined();
  });

  it("renders nothing on a development server even with consent", async () => {
    const AdSlot = await loadSlot(LIVE_ENV, "development");
    consent(true);
    const { container } = render(<AdSlot placement="sidebar" minHeight={250} />);
    expect(container.querySelector("ins")).toBeNull();
  });

  it("with consent: reserves the height, labels the ad, and requests it once", async () => {
    const AdSlot = await loadSlot(LIVE_ENV);
    consent(true);
    const { container } = render(<AdSlot placement="sidebar" minHeight={250} format="rectangle" />);

    expect(container).toHaveTextContent("Advertisement");
    const reserved = container.querySelector("[data-ad-placement='sidebar'] > div") as HTMLElement;
    expect(reserved.style.minHeight).toBe("250px");

    // jsdom has no IntersectionObserver, so the slot falls back to loading straight away.
    const ins = container.querySelector("ins.adsbygoogle") as HTMLElement;
    expect(ins).not.toBeNull();
    expect(ins.dataset.adClient).toBe("ca-pub-1234567890123456");
    expect(ins.dataset.adSlot).toBe("2222222222");
    expect(ins.dataset.adFormat).toBe("rectangle");
    expect(ins.dataset.fullWidthResponsive).toBe("true");
    expect(ins.dataset.adtest).toBeUndefined();
    expect(window.adsbygoogle).toHaveLength(1);
  });

  it("asks for test ads in test mode", async () => {
    const AdSlot = await loadSlot({ ...LIVE_ENV, NEXT_PUBLIC_ADS_TEST_MODE: "true" });
    consent(true);
    const { container } = render(<AdSlot placement="sidebar" minHeight={250} />);
    expect((container.querySelector("ins") as HTMLElement).dataset.adtest).toBe("on");
  });

  it("does not request the ad until the slot nears the viewport (lazy loading)", async () => {
    const observers: Array<{ cb: IntersectionObserverCallback; el?: Element }> = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        entry: { cb: IntersectionObserverCallback; el?: Element };
        constructor(cb: IntersectionObserverCallback) {
          this.entry = { cb };
          observers.push(this.entry);
        }
        observe(el: Element) {
          this.entry.el = el;
        }
        disconnect() {}
        unobserve() {}
      },
    );
    const AdSlot = await loadSlot(LIVE_ENV);
    consent(true);
    const { container } = render(<AdSlot placement="inContent" minHeight={250} />);

    expect(container.querySelector("ins")).toBeNull(); // far from the viewport: no ad, space reserved
    expect(window.adsbygoogle).toBeUndefined();
    expect(observers).toHaveLength(1);

    const { act } = await import("@testing-library/react");
    act(() => {
      observers[0]!.cb(
        [{ isIntersecting: true, target: observers[0]!.el! } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(container.querySelector("ins.adsbygoogle")).not.toBeNull();
    expect(window.adsbygoogle).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("survives an ad library that throws", async () => {
    const AdSlot = await loadSlot(LIVE_ENV);
    consent(true);
    window.adsbygoogle = {
      push() {
        throw new Error("blocked");
      },
    } as unknown as unknown[];
    expect(() => render(<AdSlot placement="sidebar" minHeight={250} />)).not.toThrow();
  });
});
