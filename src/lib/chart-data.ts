/**
 * Turn month-indexed balance arrays (index 0 = start) into chart rows, thinning long series to at
 * most `maxPoints` rows. The first and last month are always included; a series that ends early
 * is treated as 0 afterwards (its balance is paid off).
 */
export function monthlyChartData<K extends string>(
  series: Record<K, readonly number[]>,
  maxPoints = 48,
): Array<Record<K | "month", number>> {
  const keys = Object.keys(series) as K[];
  const lastMonth = Math.max(0, ...keys.map((k) => series[k].length - 1));
  const step = Math.max(1, Math.ceil(lastMonth / maxPoints));

  const months: number[] = [];
  for (let m = 0; m < lastMonth; m += step) months.push(m);
  months.push(lastMonth);

  return months.map((month) => {
    const row = { month } as Record<K | "month", number>;
    for (const k of keys) row[k] = Math.round((series[k][month] ?? 0) * 100) / 100;
    return row;
  });
}
