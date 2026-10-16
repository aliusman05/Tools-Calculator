"use client";

import { openConsentSettings } from "@/lib/consent-store";

/** Footer control that reopens the consent panel so visitors can change or withdraw consent. */
export function ConsentSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openConsentSettings} className={className}>
      Cookie settings
    </button>
  );
}
