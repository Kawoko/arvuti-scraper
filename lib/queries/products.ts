import { PAGE_SIZE, minDiscountValue, toNumberOrNull, type ProductFilters } from "@/lib/filters";
import { getSupabaseReadClient } from "@/lib/supabase/server";
import type { ProductPriceSummaryRow } from "@/types/database";
import { DataAccessError } from "./errors";

/**
 * Columns needed by the product list. The summary view is queried instead of
 * the full price history so list rendering never touches historical rows.
 */
const LIST_COLUMNS = [
  "product_id",
  "name",
  "name_en",
  "brand",
  "url",
  "memory_type",
  "capacity_gb",
  "speed_mhz",
  "cas_latency",
  "module_count",
  "capacity_per_module_gb",
  "form_factor",
  "start_date",
  "start_price",
  "current_date",
  "current_price",
  "current_observed_at",
  "price_change",
  "price_change_percent",
  "lowest_price",
  "current_total_stock",
  "in_stock",
  "is_below_start_price",
  "is_at_historical_low",
].join(",");

export interface ProductListResult {
  rows: ProductPriceSummaryRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Strip characters that would break PostgREST's `or` filter syntax. */
function sanitizeSearchTerm(value: string): string {
  return value
    .replace(/[%,()*\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getProductList(filters: ProductFilters): Promise<ProductListResult> {
  const supabase = getSupabaseReadClient();

  let query = supabase
    .from("product_price_summary")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("category", "ram");

  const term = sanitizeSearchTerm(filters.q);
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(`name.ilike.${pattern},name_en.ilike.${pattern},brand.ilike.${pattern}`);
  }

  if (filters.brand) query = query.eq("brand", filters.brand);

  const capacity = toNumberOrNull(filters.capacityGb);
  if (capacity !== null) query = query.eq("capacity_gb", capacity);

  const speed = toNumberOrNull(filters.speedMhz);
  if (speed !== null) query = query.eq("speed_mhz", speed);

  const casLatency = toNumberOrNull(filters.casLatency);
  if (casLatency !== null) query = query.eq("cas_latency", casLatency);

  const moduleCount = toNumberOrNull(filters.moduleCount);
  if (moduleCount !== null) query = query.eq("module_count", moduleCount);

  if (filters.availability === "in_stock") query = query.eq("in_stock", true);

  if (filters.priceStatus === "below_start") query = query.eq("is_below_start_price", true);
  if (filters.priceStatus === "above_start") query = query.eq("is_above_start_price", true);
  if (filters.priceStatus === "at_low") query = query.eq("is_at_historical_low", true);

  const discount = minDiscountValue(filters);
  if (discount !== null) query = query.lte("price_change_percent", -discount);

  switch (filters.sort) {
    case "price_asc":
      query = query.order("current_price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("current_price", { ascending: false });
      break;
    case "cl_asc":
      query = query.order("cas_latency", { ascending: true, nullsFirst: false });
      break;
    case "speed_desc":
      query = query.order("speed_mhz", { ascending: false, nullsFirst: false });
      break;
    case "recent":
      query = query.order("current_observed_at", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "biggest_drop":
    default:
      query = query.order("price_change_percent", { ascending: true, nullsFirst: false });
      break;
  }

  // Stable secondary ordering so pagination never repeats or skips rows.
  query = query.order("product_id", { ascending: true });

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new DataAccessError("Failed to load the product list", error.message);
  }

  const total = count ?? 0;

  // `LIST_COLUMNS` is a runtime string, so PostgREST's column parsing cannot be
  // inferred statically. The view's row type is the authoritative shape.
  const rows = (data ?? []) as unknown as ProductPriceSummaryRow[];

  return {
    rows,
    total,
    page: filters.page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export interface FilterFacets {
  brands: string[];
  capacities: number[];
  speeds: number[];
  casLatencies: number[];
  moduleCounts: number[];
}

function distinctSorted<T extends string | number>(values: Array<T | null>): T[] {
  const seen = new Set<T>();
  for (const value of values) {
    if (value !== null && value !== undefined) seen.add(value);
  }
  return [...seen].sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))));
}

/**
 * Derive the available filter values for the toolbar.
 *
 * The tracked catalogue is intentionally small (hundreds of rows), so the
 * distinct values are computed in memory rather than requiring extra SQL
 * objects.
 */
export async function getFilterFacets(): Promise<FilterFacets> {
  const supabase = getSupabaseReadClient();

  const { data, error } = await supabase
    .from("product_price_summary")
    .select("brand,capacity_gb,speed_mhz,cas_latency,module_count")
    .eq("category", "ram");

  if (error) {
    throw new DataAccessError("Failed to load filter options", error.message);
  }

  const rows = data ?? [];

  return {
    brands: distinctSorted(rows.map((row) => row.brand)),
    capacities: distinctSorted(rows.map((row) => row.capacity_gb)),
    speeds: distinctSorted(rows.map((row) => row.speed_mhz)),
    casLatencies: distinctSorted(rows.map((row) => row.cas_latency)),
    moduleCounts: distinctSorted(rows.map((row) => row.module_count)),
  };
}
