"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConsent } from "@/lib/consent-store";

type Choice = { analytics: boolean; ads: boolean };

/**
 * Cookie consent banner. Equal-weight "Accept all" and "Reject all" buttons, plus a customize
 * panel with one switch per optional category. It is fixed to the bottom of the viewport, so it
 * never pushes page content around (no layout shift). Nothing optional loads until the visitor
 * chooses; see src/lib/consent.ts.
 *
 * It is rendered on the server, so a first-time visitor sees it with the very first paint instead of
 * after the page has hydrated. (That also keeps it from becoming the page's "largest contentful
 * paint", which would delay that metric until hydration.) Before hydration the server cannot know
 * whether the visitor has already chosen, so the markup carries `data-ssr`, and the inline script in
 * <head> sets `data-consent="decided"` on <html> for returning visitors; globals.css hides the banner
 * in that case before anything is painted. Once hydrated, the real state takes over.
 */
export function ConsentBanner() {
  const consent = useConsent();
  const loading = consent.status.status === "loading";
  const open = loading || consent.status.status === "undecided" || consent.settingsOpen;
  if (!open) return null;

  const current: Choice =
    consent.status.status === "decided"
      ? { analytics: consent.status.analytics, ads: consent.status.ads }
      : { analytics: false, ads: false };

  return (
    <Panel
      // Remount when reopened so the switches start from the saved choice.
      key={consent.settingsOpen ? "settings" : "first"}
      initial={current}
      startCustomizing={consent.settingsOpen}
      canDismiss={consent.status.status === "decided"}
      serverRendered={loading}
      onAcceptAll={consent.acceptAll}
      onRejectAll={consent.rejectAll}
      onSave={consent.save}
      onClose={consent.closeSettings}
    />
  );
}

function Panel({
  initial,
  startCustomizing,
  canDismiss,
  serverRendered,
  onAcceptAll,
  onRejectAll,
  onSave,
  onClose,
}: {
  initial: Choice;
  startCustomizing: boolean;
  canDismiss: boolean;
  /** True until hydration finishes, while the server cannot know the visitor's stored choice. */
  serverRendered: boolean;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: (choice: Choice) => void;
  onClose: () => void;
}) {
  const [customizing, setCustomizing] = useState(startCustomizing);
  const [choice, setChoice] = useState(initial);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Only pull focus when the visitor asked to change their settings; the first-visit banner
    // must not steal focus from the page.
    if (startCustomizing) headingRef.current?.focus();
  }, [startCustomizing]);

  useEffect(() => {
    if (!canDismiss) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canDismiss, onClose]);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
      data-ssr={serverRendered ? "true" : undefined}
      className="consent-banner border-border bg-surface fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto border-t p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.18)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <h2 id="consent-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
          Your privacy choices
        </h2>
        <p id="consent-text" className="text-muted max-w-3xl text-sm">
          We use a small number of essential cookies and storage to run the site. With your
          permission we would also use analytics cookies to understand how the calculators are used,
          and advertising cookies (including from Google) to show ads that help keep the site free.
          Your calculator inputs are never sent to us. You can change your mind at any time in
          Cookie settings. See our{" "}
          <Link href="/privacy-policy" className="text-accent underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>

        {customizing && (
          <fieldset className="border-border rounded-card flex flex-col gap-3 border p-3">
            <legend className="px-1 text-sm font-semibold">Cookie categories</legend>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked disabled className="accent-accent mt-1 size-5" />
              <span>
                <span className="block font-medium">Strictly necessary</span>
                <span className="text-muted">
                  Needed for security and to remember this choice. Always on.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={choice.analytics}
                onChange={(e) => setChoice({ ...choice, analytics: e.target.checked })}
                className="accent-accent mt-1 size-5"
              />
              <span>
                <span className="block font-medium">Analytics</span>
                <span className="text-muted">
                  Anonymous statistics on which pages and calculators are used.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={choice.ads}
                onChange={(e) => setChoice({ ...choice, ads: e.target.checked })}
                className="accent-accent mt-1 size-5"
              />
              <span>
                <span className="block font-medium">Advertising</span>
                <span className="text-muted">
                  Cookies from ad partners to show and measure ads, including personalized ads.
                </span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={onAcceptAll}>Accept all</Button>
          <Button onClick={onRejectAll}>Reject all</Button>
          {customizing ? (
            <Button variant="secondary" onClick={() => onSave(choice)}>
              Save my choices
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setCustomizing(true)}>
              Customize
            </Button>
          )}
          {canDismiss && (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
