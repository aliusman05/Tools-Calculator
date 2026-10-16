/**
 * Advertising configuration. Pure logic: `resolveAdsConfig` takes the environment as an argument
 * so every combination can be unit tested.
 *
 * Ads are OFF unless ALL of these are true:
 *   - NEXT_PUBLIC_ADS_ENABLED is "true"
 *   - NEXT_PUBLIC_ADSENSE_CLIENT is a publisher ID such as "ca-pub-1234567890123456"
 *   - this is not a development server
 *   - this is not a preview deployment (NEXT_PUBLIC_VERCEL_ENV is unset or "production")
 * A slot additionally needs its own ad-unit ID (NEXT_PUBLIC_ADSENSE_SLOT_*); a placement
 * without one renders nothing.
 *
 * Even when enabled, no ad script loads and no ad is requested until the visitor has consented
 * to advertising cookies (see ConsentGate).
 */

export type AdPlacement = "calculatorBelow" | "sidebar" | "inContent" | "pageEnd";

export type AdsEnv = {
  NEXT_PUBLIC_ADS_ENABLED?: string;
  NEXT_PUBLIC_ADSENSE_CLIENT?: string;
  NEXT_PUBLIC_ADS_PLACEHOLDER?: string;
  NEXT_PUBLIC_ADS_TEST_MODE?: string;
  NEXT_PUBLIC_VERCEL_ENV?: string;
  NEXT_PUBLIC_ADSENSE_SLOT_BELOW?: string;
  NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR?: string;
  NEXT_PUBLIC_ADSENSE_SLOT_CONTENT?: string;
  NEXT_PUBLIC_ADSENSE_SLOT_END?: string;
};

export type AdsConfig = {
  enabled: boolean;
  /** Why ads are off, for logs and docs. Null when enabled. */
  disabledReason: string | null;
  client: string;
  /** Show labelled empty boxes of the real size where ads would go (development aid). */
  placeholder: boolean;
  /** Ask AdSense for test ads (data-adtest="on"). */
  testMode: boolean;
  slots: Record<AdPlacement, string>;
  scriptSrc: string;
};

const CLIENT_PATTERN = /^ca-pub-\d{10,}$/;
const SLOT_PATTERN = /^\d{6,}$/;

const slot = (value: string | undefined) =>
  value && SLOT_PATTERN.test(value.trim()) ? value.trim() : "";

export function resolveAdsConfig(env: AdsEnv, nodeEnv: string | undefined): AdsConfig {
  const client = (env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "").trim();
  const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV?.trim();

  let disabledReason: string | null = null;
  if (env.NEXT_PUBLIC_ADS_ENABLED !== "true")
    disabledReason = "NEXT_PUBLIC_ADS_ENABLED is not true";
  else if (!CLIENT_PATTERN.test(client))
    disabledReason = "NEXT_PUBLIC_ADSENSE_CLIENT is missing or invalid";
  else if (nodeEnv === "development") disabledReason = "development server";
  else if (vercelEnv && vercelEnv !== "production") disabledReason = `${vercelEnv} deployment`;

  return {
    enabled: disabledReason === null,
    disabledReason,
    client,
    placeholder:
      disabledReason !== null &&
      (nodeEnv === "development" || env.NEXT_PUBLIC_ADS_PLACEHOLDER === "true"),
    testMode: env.NEXT_PUBLIC_ADS_TEST_MODE === "true",
    slots: {
      calculatorBelow: slot(env.NEXT_PUBLIC_ADSENSE_SLOT_BELOW),
      sidebar: slot(env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR),
      inContent: slot(env.NEXT_PUBLIC_ADSENSE_SLOT_CONTENT),
      pageEnd: slot(env.NEXT_PUBLIC_ADSENSE_SLOT_END),
    },
    scriptSrc: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`,
  };
}

/** True when slots render something (real ads or placeholders) and so take up room in the layout. */
export const adsOccupySpace = (c: AdsConfig) => c.enabled || c.placeholder;

/** The live configuration. NEXT_PUBLIC_* names must be written out in full so Next can inline them. */
export const adsConfig: AdsConfig = resolveAdsConfig(
  {
    NEXT_PUBLIC_ADS_ENABLED: process.env.NEXT_PUBLIC_ADS_ENABLED,
    NEXT_PUBLIC_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
    NEXT_PUBLIC_ADS_PLACEHOLDER: process.env.NEXT_PUBLIC_ADS_PLACEHOLDER,
    NEXT_PUBLIC_ADS_TEST_MODE: process.env.NEXT_PUBLIC_ADS_TEST_MODE,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_ADSENSE_SLOT_BELOW: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BELOW,
    NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
    NEXT_PUBLIC_ADSENSE_SLOT_CONTENT: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CONTENT,
    NEXT_PUBLIC_ADSENSE_SLOT_END: process.env.NEXT_PUBLIC_ADSENSE_SLOT_END,
  },
  process.env.NODE_ENV,
);
