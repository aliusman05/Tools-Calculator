"use client";

import { useSyncExternalStore } from "react";
import {
  CONSENT_STORAGE_KEY,
  parseStoredConsent,
  serializeConsent,
  toConsentSignals,
  type ConsentChoice,
  type ConsentStatus,
} from "@/lib/consent";

/**
 * A tiny external store for the visitor's consent choice. It reads localStorage, notifies React
 * through useSyncExternalStore (so server and first client render agree on "loading"), and keeps
 * Google Consent Mode in step with every change.
 */

type Gtag = (...args: unknown[]) => void;

const listeners = new Set<() => void>();
let panelOpen = false;
let cachedRaw: string | null | undefined;
let cachedStatus: ConsentStatus = { status: "loading" };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null; // storage blocked: treat as undecided; the choice will last for this page view only
  }
}

function emit() {
  for (const l of listeners) l();
}

function snapshotFor(raw: string | null): ConsentStatus {
  const stored = parseStoredConsent(raw);
  return stored
    ? { status: "decided", analytics: stored.analytics, ads: stored.ads }
    : { status: "undecided" };
}

function getSnapshot(): ConsentStatus {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStatus = snapshotFor(raw);
  }
  return cachedStatus;
}

const SERVER_SNAPSHOT: ConsentStatus = { status: "loading" };
const getServerSnapshot = () => SERVER_SNAPSHOT;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_STORAGE_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function updateGoogleConsent(choice: ConsentChoice) {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (!gtag) return;
  const { ad_storage, analytics_storage, ad_user_data, ad_personalization } =
    toConsentSignals(choice);
  gtag("consent", "update", { ad_storage, analytics_storage, ad_user_data, ad_personalization });
}

export function saveConsent(choice: ConsentChoice) {
  const raw = serializeConsent(choice, new Date().toISOString());
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, raw);
  } catch {
    // Ignore: the choice still applies for this session through the Consent Mode update below.
  }
  cachedRaw = raw;
  cachedStatus = snapshotFor(raw);
  updateGoogleConsent(choice);
  panelOpen = false;
  emit();
}

export function openConsentSettings() {
  panelOpen = true;
  emit();
}

export function closeConsentSettings() {
  panelOpen = false;
  emit();
}

const getPanelSnapshot = () => panelOpen;
const getServerPanelSnapshot = () => false;

export function useConsent() {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const settingsOpen = useSyncExternalStore(subscribe, getPanelSnapshot, getServerPanelSnapshot);
  return {
    status,
    settingsOpen,
    /** True once the visitor has granted analytics cookies. */
    analyticsGranted: status.status === "decided" && status.analytics,
    /** True once the visitor has granted advertising cookies. */
    adsGranted: status.status === "decided" && status.ads,
    acceptAll: () => saveConsent({ analytics: true, ads: true }),
    rejectAll: () => saveConsent({ analytics: false, ads: false }),
    save: saveConsent,
    openSettings: openConsentSettings,
    closeSettings: closeConsentSettings,
  };
}
