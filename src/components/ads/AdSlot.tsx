"use client";

import { useEffect, useRef, useState } from "react";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { adsConfig, type AdPlacement } from "@/lib/ads-config";
import { cn } from "@/lib/cn";

type AdFormat = "auto" | "rectangle" | "horizontal" | "vertical";

type Props = {
  placement: AdPlacement;
  /** Fixed height (px) reserved for the ad before it loads, so nothing shifts when it arrives. */
  minHeight: number;
  format?: AdFormat;
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * A single AdSense display ad.
 *
 *  - Renders nothing unless ads are enabled (see src/lib/ads-config.ts) and the placement has an
 *    ad-unit ID. In development, or with NEXT_PUBLIC_ADS_PLACEHOLDER=true, it renders a labelled
 *    empty box of the real size instead, so layouts can be checked without ads.
 *  - Renders nothing until the visitor has consented to advertising cookies.
 *  - Reserves `minHeight` as soon as it renders, and only asks for the ad when it scrolls near
 *    the viewport (lazy loading), so ads below the fold cost nothing until they are needed.
 *  - Is surrounded by generous margin and never placed next to inputs or buttons.
 */
export function AdSlot(props: Props) {
  if (!adsConfig.enabled) return adsConfig.placeholder ? <Placeholder {...props} /> : null;
  if (!adsConfig.slots[props.placement]) return null;
  return (
    <ConsentGate category="ads">
      <AdUnit {...props} />
    </ConsentGate>
  );
}

const frame = "mx-auto my-8 w-full max-w-3xl";
const label = "text-muted mb-1 text-center text-[11px] tracking-wide uppercase";

function Placeholder({ placement, minHeight, className }: Props) {
  return (
    <div className={cn(frame, className)} data-ad-placeholder={placement}>
      <p className={label}>Advertisement (placeholder)</p>
      <div
        style={{ minHeight }}
        className="border-border text-muted rounded-card flex items-center justify-center border border-dashed text-xs"
      >
        Ad slot: {placement}
      </div>
    </div>
  );
}

function AdUnit({ placement, minHeight, format = "auto", className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  // AdUnit only ever renders in the browser (after consent), so this check is safe here. Without
  // IntersectionObserver there is no way to know when the slot is near, so load straight away.
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");

  // Lazy load: only request the ad once the slot is within ~300px of the viewport. A slot that is
  // hidden with display:none (for example the desktop sidebar on mobile) never intersects.
  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // An ad blocker or a script error must never break the page.
    }
  }, [near]);

  return (
    <div className={cn(frame, className)} data-ad-placement={placement}>
      <p className={label}>Advertisement</p>
      <div ref={box} style={{ minHeight }} className="flex justify-center overflow-hidden">
        {near && (
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight }}
            data-ad-client={adsConfig.client}
            data-ad-slot={adsConfig.slots[placement]}
            data-ad-format={format}
            data-full-width-responsive="true"
            {...(adsConfig.testMode ? { "data-adtest": "on" } : {})}
          />
        )}
      </div>
    </div>
  );
}
