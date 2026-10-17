"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { analyticsConfig, gaConfigScript, pageViewParams } from "@/lib/analytics-config";

/**
 * Google Analytics 4, loaded only when (a) NEXT_PUBLIC_GA_ID is set on a production deployment and
 * (b) the visitor has accepted analytics cookies. Page views are sent by us, once per path, with the
 * query string left out, because the address holds the numbers typed into a calculator.
 */
export function GoogleAnalytics() {
  if (!analyticsConfig.enabled) return null;
  return (
    <ConsentGate category="analytics">
      <Script id="ga-loader" src={analyticsConfig.scriptSrc} strategy="afterInteractive" />
      <Script
        id="ga-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: gaConfigScript(analyticsConfig.measurementId) }}
      />
      <PageViews />
    </ConsentGate>
  );
}

function PageViews() {
  const pathname = usePathname();
  useEffect(() => {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", "page_view", pageViewParams(window.location.origin, pathname, document.title));
  }, [pathname]);
  return null;
}
