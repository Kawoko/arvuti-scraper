import { getSupabaseReadClient } from "@/lib/supabase/server";
import type { ScrapeRunRow } from "@/types/database";
import { DataAccessError } from "./errors";

export async function getRecentScrapeRuns(limit = 14): Promise<ScrapeRunRow[]> {
  const supabase = getSupabaseReadClient();

  const { data, error } = await supabase
    .from("scrape_runs")
    .select("scrape_date,attempted_at,finished_at,status,product_count,page_count,error_message")
    .order("scrape_date", { ascending: false })
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
    .select("scrape_date,attempted_at,finished_at,status,product_count,page_count,error_message")
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
    .select("scrape_date,attempted_at,finished_at,status,product_count,page_count,error_message")
    .eq("status", "completed")
    .order("scrape_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Failed to load the last successful scrape run", error.message);
  }

  return data;
}
