import type { ComponentCategory } from "@/lib/arvutitark/types";
import { getSupabaseReadClient } from "@/lib/supabase/server";
import type { ProductPriceSummaryRow } from "@/types/database";
import { DataAccessError } from "./errors";

export type DealsTab = "biggest_drops" | "new_lows" | "below_start" | "in_stock";

export const DEALS_TABS: ReadonlyArray<{ value: DealsTab; label: string }> = [
  { value: "biggest_drops", label: "Biggest drops" },
  { value: "new_lows", label: "New lows" },
  { value: "below_start", label: "Under starting price" },
  { value: "in_stock", label: "In stock" },
];

const DEAL_COLUMNS = [
  "product_id",
  "name",
  "name_en",
  "brand",
  "url",
  "chipset",
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
  "highest_price",
  "observation_count",
  "current_total_stock",
  "in_stock",
  "is_below_start_price",
  "is_at_historical_low",
].join(",");

export function isDealsTab(value: string | null | undefined): value is DealsTab {
  return value === "biggest_drops" || value === "new_lows" || value === "below_start" || value === "in_stock";
}

/**
 * Deals across every tracked category by default, so the page answers "what is
 * cheap right now" rather than only "what RAM is cheap". Pass a category to
 * narrow it.
 */
export async function getDeals(
  tab: DealsTab,
  category?: ComponentCategory,
  limit = 24,
): Promise<ProductPriceSummaryRow[]> {
  const supabase = getSupabaseReadClient();

  let query = supabase.from("product_price_summary").select(DEAL_COLUMNS);

  if (category) query = query.eq("category", category);

  switch (tab) {
    case "new_lows":
      // A "new low" only means something once there is more than one day of history.
      query = query.eq("is_at_historical_low", true).gt("observation_count", 1);
      break;
    case "below_start":
      query = query.eq("is_below_start_price", true);
      break;
    case "in_stock":
      query = query.eq("in_stock", true).lt("price_change", 0);
      break;
    case "biggest_drops":
    default:
      query = query.lt("price_change_percent", 0);
      break;
  }

  const { data, error } = await query
    .order("price_change_percent", { ascending: true, nullsFirst: false })
    .order("product_id", { ascending: true })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Failed to load deals", error.message);
  }

  return (data ?? []) as unknown as ProductPriceSummaryRow[];
}

export interface DealsTabCount {
  tab: DealsTab;
  count: number;
}

function countResult(
  result: { count: number | null; error: { message: string } | null },
  label: string,
): number {
  if (result.error) throw new DataAccessError(`Failed to count ${label}`, result.error.message);
  return result.count ?? 0;
}

export async function getDealsTabCounts(
  category?: ComponentCategory,
): Promise<Record<DealsTab, number>> {
  const supabase = getSupabaseReadClient();
  const base = () => {
    const query = supabase
      .from("product_price_summary")
      .select("product_id", { count: "exact", head: true });
    return category ? query.eq("category", category) : query;
  };

  const [drops, newLows, belowStart, inStock] = await Promise.all([
    base().lt("price_change_percent", 0),
    base().eq("is_at_historical_low", true).gt("observation_count", 1),
    base().eq("is_below_start_price", true),
    base().eq("in_stock", true).lt("price_change", 0),
  ]);

  return {
    biggest_drops: countResult(drops, "biggest drops"),
    new_lows: countResult(newLows, "new lows"),
    below_start: countResult(belowStart, "below starting price"),
    in_stock: countResult(inStock, "in stock deals"),
  };
}
