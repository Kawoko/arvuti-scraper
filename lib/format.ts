const currencyFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Tallinn",
});

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Tallinn",
});

export const EMPTY_VALUE = "—";

/** `€159.90`, or `—` when the value is missing. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return currencyFormatter.format(value);
}

/** `-14.3%` with an explicit sign, or `—`. */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/** `-€20.00` / `+€5.00` with an explicit sign, or `—`. */
export function formatSignedCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${currencyFormatter.format(Math.abs(value))}`;
}

/** `Sep 21, 2026`. */
export function formatDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return shortDateFormatter.format(date);
}

/** `21 Sep`. */
export function formatDayMonth(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return dayMonthFormatter.format(date);
}

/** `21 Sep 2026, 09:04` in Tallinn time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Tallinn",
  }).format(date);
}

/** `2 days ago`, `today`, `yesterday`. */
export function formatRelativeDays(iso: string | null | undefined, today: string): string {
  if (!iso) return EMPTY_VALUE;
  const parse = (value: string) => Date.parse(`${value}T00:00:00Z`);
  const from = parse(iso);
  const to = parse(today);
  if (Number.isNaN(from) || Number.isNaN(to)) return EMPTY_VALUE;
  const days = Math.round((to - from) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatDuration(startedIso: string | null, finishedIso: string | null): string {
  if (!startedIso || !finishedIso) return EMPTY_VALUE;
  const start = Date.parse(startedIso);
  const finish = Date.parse(finishedIso);
  if (Number.isNaN(start) || Number.isNaN(finish)) return EMPTY_VALUE;
  const seconds = Math.max(0, Math.round((finish - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}
