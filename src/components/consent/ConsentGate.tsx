"use client";

import type { ReactNode } from "react";
import { useConsent } from "@/lib/consent-store";

/**
 * Renders its children only after the visitor has consented to the given category. Wrap every
 * analytics or advertising script, pixel or embed in this so nothing optional loads early.
 */
export function ConsentGate({
  category,
  children,
}: {
  category: "analytics" | "ads";
  children: ReactNode;
}) {
  const { analyticsGranted, adsGranted } = useConsent();
  const granted = category === "analytics" ? analyticsGranted : adsGranted;
  return granted ? <>{children}</> : null;
}
