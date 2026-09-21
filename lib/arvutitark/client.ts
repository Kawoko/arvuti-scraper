import { sleep } from "@/lib/utils";
import {
  ARVUTITARK_COUNTRY_HEADER,
  ARVUTITARK_COUNTRY_VALUE,
  ARVUTITARK_DEFAULT_MAX_PAGES,
  ARVUTITARK_DEFAULT_PAGE_DELAY_MS,
  ARVUTITARK_DEFAULT_TIMEOUT_MS,
  ARVUTITARK_LOCALE,
  ARVUTITARK_PER_PAGE,
  ARVUTITARK_RAM_ATTRIBUTES,
  ARVUTITARK_RAM_CATEGORY_ID,
  ARVUTITARK_SORT,
  getScraperConfig,
} from "./config";
import { coerceProductId, dedupeById } from "./normalize";
import type { ArvutitarkPage, ArvutitarkPageMeta, ArvutitarkProduct } from "./types";

/* ==========================================================================
 * Errors
 * ========================================================================== */

export class ArvutitarkApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ArvutitarkApiError";
    this.status = status;
  }
}

/* ==========================================================================
 * Request building
 * ========================================================================== */

export interface ProductPageParams {
  page: number;
  perPage?: number;
  sort?: string;
  attributes?: string;
  category?: number;
  locale?: string;
}

export function buildProductsUrl(baseUrl: string, params: ProductPageParams): string {
  const url = new URL(baseUrl);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("perPage", String(params.perPage ?? ARVUTITARK_PER_PAGE));
  url.searchParams.set("sort", params.sort ?? ARVUTITARK_SORT);
  url.searchParams.set("attributes", params.attributes ?? ARVUTITARK_RAM_ATTRIBUTES);
  url.searchParams.set("categories", String(params.category ?? ARVUTITARK_RAM_CATEGORY_ID));
  url.searchParams.set("locale", params.locale ?? ARVUTITARK_LOCALE);
  return url.toString();
}

/* ==========================================================================
 * Response parsing (defensive: the API shape is not guaranteed)
 * ========================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractProductArray(payload: unknown): ArvutitarkProduct[] | null {
  if (Array.isArray(payload)) return payload as ArvutitarkProduct[];
  if (!isRecord(payload)) return null;

  for (const key of ["data", "products", "items", "results"]) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate as ArvutitarkProduct[];
    // Some Laravel resources nest as { data: { data: [...] } }.
    if (isRecord(candidate) && Array.isArray(candidate.data)) {
      return candidate.data as ArvutitarkProduct[];
    }
  }
  return null;
}

function extractMeta(
  payload: unknown,
  requestedPage: number,
  itemCount: number,
): ArvutitarkPageMeta {
  const record = isRecord(payload) ? payload : {};
  const candidates: Record<string, unknown>[] = [];

  for (const key of ["meta", "pagination", "page"]) {
    const value = record[key];
    if (isRecord(value)) {
      candidates.push(value);
      if (isRecord(value.pagination)) candidates.push(value.pagination);
    }
  }
  candidates.push(record);

  const readFirst = (keys: string[]): number | null => {
    for (const candidate of candidates) {
      for (const key of keys) {
        const raw = candidate[key];
        const parsed = typeof raw === "string" ? Number(raw) : raw;
        if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  };

  const currentPage = readFirst(["current_page", "currentPage", "page"]) ?? requestedPage;
  const declaredLastPage = readFirst(["last_page", "lastPage", "total_pages", "totalPages", "pages"]);
  const perPage = readFirst(["per_page", "perPage", "page_size", "pageSize"]);
  const total = readFirst(["total", "total_items", "totalItems", "count"]);

  const effectivePerPage = perPage !== null && perPage > 0 ? perPage : ARVUTITARK_PER_PAGE;
  let lastPage = declaredLastPage;
  if (lastPage === null || lastPage < currentPage) {
    // No usable pagination metadata: infer from whether this page was full.
    lastPage = itemCount >= effectivePerPage ? currentPage + 1 : currentPage;
  }

  return { currentPage, lastPage, perPage, total };
}

export function parseProductPageResponse(payload: unknown, requestedPage: number): ArvutitarkPage {
  const products = extractProductArray(payload);
  if (products === null) {
    throw new ArvutitarkApiError(
      "Unexpected Arvutitark response shape: no product array found in payload",
    );
  }
  return { products, meta: extractMeta(payload, requestedPage, products.length) };
}

/* ==========================================================================
 * Fetching
 * ========================================================================== */

export type FetchLike = typeof fetch;

export interface FetchOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  baseUrl?: string;
  /** Verbose per-request logging. See `SCRAPER_DEBUG`. */
  debug?: boolean;
  /** Sink for diagnostic messages. Called for every page when `debug` is on. */
  onDebug?: (message: string) => void;
}

export interface FetchAllOptions extends FetchOptions {
  pageDelayMs?: number;
  maxPages?: number;
  /** Arvutitark category id to request. Defaults to the RAM category. */
  category?: number;
  /** Attribute filter to request. Defaults to the RAM filter. */
  attributes?: string;
  onPage?: (info: { page: number; lastPage: number; count: number }) => void;
}

export interface FetchAllResult {
  products: ArvutitarkProduct[];
  pageCount: number;
}

/**
 * Summarise a response payload for diagnostics: root keys plus pagination
 * metadata and the product count.
 *
 * Never includes product bodies (which can be tens of thousands of rows) and
 * never touches environment variables or credentials.
 */
export function describePayloadForDiagnostics(payload: unknown, page: ArvutitarkPage): string {
  const rootKeys = Array.isArray(payload)
    ? "[array]"
    : isRecord(payload)
      ? Object.keys(payload).slice(0, 25).join(",")
      : typeof payload;

  return [
    `root keys: ${rootKeys}`,
    `current_page=${page.meta.currentPage}`,
    `last_page=${page.meta.lastPage}`,
    `per_page=${page.meta.perPage ?? "null"}`,
    `total=${page.meta.total ?? "null"}`,
    `data.length=${page.products.length}`,
  ].join(" ");
}

export async function fetchProductPage(
  params: ProductPageParams,
  options: FetchOptions = {},
): Promise<ArvutitarkPage> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? ARVUTITARK_DEFAULT_TIMEOUT_MS;
  const baseUrl = options.baseUrl ?? getScraperConfig().baseUrl;
  const url = buildProductsUrl(baseUrl, params);
  const debug = options.debug ?? false;
  const debugLog = (message: string) => {
    if (debug) options.onDebug?.(message);
  };

  // The URL contains no credentials, so it is safe to log.
  debugLog(`GET ${url}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        [ARVUTITARK_COUNTRY_HEADER]: ARVUTITARK_COUNTRY_VALUE,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    debugLog(
      `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`.trim(),
    );

    if (!response.ok) {
      throw new ArvutitarkApiError(
        `Arvutitark responded with HTTP ${response.status} ${response.statusText}`.trim(),
        response.status,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ArvutitarkApiError("Arvutitark returned a response that is not valid JSON");
    }

    const page = parseProductPageResponse(payload, params.page);

    if (page.products.length === 0) {
      // An empty page is abnormal and is the exact symptom of a wrong filter,
      // so always report enough metadata to diagnose it, debug flag or not.
      options.onDebug?.(
        `Arvutitark returned 0 products for page ${params.page}. ${describePayloadForDiagnostics(payload, page)}`,
      );
    } else {
      debugLog(describePayloadForDiagnostics(payload, page));
    }

    return page;
  } catch (error) {
    if (error instanceof ArvutitarkApiError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new ArvutitarkApiError(`Arvutitark request timed out after ${timeoutMs}ms`);
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new ArvutitarkApiError(`Arvutitark request failed: ${detail}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch every page of the RAM catalogue.
 *
 * Pagination is followed until the API reports the last page, a page comes back
 * short, or the safety ceiling (`maxPages`) is reached. Requests are spaced out
 * and never retried in a tight loop.
 */
export async function fetchAllProducts(options: FetchAllOptions = {}): Promise<FetchAllResult> {
  const pageDelayMs = options.pageDelayMs ?? ARVUTITARK_DEFAULT_PAGE_DELAY_MS;
  const maxPages = options.maxPages ?? ARVUTITARK_DEFAULT_MAX_PAGES;

  const collected: ArvutitarkProduct[] = [];
  let page = 1;
  let pageCount = 0;

  for (;;) {
    const result = await fetchProductPage(
      { page, category: options.category, attributes: options.attributes },
      options,
    );
    const count = result.products.length;
    pageCount = page;
    collected.push(...result.products);

    options.onPage?.({ page, lastPage: result.meta.lastPage, count });

    const hasMore = page < result.meta.lastPage && count > 0;
    if (!hasMore) break;

    if (page >= maxPages) {
      options.onPage?.({ page, lastPage: result.meta.lastPage, count: -1 });
      break;
    }

    page += 1;
    if (pageDelayMs > 0) await sleep(pageDelayMs);
  }

  const deduped = dedupeById(collected);
  return { products: deduped, pageCount };
}

export { coerceProductId };
