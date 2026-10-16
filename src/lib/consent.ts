/**
 * Cookie consent model and Google Consent Mode v2 signals. Pure logic: no React, no DOM.
 *
 * Visitors choose two optional categories, "analytics" and "ads". Everything else the site uses
 * (security, remembering this choice) is strictly necessary. Until a choice is made, all optional
 * signals are DENIED, and no analytics or advertising script may load.
 *
 * NOTE: AdSense serving to visitors in the EEA, UK and Switzerland requires a Google-certified
 * Consent Management Platform (CMP). This module provides the Consent Mode v2 plumbing and a
 * simple built-in banner; replace the banner with a certified CMP before applying for AdSense
 * (see docs/LAUNCH-TODO.md). The CMP then calls the same `gtag('consent', ...)` API.
 */

export const CONSENT_STORAGE_KEY = "fincalc-consent";
/** Bump to ask every visitor again (for example after adding a new category of cookie). */
export const CONSENT_VERSION = 1;

export type ConsentChoice = { analytics: boolean; ads: boolean };

export type StoredConsent = ConsentChoice & { v: number; at: string };

export type ConsentStatus =
  { status: "loading" } | { status: "undecided" } | ({ status: "decided" } & ConsentChoice);

export type ConsentModeValue = "granted" | "denied";

/** The signals Google Consent Mode v2 expects. */
export type ConsentSignals = {
  ad_storage: ConsentModeValue;
  analytics_storage: ConsentModeValue;
  ad_user_data: ConsentModeValue;
  ad_personalization: ConsentModeValue;
  functionality_storage: ConsentModeValue;
  security_storage: ConsentModeValue;
};

const flag = (on: boolean): ConsentModeValue => (on ? "granted" : "denied");

/** Map the visitor's choice to Consent Mode v2 signals. Advertising consent covers all three ad signals. */
export function toConsentSignals(choice: ConsentChoice): ConsentSignals {
  return {
    ad_storage: flag(choice.ads),
    analytics_storage: flag(choice.analytics),
    ad_user_data: flag(choice.ads),
    ad_personalization: flag(choice.ads),
    functionality_storage: "granted",
    security_storage: "granted",
  };
}

export const DENIED_BY_DEFAULT: ConsentChoice = { analytics: false, ads: false };

/** Parse what is in storage. Anything malformed, or from an older version, counts as "no decision". */
export function parseStoredConsent(raw: string | null): StoredConsent | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const d = data as Record<string, unknown>;
    if (d.v !== CONSENT_VERSION) return null;
    if (typeof d.analytics !== "boolean" || typeof d.ads !== "boolean") return null;
    return {
      v: CONSENT_VERSION,
      analytics: d.analytics,
      ads: d.ads,
      at: typeof d.at === "string" ? d.at : "",
    };
  } catch {
    return null;
  }
}

export function serializeConsent(choice: ConsentChoice, at: string): string {
  const stored: StoredConsent = {
    v: CONSENT_VERSION,
    analytics: choice.analytics,
    ads: choice.ads,
    at,
  };
  return JSON.stringify(stored);
}

/**
 * Inline script that runs before any other script: declares gtag, sets every optional signal to
 * denied, and, for a returning visitor, immediately applies their saved choice so that tags
 * loaded afterward see the right state.
 */
export function consentInitScript(): string {
  const denied = JSON.stringify({ ...toConsentSignals(DENIED_BY_DEFAULT), wait_for_update: 500 });
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', ${denied});
gtag('set', 'ads_data_redaction', true);
try {
  var raw = window.localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)});
  var s = raw ? JSON.parse(raw) : null;
  if (s && s.v === ${CONSENT_VERSION} && typeof s.analytics === 'boolean' && typeof s.ads === 'boolean') {
    gtag('consent', 'update', {
      ad_storage: s.ads ? 'granted' : 'denied',
      analytics_storage: s.analytics ? 'granted' : 'denied',
      ad_user_data: s.ads ? 'granted' : 'denied',
      ad_personalization: s.ads ? 'granted' : 'denied'
    });
  }
} catch (e) {}
`.trim();
}
