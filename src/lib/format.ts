import { siteConfig } from "./site-config";

export type FormatOptions = {
  locale?: string;
  currency?: string;
};

/** Format dollars (or another currency). Values are rounded here, at display time only. */
export function formatCurrency(
  value: number,
  {
    locale = siteConfig.defaultLocale,
    currency = siteConfig.defaultCurrency,
    decimals = 2,
  }: FormatOptions & {
    decimals?: number;
  } = {},
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format a fraction as a percent: 0.065 -> "6.50%". */
export function formatPercent(
  fraction: number,
  { locale = siteConfig.defaultLocale, decimals = 2 }: { locale?: string; decimals?: number } = {},
): string {
  if (!Number.isFinite(fraction)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fraction);
}

export function formatNumber(
  value: number,
  { locale = siteConfig.defaultLocale, decimals = 0 }: { locale?: string; decimals?: number } = {},
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** 27 -> "2 years 3 months". */
export function formatDuration(totalMonths: number): string {
  if (!Number.isFinite(totalMonths) || totalMonths < 0) return "—";
  const years = Math.floor(totalMonths / 12);
  const months = Math.round(totalMonths - years * 12);
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (months > 0 || parts.length === 0)
    parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  return parts.join(" ");
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** month is 1-12. Avoids Date so output is identical on server and client. */
export function formatMonthYear(month: number, year: number, short = false): string {
  const name = MONTH_NAMES[month - 1] ?? "";
  return `${short ? name.slice(0, 3) : name} ${year}`;
}

/** "2026-10-16" -> "October 16, 2026". Parses the string directly (no timezone shifts). */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}
