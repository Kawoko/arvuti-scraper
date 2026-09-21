export type PriceDirection = "down" | "up" | "same";

/**
 * Percentage change between two prices.
 *
 * `start` is the earliest price recorded in OUR database, never the retailer's
 * `original_price` field. Returns `null` when it cannot be computed, rather
 * than a misleading number.
 */
export function computePriceChangePercent(
  current: number | null | undefined,
  start: number | null | undefined,
): number | null {
  if (current === null || current === undefined) return null;
  if (start === null || start === undefined || start === 0) return null;
  return ((current - start) / start) * 100;
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function directionFromChange(change: number | null | undefined): PriceDirection {
  if (change === null || change === undefined || change === 0) return "same";
  return change < 0 ? "down" : "up";
}

export function directionFromPercent(percent: number | null | undefined): PriceDirection {
  if (percent === null || percent === undefined || percent === 0) return "same";
  return percent < 0 ? "down" : "up";
}
