import type { ProductFilters } from "@/lib/filters";
import type { ProductPriceSummaryRow } from "@/types/database";

/**
 * Small browser-side cache for already-loaded product pages.
 *
 * Product metadata and prices change at most a few times a day, so re-downloading
 * the same page on every visit is wasted work. Each page is stored with the filter
 * signature that produced it and is served instantly while the next batch is
 * fetched on demand.
 *
 * localStorage is used instead of IndexedDB deliberately: the payload is small,
 * synchronous reads let the first paint include cached rows, and the data is safe
 * to discard at any time.
 */
const VERSION = "v1";
const PREFIX = `arvutitark:${VERSION}:products:`;
const TTL_MS = 10 * 60 * 1000;
export const MAX_CACHED_PAGES = 12;

export interface CachedProductPage {
  rows: ProductPriceSummaryRow[];
  savedAt: number;
  total: number;
  pageCount: number;
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

/** Stable key for every filter except pagination. */
export function productCacheSignature(category: string, filters: ProductFilters): string {
  const { page: _page, ...rest } = filters;
  void _page;
  return `${category}|${JSON.stringify(rest)}`;
}

function storageKey(signature: string): string {
  return `${PREFIX}${signature}`;
}

function isFresh(page: CachedProductPage): boolean {
  return Date.now() - page.savedAt <= TTL_MS;
}

/** All fresh cached pages for this view, keyed by page number. */
export function readProductCache(signature: string): Map<number, CachedProductPage> {
  const out = new Map<number, CachedProductPage>();
  if (!hasStorage()) return out;

  try {
    const raw = window.localStorage.getItem(storageKey(signature));
    if (!raw) return out;

    const parsed = JSON.parse(raw) as Record<string, CachedProductPage>;
    for (const [page, value] of Object.entries(parsed)) {
      const pageNumber = Number(page);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) continue;
      if (!value || !Array.isArray(value.rows) || !isFresh(value)) continue;
      out.set(pageNumber, value);
    }
  } catch {
    // Corrupt or quota-limited storage is never a reason to break the page.
  }

  return out;
}

export function writeProductCachePage(
  signature: string,
  page: number,
  value: Omit<CachedProductPage, "savedAt">,
): void {
  if (!hasStorage() || page < 1 || page > MAX_CACHED_PAGES) return;

  try {
    const existing = readProductCache(signature);
    existing.set(page, { ...value, savedAt: Date.now() });

    const serialisable: Record<string, CachedProductPage> = {};
    for (const [pageNumber, cached] of existing) {
      serialisable[String(pageNumber)] = cached;
    }

    window.localStorage.setItem(storageKey(signature), JSON.stringify(serialisable));
  } catch {
    // Ignore quota errors; the network path still works.
  }
}
