/**
 * URL-backed filter and sort contract for the product list.
 *
 * Everything lives in the query string so any view can be shared or bookmarked.
 * This module is the single source of truth for parsing, serialising and
 * rendering the options.
 *
 * Sorting is modelled as a column + direction pair rather than a single opaque
 * key, so a table header can simply flip the direction of the column it owns.
 */

export const PAGE_SIZE = 24;

export type PriceStatus = "all" | "below_start" | "above_start" | "at_low";
export type AvailabilityFilter = "all" | "in_stock";
export type DiscountThreshold = "any" | "5" | "10" | "15" | "20";

/** Sortable columns. Each maps to one column in `product_price_summary`. */
export type SortColumn =
  | "change"
  | "price"
  | "start"
  | "lowest"
  | "cl"
  | "speed"
  | "updated"
  | "name";

export type SortDirection = "asc" | "desc";

export interface ProductFilters {
  q: string;
  brand: string;
  capacityGb: string;
  speedMhz: string;
  casLatency: string;
  moduleCount: string;
  availability: AvailabilityFilter;
  priceStatus: PriceStatus;
  minDiscount: DiscountThreshold;
  sort: SortColumn;
  dir: SortDirection;
  page: number;
}

/** Default view: biggest percentage drop from our recorded starting price. */
export const DEFAULT_SORT: SortColumn = "change";
export const DEFAULT_DIRECTION: SortDirection = "asc";

export const DEFAULT_FILTERS: ProductFilters = {
  q: "",
  brand: "",
  capacityGb: "",
  speedMhz: "",
  casLatency: "",
  moduleCount: "",
  availability: "all",
  priceStatus: "all",
  minDiscount: "any",
  sort: DEFAULT_SORT,
  dir: DEFAULT_DIRECTION,
  page: 1,
};

/** Direction applied when a column is sorted for the first time. */
export const COLUMN_DEFAULT_DIRECTION: Record<SortColumn, SortDirection> = {
  change: "asc", // most negative first => biggest drop
  price: "asc", // cheapest first
  start: "asc",
  lowest: "asc",
  cl: "asc",
  speed: "desc", // fastest first
  updated: "desc", // most recent first
  name: "asc",
};

export const COLUMN_LABELS: Record<SortColumn, string> = {
  change: "Price change",
  price: "Current price",
  start: "Start price",
  lowest: "Lowest price",
  cl: "CAS latency",
  speed: "Speed",
  updated: "Last updated",
  name: "Name",
};

export const SORT_DIRECTIONS: ReadonlyArray<SortDirection> = ["asc", "desc"];

export const SORT_COLUMNS: ReadonlyArray<SortColumn> = [
  "change",
  "price",
  "start",
  "lowest",
  "cl",
  "speed",
  "updated",
  "name",
];

export interface SortOption {
  /** Composite value used by the toolbar's select control. */
  value: string;
  label: string;
  sort: SortColumn;
  dir: SortDirection;
}

export const SORT_OPTIONS: ReadonlyArray<SortOption> = [
  { value: "change:asc", label: "Biggest price drop", sort: "change", dir: "asc" },
  { value: "price:asc", label: "Lowest current price", sort: "price", dir: "asc" },
  { value: "price:desc", label: "Highest current price", sort: "price", dir: "desc" },
  { value: "cl:asc", label: "Lowest CL", sort: "cl", dir: "asc" },
  { value: "speed:desc", label: "Highest speed", sort: "speed", dir: "desc" },
  { value: "updated:desc", label: "Recently updated", sort: "updated", dir: "desc" },
  { value: "name:asc", label: "Name", sort: "name", dir: "asc" },
];

export function sortOptionValue(sort: SortColumn, dir: SortDirection): string {
  return `${sort}:${dir}`;
}

/** Human-readable description of the current ordering. */
export function describeSort(sort: SortColumn, dir: SortDirection): string {
  const preset = SORT_OPTIONS.find((option) => option.sort === sort && option.dir === dir);
  if (preset) return preset.label;
  return `${COLUMN_LABELS[sort]} · ${dir === "asc" ? "ascending" : "descending"}`;
}

/**
 * Direction a header click should apply: flip when the column already owns the
 * sort, otherwise use that column's natural default.
 */
export function nextSortDirection(
  column: SortColumn,
  current: Pick<ProductFilters, "sort" | "dir">,
): SortDirection {
  if (current.sort !== column) return COLUMN_DEFAULT_DIRECTION[column];
  return current.dir === "asc" ? "desc" : "asc";
}

export const PRICE_STATUS_OPTIONS: ReadonlyArray<{ value: PriceStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "below_start", label: "Below starting price" },
  { value: "above_start", label: "Above starting price" },
  { value: "at_low", label: "At historical low" },
];

export const DISCOUNT_OPTIONS: ReadonlyArray<{ value: DiscountThreshold; label: string }> = [
  { value: "any", label: "Any" },
  { value: "5", label: "≥ 5% cheaper" },
  { value: "10", label: "≥ 10% cheaper" },
  { value: "15", label: "≥ 15% cheaper" },
  { value: "20", label: "≥ 20% cheaper" },
];

export const AVAILABILITY_OPTIONS: ReadonlyArray<{ value: AvailabilityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In stock only" },
];

export type SearchParamsInput = Record<string, string | string[] | undefined>;

function readFirst(input: SearchParamsInput, key: string): string | null {
  const value = input[key];
  if (Array.isArray(value)) {
    const first = value.find((item) => item !== undefined && item !== "");
    return first ?? null;
  }
  if (typeof value === "string" && value !== "") return value;
  return null;
}

function readPositiveInt(input: SearchParamsInput, key: string): string {
  const value = readFirst(input, key);
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(Math.trunc(parsed)) : "";
}

function readEnum<T extends string>(
  input: SearchParamsInput,
  key: string,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  const value = readFirst(input, key);
  if (value && (allowed as ReadonlyArray<string>).includes(value)) return value as T;
  return fallback;
}

const PRICE_STATUS_VALUES: ReadonlyArray<PriceStatus> = ["all", "below_start", "above_start", "at_low"];
const AVAILABILITY_VALUES: ReadonlyArray<AvailabilityFilter> = ["all", "in_stock"];
const DISCOUNT_VALUES: ReadonlyArray<DiscountThreshold> = ["any", "5", "10", "15", "20"];

export function parseProductFilters(input: SearchParamsInput): ProductFilters {
  const pageRaw = readFirst(input, "page");
  const pageNumber = pageRaw ? Number(pageRaw) : 1;

  return {
    q: (readFirst(input, "q") ?? "").slice(0, 120),
    brand: readFirst(input, "brand") ?? "",
    capacityGb: readPositiveInt(input, "capacity"),
    speedMhz: readPositiveInt(input, "speed"),
    casLatency: readPositiveInt(input, "cl"),
    moduleCount: readPositiveInt(input, "modules"),
    availability: readEnum(input, "availability", AVAILABILITY_VALUES, "all"),
    priceStatus: readEnum(input, "price", PRICE_STATUS_VALUES, "all"),
    minDiscount: readEnum(input, "discount", DISCOUNT_VALUES, "any"),
    sort: readEnum(input, "sort", SORT_COLUMNS, DEFAULT_SORT),
    dir: readEnum(input, "dir", SORT_DIRECTIONS, DEFAULT_DIRECTION),
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? Math.trunc(pageNumber) : 1,
  };
}

/** Serialise filters back into a query string, omitting values at their default. */
export function buildProductQuery(filters: ProductFilters): string {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.capacityGb) params.set("capacity", filters.capacityGb);
  if (filters.speedMhz) params.set("speed", filters.speedMhz);
  if (filters.casLatency) params.set("cl", filters.casLatency);
  if (filters.moduleCount) params.set("modules", filters.moduleCount);
  if (filters.availability !== "all") params.set("availability", filters.availability);
  if (filters.priceStatus !== "all") params.set("price", filters.priceStatus);
  if (filters.minDiscount !== "any") params.set("discount", filters.minDiscount);
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  if (filters.dir !== DEFAULT_DIRECTION) params.set("dir", filters.dir);
  if (filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildProductHref(pathname: string, filters: ProductFilters): string {
  return `${pathname}${buildProductQuery(filters)}`;
}

/** Href for clicking a table column header: toggles direction, resets paging. */
export function buildSortHref(
  pathname: string,
  filters: ProductFilters,
  column: SortColumn,
): string {
  return buildProductHref(pathname, {
    ...filters,
    sort: column,
    dir: nextSortDirection(column, filters),
    page: 1,
  });
}

export function countActiveFilters(filters: ProductFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.brand) count += 1;
  if (filters.capacityGb) count += 1;
  if (filters.speedMhz) count += 1;
  if (filters.casLatency) count += 1;
  if (filters.moduleCount) count += 1;
  if (filters.availability !== "all") count += 1;
  if (filters.priceStatus !== "all") count += 1;
  if (filters.minDiscount !== "any") count += 1;
  return count;
}

export function hasActiveFilters(filters: ProductFilters): boolean {
  return countActiveFilters(filters) > 0;
}

/** Reset every filter while preserving the user's chosen sort order. */
export function withoutFilters(filters: ProductFilters): ProductFilters {
  return { ...DEFAULT_FILTERS, sort: filters.sort, dir: filters.dir };
}

export function minDiscountValue(filters: ProductFilters): number | null {
  return filters.minDiscount === "any" ? null : Number(filters.minDiscount);
}

export function toNumberOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
