/**
 * URL-backed filter contract for the product list.
 *
 * Filters live entirely in the URL query string so any view can be shared or
 * bookmarked. This module is the single source of truth for parsing,
 * serialising and rendering the options.
 */

export const PAGE_SIZE = 24;

export type PriceStatus = "all" | "below_start" | "above_start" | "at_low";
export type AvailabilityFilter = "all" | "in_stock";
export type DiscountThreshold = "any" | "5" | "10" | "15" | "20";
export type SortKey =
  | "biggest_drop"
  | "price_asc"
  | "price_desc"
  | "cl_asc"
  | "speed_desc"
  | "recent"
  | "name";

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
  sort: SortKey;
  page: number;
}

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
  sort: "biggest_drop",
  page: 1,
};

export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "biggest_drop", label: "Biggest price drop" },
  { value: "price_asc", label: "Lowest current price" },
  { value: "price_desc", label: "Highest current price" },
  { value: "cl_asc", label: "Lowest CL" },
  { value: "speed_desc", label: "Highest speed" },
  { value: "recent", label: "Recently updated" },
  { value: "name", label: "Name" },
];

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
const SORT_VALUES: ReadonlyArray<SortKey> = [
  "biggest_drop",
  "price_asc",
  "price_desc",
  "cl_asc",
  "speed_desc",
  "recent",
  "name",
];

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
    sort: readEnum(input, "sort", SORT_VALUES, "biggest_drop"),
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
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildProductHref(pathname: string, filters: ProductFilters): string {
  return `${pathname}${buildProductQuery(filters)}`;
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

export function minDiscountValue(filters: ProductFilters): number | null {
  return filters.minDiscount === "any" ? null : Number(filters.minDiscount);
}

export function toNumberOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
