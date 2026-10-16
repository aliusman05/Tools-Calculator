/** Calculator inputs are `number | null` (null = empty). These map them onto engine inputs. */

/** Required field: an empty box becomes NaN so validation reports it. */
export const required = (v: number | null): number => (v === null ? Number.NaN : v);

/** Optional field: an empty box counts as 0. */
export const optional = (v: number | null): number => v ?? 0;

/** Valid calendar month (1-12) or a fallback. */
export function validMonth(v: number | null, fallback = 1): number {
  return v !== null && Number.isInteger(v) && v >= 1 && v <= 12 ? v : fallback;
}

/** Valid year or a fallback. */
export function validYear(v: number | null, fallback: number): number {
  return v !== null && Number.isInteger(v) && v >= 1900 && v <= 2200 ? v : fallback;
}
