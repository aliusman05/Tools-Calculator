import { isProductionDeploy } from "@/lib/deploy";

/**
 * Google Analytics 4 configuration. Pure logic so every combination can be tested.
 *
 * Analytics is OFF unless NEXT_PUBLIC_GA_ID is a GA4 measurement ID ("G-XXXXXXXXXX"), and it never runs
 * on a development server or a preview deployment. Even then, nothing loads until the visitor has
 * consented to analytics cookies (see ConsentGate).
 */
export type AnalyticsEnv = { NEXT_PUBLIC_GA_ID?: string; NEXT_PUBLIC_VERCEL_ENV?: string };

export type AnalyticsConfig = {
  enabled: boolean;
  disabledReason: string | null;
  measurementId: string;
  scriptSrc: string;
};

const ID_PATTERN = /^G-[A-Z0-9]{6,}$/;

export function resolveAnalyticsConfig(
  env: AnalyticsEnv,
  nodeEnv: string | undefined,
): AnalyticsConfig {
  const id = (env.NEXT_PUBLIC_GA_ID ?? "").trim();
  let disabledReason: string | null = null;
  if (!id) disabledReason = "NEXT_PUBLIC_GA_ID is not set";
  else if (!ID_PATTERN.test(id))
    disabledReason = "NEXT_PUBLIC_GA_ID is not a GA4 measurement ID (G-XXXXXXXXXX)";
  else if (nodeEnv === "development") disabledReason = "development server";
  else if (!isProductionDeploy(env)) disabledReason = `${env.NEXT_PUBLIC_VERCEL_ENV} deployment`;
  return {
    enabled: disabledReason === null,
    disabledReason,
    measurementId: id,
    scriptSrc: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
  };
}

export const analyticsConfig = resolveAnalyticsConfig(
  {
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  process.env.NODE_ENV,
);

/**
 * Parameters for a page_view event. The page address of a calculator carries the numbers the visitor
 * typed (loan amounts, ages, incomes), so the query string and fragment are NEVER sent to Google: only
 * the origin and the path.
 */
export function pageViewParams(origin: string, pathname: string, title: string) {
  return { page_title: title, page_location: `${origin}${pathname}`, page_path: pathname };
}

/** The inline script that configures GA4 for a measurement ID. Automatic page views are turned off. */
export function gaConfigScript(measurementId: string): string {
  return [
    "window.dataLayer = window.dataLayer || [];",
    "window.gtag = window.gtag || function(){dataLayer.push(arguments);};",
    "gtag('js', new Date());",
    `gtag('config', ${JSON.stringify(measurementId)}, {`,
    // We send page views ourselves (see GoogleAnalytics) so the query string is never included.
    "  send_page_view: false,",
    "  allow_google_signals: false,",
    "  allow_ad_personalization_signals: false",
    "});",
  ].join("\n");
}
