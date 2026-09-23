import type { ComponentCategory } from "./types";

/**
 * Static configuration for the Arvutitark scraper.
 *
 * Attribute ids were read off the retailer's own filter UI and confirmed against
 * the live API.
 *
 * RAM (category 20): 27 capacity, 28 speed, 178 memory type, 179 CL,
 *                   180 module layout, 181 form factor, 182 voltage
 * Graphics (cat 18): 15 VRAM, 17 memory type, 110 chipset
 * CPU (cat 15):      18 model, 19 family, 102 socket, 21 cores, 103 threads,
 *                   100 base clock, 20 turbo clock
 * Storage:           23 SSD capacity, 25 HDD capacity, 113 form factor,
 *                   164 interface, 185 read speed, 186 write speed
 */
export const ARVUTITARK_ATTRIBUTE_IDS = {
  // RAM
  capacity: 27,
  speed: 28,
  memoryType: 178,
  casLatency: 179,
  moduleCount: 180,
  formFactor: 181,
  voltage: 182,

  // Storage (HDD and SSD)
  ssdCapacity: 23,
  hddCapacity: 25,
  formFactorStorage: 113,
  interfaceType: 164,
  readSpeed: 185,
  writeSpeed: 186,

  // CPU
  cpuModel: 18,
  cpuFamily: 19,
  cpuSocket: 102,
  cpuCores: 21,
  cpuThreads: 103,
  cpuBaseClock: 100,
  cpuTurboClock: 20,
} as const;

export const ARVUTITARK_GPU_ATTRIBUTE_IDS = {
  memorySize: 15,
  memoryType: 17,
  chipset: 110,
} as const;

/**
 * Maps an Arvutitark category id to our own category.
 *
 * Used to verify that a response actually belongs to the category we asked for:
 * a product the retailer files elsewhere is dropped rather than misfiled. Also
 * used to label custom-tracked items, which have no category of their own.
 */
export const ARVUTITARK_CATEGORY_BY_ID: Record<number, ComponentCategory> = {
  15: "cpu",
  18: "gpu",
  20: "ram",
  137: "hdd",
  139: "ssd",
};

export const ARVUTITARK_RAM_CATEGORY_ID = 20;
export const ARVUTITARK_GPU_CATEGORY_ID = 18;
export const ARVUTITARK_CPU_CATEGORY_ID = 15;
export const ARVUTITARK_HDD_CATEGORY_ID = 137;
export const ARVUTITARK_SSD_CATEGORY_ID = 139;

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
 * Builds a range filter such as `25[1000﹑-﹑5000]`.
 *
 * The bounds are passed through verbatim: the retailer's ranges are not always
 * in the same unit as the parsed product value, so they are preserved exactly
 * rather than reinterpreted.
 */
export function buildAttributeRangeFilter(
  attributeId: number,
  min: string,
  max: string,
): string {
  return buildAttributeFilter(attributeId, [min, "-", max]);
}

/**
 * Pre-encode an attribute value the way Arvutitark's own URLs do.
 *
 * The retailer's filter links contain `%20` for spaces and `%E2%84%A2` for the
 * trademark sign, and the browser then encodes the `%` a second time. Values
 * with spaces or trademark symbols only match when that is reproduced exactly,
 * so this encodes them once here and `URLSearchParams` encodes the `%` again.
 *
 * Written with explicit escapes so it cannot be mangled by an editor.
 */
export function encodeAttributeValue(value: string): string {
  return value
    .replace(/%/g, "%25")
    .replace(/ /g, "%20")
    .replace(/\u2122/g, "%E2%84%A2")
    .replace(/\u00AE/g, "%C2%AE");
}

/* ==========================================================================
 * Filter definitions
 * ========================================================================== */

/** Tracked graphics card chipsets, exactly as Arvutitark names them. */
export const ARVUTITARK_GPU_CHIPSETS: ReadonlyArray<string> = [
  "AMD Radeon\u2122 RX 7000",
  "AMD Radeon\u2122 RX 9060 XT",
  "AMD Radeon\u2122 RX 9070",
  "AMD Radeon\u2122 RX 9070 XT",
  "Intel\u00AE Arc\u2122",
  "NVIDIA GeForce RTX\u2122 5050",
  "NVIDIA GeForce RTX\u2122 5060",
  "NVIDIA GeForce RTX\u2122 5060 Ti",
  "NVIDIA GeForce RTX\u2122 5070",
  "NVIDIA GeForce RTX\u2122 5070 Ti",
  "NVIDIA GeForce RTX\u2122 5080",
  "NVIDIA GeForce RTX\u2122 5090",
];

/** VRAM size we track. 16 GB keeps the tracked set small and comparable. */
export const ARVUTITARK_GPU_VRAM_GB = 16;

/** Tracked CPU families. */
export const ARVUTITARK_CPU_FAMILIES: ReadonlyArray<string> = [
  "AMD Ryzen\u2122 5",
  "AMD Ryzen\u2122 7",
  "AMD Ryzen\u2122 9",
  "Intel\u00AE Core\u2122 Ultra 7",
  "Intel\u00AE Core\u2122 Ultra 9",
  "Intel\u00AE Core\u2122 Ultra 5",
];

/** Tracked CPU sockets. */
export const ARVUTITARK_CPU_SOCKETS: ReadonlyArray<string> = ["AM5", "LGA 1851"];

/** Brands filter for CPUs. This parameter uses an ASCII comma, unlike attributes. */
export const ARVUTITARK_CPU_BRANDS = "intel,amd";

/** HDD capacity range, in gigabytes, exactly as the retailer's filter shows it. */
export const ARVUTITARK_HDD_CAPACITY_RANGE = { min: "1000", max: "5000" } as const;

/** SSD capacity range, in gigabytes, exactly as the retailer's filter shows it. */
export const ARVUTITARK_SSD_CAPACITY_RANGE = { min: "864", max: "31458" } as const;

/** SSD read-speed range in MB/s. */
export const ARVUTITARK_SSD_READ_RANGE = { min: "3500", max: "14900" } as const;

/** SSD write-speed range in MB/s. */
export const ARVUTITARK_SSD_WRITE_RANGE = { min: "3500", max: "14000" } as const;

/**
 * The RAM filter string we send to the API. Availability (`shops=...`) is
 * deliberately NOT included: we want historical coverage of every tracked
 * product and record availability separately instead.
 */
export const ARVUTITARK_RAM_ATTRIBUTES = [
  buildAttributeFilter(ARVUTITARK_ATTRIBUTE_IDS.speed, ["5600", "6000"]),
  buildAttributeFilter(ARVUTITARK_ATTRIBUTE_IDS.memoryType, ["DDR5"]),
  buildAttributeFilter(ARVUTITARK_ATTRIBUTE_IDS.formFactor, ["UDIMM"]),
].join(";");

export const ARVUTITARK_GPU_ATTRIBUTES = [
  buildAttributeFilter(ARVUTITARK_GPU_ATTRIBUTE_IDS.memorySize, [
    String(ARVUTITARK_GPU_VRAM_GB),
  ]),
  buildAttributeFilter(
    ARVUTITARK_GPU_ATTRIBUTE_IDS.chipset,
    ARVUTITARK_GPU_CHIPSETS.map(encodeAttributeValue),
  ),
].join(";");

export const ARVUTITARK_CPU_ATTRIBUTES = [
  buildAttributeFilter(
    ARVUTITARK_ATTRIBUTE_IDS.cpuFamily,
    ARVUTITARK_CPU_FAMILIES.map(encodeAttributeValue),
  ),
  buildAttributeFilter(
    ARVUTITARK_ATTRIBUTE_IDS.cpuSocket,
    ARVUTITARK_CPU_SOCKETS.map(encodeAttributeValue),
  ),
].join(";");

export const ARVUTITARK_HDD_ATTRIBUTES = buildAttributeRangeFilter(
  ARVUTITARK_ATTRIBUTE_IDS.hddCapacity,
  ARVUTITARK_HDD_CAPACITY_RANGE.min,
  ARVUTITARK_HDD_CAPACITY_RANGE.max,
);

export const ARVUTITARK_SSD_ATTRIBUTES = [
  buildAttributeRangeFilter(
    ARVUTITARK_ATTRIBUTE_IDS.ssdCapacity,
    ARVUTITARK_SSD_CAPACITY_RANGE.min,
    ARVUTITARK_SSD_CAPACITY_RANGE.max,
  ),
  buildAttributeRangeFilter(
    ARVUTITARK_ATTRIBUTE_IDS.readSpeed,
    ARVUTITARK_SSD_READ_RANGE.min,
    ARVUTITARK_SSD_READ_RANGE.max,
  ),
  buildAttributeRangeFilter(
    ARVUTITARK_ATTRIBUTE_IDS.writeSpeed,
    ARVUTITARK_SSD_WRITE_RANGE.min,
    ARVUTITARK_SSD_WRITE_RANGE.max,
  ),
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

/* ==========================================================================
 * Runtime configuration
 * ========================================================================== */

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

/**
 * Comma-separated allow-list of groups to collect.
 *
 * Lets a single group be exercised on its own without editing code, e.g.
 * `SCRAPER_GROUPS=cpu` or `SCRAPER_GROUPS=ram,gpu,custom`.
 */
export function readListEnv(key: string, fallback: string[], env: EnvRecord = process.env): string[] {
  const raw = env[key];
  if (!raw || raw.trim() === "") return fallback;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

export interface ScraperRuntimeConfig {
  baseUrl: string;
  requestTimeoutMs: number;
  pageDelayMs: number;
  maxPages: number;
  /** Verbose request/response logging. Enabled with `SCRAPER_DEBUG=true`. */
  debug: boolean;
  /** Groups to collect; defaults to every registered category plus custom items. */
  groups: string[];
  /**
   * Attribute filter override for graphics cards. Set `ARVUTITARK_GPU_ATTRIBUTES`
   * to `15[16]` to drop the chipset filter if it ever stops matching.
   */
  gpuAttributes: string;
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
    groups: readListEnv("SCRAPER_GROUPS", ["ram", "gpu", "cpu", "hdd", "ssd", "custom"], env),
    gpuAttributes: readEnv("ARVUTITARK_GPU_ATTRIBUTES", ARVUTITARK_GPU_ATTRIBUTES, env),
  };
}
