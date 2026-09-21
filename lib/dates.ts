/**
 * Date helpers.
 *
 * The scraper's "one attempt per day" rule is anchored to the Estonian
 * (Europe/Tallinn) calendar, not UTC and not the server's local timezone.
 */
export const TALLINN_TIME_ZONE = "Europe/Tallinn";

const tallinnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TALLINN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns the current calendar date in Estonia as `YYYY-MM-DD`.
 *
 * `en-CA` is used deliberately: its short date format is already ISO-shaped,
 * so no manual padding or locale guessing is required.
 */
export function getTallinnDate(instant: Date = new Date()): string {
  return tallinnDateFormatter.format(instant);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Signed difference in whole days between two `YYYY-MM-DD` strings. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export function isoDateToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
