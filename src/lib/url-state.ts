/**
 * Read/write calculator inputs to the query string so results are shareable.
 * Values are numbers (null = empty) or strings. Only values that differ from the defaults are written.
 */

export type StateValue = number | string | null;
export type StateRecord = Record<string, StateValue>;

export function parseParams<T extends StateRecord>(search: string, defaults: T): T {
  const params = new URLSearchParams(search);
  const next: StateRecord = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const raw = params.get(key);
    if (raw === null) continue;
    const fallback = defaults[key];
    if (typeof fallback === "string") {
      next[key] = raw;
    } else if (raw === "") {
      next[key] = null;
    } else {
      const n = Number(raw);
      if (Number.isFinite(n)) next[key] = n;
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

/**
 * The query string to put in the address bar: the calculator's own parameters (only those that
 * differ from the defaults) merged into whatever is already there, so unrelated parameters such as
 * `utm_source` survive. Returns the string without a leading "?".
 */
export function applyParams<T extends StateRecord>(search: string, values: T, defaults: T): string {
  const params = new URLSearchParams(search);
  for (const key of Object.keys(defaults)) params.delete(key);
  for (const [key, value] of new URLSearchParams(serializeParams(values, defaults))) {
    params.set(key, value);
  }
  return params.toString();
}
