/**
 * Share links for calculators.
 *
 * Calculator inputs are never written to the address bar while a visitor types. They travel in a URL
 * only when the visitor presses "Copy link" (see ShareLink), and a visitor who opens such a link has
 * the values read once, applied, and removed from the address.
 *
 * Values are numbers (null = empty) or strings. Only values that differ from the defaults are written.
 */

export type StateValue = number | string | null;
export type StateRecord = Record<string, StateValue>;

/** Numbers from a link are clamped to this range so a hand-edited link cannot feed absurd values in. */
export const MAX_SHARED_NUMBER = 1_000_000_000_000;
/** Text values (modes such as "years" or "percent") must be short and plain. */
const SHARED_TEXT = /^[\w .-]{0,40}$/;

export function parseParams<T extends StateRecord>(search: string, defaults: T): T {
  const params = new URLSearchParams(search);
  const next: StateRecord = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const raw = params.get(key);
    if (raw === null) continue;
    const fallback = defaults[key];
    if (typeof fallback === "string") {
      if (SHARED_TEXT.test(raw)) next[key] = raw;
    } else if (raw.trim() === "") {
      next[key] = null;
    } else {
      const n = Number(raw);
      if (Number.isFinite(n))
        next[key] = Math.min(MAX_SHARED_NUMBER, Math.max(-MAX_SHARED_NUMBER, n));
    }
  }
  return next as T;
}

export function serializeParams<T extends StateRecord>(values: T, defaults: T): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults)) {
    const value = values[key];
    if (value === defaults[key]) continue;
    params.set(key, value === null || value === undefined ? "" : String(value));
  }
  return params.toString();
}

/** True when the query string carries at least one of the calculator's own parameters. */
export function hasCalculatorParams(search: string, defaults: StateRecord): boolean {
  const params = new URLSearchParams(search);
  return Object.keys(defaults).some((key) => params.has(key));
}

/**
 * The query string to leave in the address bar after a shared link has been read: the calculator's
 * own parameters removed, unrelated ones (such as `utm_source`) kept. No leading "?".
 */
export function stripParams(search: string, defaults: StateRecord): string {
  const params = new URLSearchParams(search);
  for (const key of Object.keys(defaults)) params.delete(key);
  return params.toString();
}

/** The link to copy: this page, plus only the inputs that differ from the defaults. */
export function buildShareUrl<T extends StateRecord>(
  origin: string,
  pathname: string,
  values: T,
  defaults: T,
): string {
  const query = serializeParams(values, defaults);
  return `${origin}${pathname}${query ? `?${query}` : ""}`;
}
