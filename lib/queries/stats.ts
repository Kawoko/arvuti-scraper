import { getTallinnDate, daysBetween } from "@/lib/dates";
import { getSupabaseReadClient } from "@/lib/supabase/server";
import type { ScrapeRunRow } from "@/types/database";
import { DataAccessError } from "./errors";
import { getLastSuccessfulScrapeRun } from "./scrape-runs";

export interface DashboardStats {
  productsTracked: number;
  dropsToday: number;
  belowStartPrice: number;
  newHistoricalLows: number;
  lastSuccessfulScan: ScrapeRunRow | null;
  /** Number of days since the last successful scan, from the Tallinn calendar. */
  staleDays: number | null;
}

function countResult(
  result: { count: number | null; error: { message: string } | null },
  label: string,
): number {
  if (result.error) throw new DataAccessError(`Failed to count ${label}`, result.error.message);
  return result.count ?? 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabaseReadClient();
  const base = () =>
    supabase.from("product_price_summary").select("product_id", { count: "exact", head: true }).eq("category", "ram");

  const [tracked, drops, belowStart, newLows, lastSuccessfulScan] = await Promise.all([
    base(),
    base().lt("day_change", 0),
    base().eq("is_below_start_price", true),
    base().eq("is_at_historical_low", true).gt("observation_count", 1),
    getLastSuccessfulScrapeRun(),
  ]);

  const today = getTallinnDate();
  const staleDays = lastSuccessfulScan
    ? daysBetween(lastSuccessfulScan.scrape_date, today)
    : null;

  return {
    productsTracked: countResult(tracked, "tracked products"),
    dropsToday: countResult(drops, "today's price drops"),
    belowStartPrice: countResult(belowStart, "products below their starting price"),
    newHistoricalLows: countResult(newLows, "new historical lows"),
    lastSuccessfulScan,
    staleDays,
  };
}
