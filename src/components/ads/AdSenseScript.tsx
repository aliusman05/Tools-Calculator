"use client";

import Script from "next/script";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { adsConfig } from "@/lib/ads-config";

/**
 * Loads the AdSense library, and only when ads are enabled by environment AND the visitor has
 * consented to advertising cookies. Mounted once, in the root layout.
 */
export function AdSenseScript() {
  if (!adsConfig.enabled) return null;
  return (
    <ConsentGate category="ads">
      <Script
        id="adsense"
        src={adsConfig.scriptSrc}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
    </ConsentGate>
  );
}
