import { getSupabaseReadClient } from "@/lib/supabase/server";
import type { ScrapeRunRow } from "@/types/database";
import { DataAccessError } from "./errors";

const RUN_COLUMNS =
  "scrape_date,slot,attempted_at,finished_at,status,product_count,page_count,error_message";

export async function getRecentScrapeRuns(limit = 14): Promise<ScrapeRunRow[]> {
  const supabase = getSupabaseReadClient();

  const { data, error } = await supabase
    .from("scrape_runs")
    .select(RUN_COLUMNS)
    .order("scrape_date", { ascending: false })
    .order("slot", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Failed to load scrape runs", error.message);
  }

  return data ?? [];
}

export async function getLatestScrapeRun(): Promise<ScrapeRunRow | null> {
  const supabase = getSupabaseReadClient();

  const { data, error } = await supabase
    .from("scrape_runs")
    .select(RUN_COLUMNS)
    .order("attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Failed to load the latest scrape run", error.message);
  }

  return data;
}

export async function getLastSuccessfulScrapeRun(): Promise<ScrapeRunRow | null> {
  const supabase = getSupabaseReadClient();

  const { data, error } = await supabase
    .from("scrape_runs")
    .select(RUN_COLUMNS)
    .eq("status", "completed")
    .order("scrape_date", { ascending: false })
    .order("slot", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Failed to load the last successful scrape run", error.message);
  }

  return data;
}
