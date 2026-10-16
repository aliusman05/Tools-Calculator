/** Keep only digits and a single decimal point. */
export function sanitizeNumeric(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

/** Add thousands separators to a sanitized numeric string, preserving what the user typed after the dot. */
export function groupThousands(sanitized: string): string {
  const [int = "", frac] = sanitized.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/** Display string -> number, or NaN when empty. */
export function parseDisplayNumber(display: string): number {
  const s = sanitizeNumeric(display);
  return s === "" || s === "." ? Number.NaN : Number(s);
}
