/**
 * Static configuration for the Arvutitark scraper.
 *
 * Attribute ids come from the retailer's own filter UI:
 *   27  = Capacity
 *   28  = Speed
 *   178 = Memory type
 *   179 = CAS latency / CL
 *   180 = Module count / layout
 *   181 = Form factor
 *   182 = Voltage
 */
export const ARVUTITARK_ATTRIBUTE_IDS = {
  capacity: 27,
  speed: 28,
  memoryType: 178,
  casLatency: 179,
  moduleCount: 180,
  formFactor: 181,
  voltage: 182,
} as const;

/** Category id 20 = "Malud (RAM)" in the Arvutitark catalogue. */
export const ARVUTITARK_RAM_CATEGORY_ID = 20;

/**
 * Separator between multiple values inside a single attribute filter.
 *
 * This is NOT an ASCII comma. Arvutitark's own filter UI emits U+FE50 SMALL
 * COMMA. Sending a normal comma makes the API treat the filter as unmatched and
 * return an empty result set, so this is written as an explicit escape rather
 * than a literal character to keep it immune to editor/encoding mangling.
 */
export const ARVUTITARK_MULTI_VALUE_SEPARATOR = "\uFE50";

/** Builds `28[5600﹑6000]`-style attribute filters using the correct separator. */
export function buildAttributeFilter(
  attributeId: number,
  values: ReadonlyArray<string>,
): string {
  return `${attributeId}[${values.join(ARVUTITARK_MULTI_VALUE_SEPARATOR)}]`;
}

/**
 * The filter string we send to the API. Availability (`shops=...`) is
 * deliberately NOT included: we want historical coverage of every tracked
 * product and record availability separately instead.
 */
export const ARVUTITARK_RAM_ATTRIBUTES = [
  buildAttributeFilter(ARVUTITARK_ATTRIBUTE_IDS.speed, ["5600", "6000"]),
  buildAttributeFilter(ARVUTITARK_ATTRIBUTE_IDS.memoryType, ["DDR5"]),
  buildAttributeFilter(ARVUTITARK_ATTRIBUTE_IDS.formFactor, ["UDIMM"]),
].join(";");

export const ARVUTITARK_SORT = "price-asc";
export const ARVUTITARK_LOCALE = "et";
export const ARVUTITARK_PER_PAGE = 200;

export const ARVUTITARK_DEFAULT_BASE_URL = "https://cms.arvutitark.ee/api/products";
export const ARVUTITARK_PRODUCT_BASE_URL = "https://arvutitark.ee";

export const ARVUTITARK_DEFAULT_TIMEOUT_MS = 20_000;
export const ARVUTITARK_DEFAULT_PAGE_DELAY_MS = 750;
export const ARVUTITARK_DEFAULT_MAX_PAGES = 50;

/** Company sends this to select the Estonian storefront. */
export const ARVUTITARK_COUNTRY_HEADER = "X-Arv-Country";
export const ARVUTITARK_COUNTRY_VALUE = "est";

/**
 * Environment bag.
 *
 * Deliberately looser than `NodeJS.ProcessEnv` (which Next.js augments with a
 * required `NODE_ENV`) so callers and tests can pass a partial map.
 */
export type EnvRecord = Record<string, string | undefined>;

export function readEnv(
  key: string,
  fallback: string | undefined,
  env: EnvRecord = process.env,
): string {
  const value = env[key];
  if (value && value.trim() !== "") return value.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

export function readNumericEnv(
  key: string,
  fallback: number,
  env: EnvRecord = process.env,
): number {
  const raw = env[key];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface ScraperRuntimeConfig {
  baseUrl: string;
  requestTimeoutMs: number;
  pageDelayMs: number;
  maxPages: number;
  /** Verbose request/response logging. Enabled with `SCRAPER_DEBUG=true`. */
  debug: boolean;
}

/**
 * Opt-in verbose logging. Accepts the usual truthy spellings so
 * `SCRAPER_DEBUG=1` works as well as `SCRAPER_DEBUG=true`.
 */
export function readBooleanEnv(
  key: string,
  fallback = false,
  env: EnvRecord = process.env,
): boolean {
  const raw = env[key];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export function getScraperConfig(env: EnvRecord = process.env): ScraperRuntimeConfig {
  return {
    baseUrl: readEnv("ARVUTITARK_BASE_URL", ARVUTITARK_DEFAULT_BASE_URL, env),
    requestTimeoutMs: readNumericEnv(
      "ARVUTITARK_REQUEST_TIMEOUT_MS",
      ARVUTITARK_DEFAULT_TIMEOUT_MS,
      env,
    ),
    pageDelayMs: readNumericEnv("ARVUTITARK_PAGE_DELAY_MS", ARVUTITARK_DEFAULT_PAGE_DELAY_MS, env),
    maxPages: readNumericEnv("ARVUTITARK_MAX_PAGES", ARVUTITARK_DEFAULT_MAX_PAGES, env),
    debug: readBooleanEnv("SCRAPER_DEBUG", false, env),
  };
}
