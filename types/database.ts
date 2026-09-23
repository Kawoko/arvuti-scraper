import type { SnapshotRow } from "@/lib/arvutitark/types";

/**
 * Supabase-compatible database types.
 *
 * NOTE: these are intentionally declared with `type` aliases rather than
 * `interface`. TypeScript only gives type aliases an implicit index signature,
 * and `@supabase/supabase-js` requires rows to be assignable to
 * `Record<string, unknown>` for its generic inference to work.
 */

export type ScrapeRunStatus = "running" | "completed" | "failed";

export type ScrapeRunRow = {
  scrape_date: string;
  /** 1 = first collection of the Tallinn day, 2 = the second. */
  slot: number;
  attempted_at: string;
  finished_at: string | null;
  status: ScrapeRunStatus;
  product_count: number | null;
  page_count: number | null;
  error_message: string | null;
};

export type ProductRow = {
  id: number;
  retailer: string;
  category: string;
  source_category: string | null;
  sku: string | null;
  ean: string | null;
  name: string;
  name_en: string | null;
  brand: string | null;
  url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  chipset: string | null;
  family: string | null;
  socket: string | null;
  read_speed_mbs: number | null;
  write_speed_mbs: number | null;
  interface_type: string | null;
  memory_type: string | null;
  capacity_gb: number | null;
  speed_mhz: number | null;
  cas_latency: number | null;
  module_count: number | null;
  capacity_per_module_gb: number | null;
  form_factor: string | null;
  voltage: number | null;
};

export type PriceHistoryRow = {
  id: number;
  product_id: number;
  category: string;
  observed_date: string;
  observed_at: string;
  price: number;
  original_price: number | null;
  source_price_updated_at: string | null;
  warehouse_stock: number | null;
  local_stock: number | null;
  shop_stock: Record<string, number>;
};

export type ProductPriceSummaryRow = {
  product_id: number;
  retailer: string;
  category: string;
  source_category: string | null;
  sku: string | null;
  ean: string | null;
  name: string;
  name_en: string | null;
  brand: string | null;
  url: string | null;
  chipset: string | null;
  family: string | null;
  socket: string | null;
  read_speed_mbs: number | null;
  write_speed_mbs: number | null;
  interface_type: string | null;
  memory_type: string | null;
  capacity_gb: number | null;
  speed_mhz: number | null;
  cas_latency: number | null;
  module_count: number | null;
  capacity_per_module_gb: number | null;
  form_factor: string | null;
  voltage: number | null;
  first_seen_at: string;
  last_seen_at: string;
  start_date: string;
  start_price: number;
  current_date: string;
  current_price: number;
  current_original_price: number | null;
  current_observed_at: string;
  price_change: number | null;
  price_change_percent: number | null;
  lowest_price: number;
  highest_price: number;
  average_price: number | null;
  observation_count: number;
  current_warehouse_stock: number | null;
  current_local_stock: number | null;
  current_shop_stock: Record<string, number> | null;
  current_total_stock: number;
  in_stock: boolean;
  previous_date: string | null;
  previous_price: number | null;
  day_change: number | null;
  day_change_percent: number | null;
  is_below_start_price: boolean;
  is_above_start_price: boolean;
  is_at_historical_low: boolean;
};

export type IngestSnapshotResult = {
  product_count: number;
  price_count: number;
};

export type Database = {
  public: {
    Tables: {
      scrape_runs: {
        Row: ScrapeRunRow;
        Insert: {
          scrape_date: string;
          attempted_at?: string;
          finished_at?: string | null;
          status?: ScrapeRunStatus;
          product_count?: number | null;
          page_count?: number | null;
          error_message?: string | null;
        };
        Update: {
          scrape_date?: string;
          attempted_at?: string;
          finished_at?: string | null;
          status?: ScrapeRunStatus;
          product_count?: number | null;
          page_count?: number | null;
          error_message?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Partial<ProductRow> & { id: number; name: string };
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      price_history: {
        Row: PriceHistoryRow;
        Insert: Partial<PriceHistoryRow> & {
          product_id: number;
          observed_date: string;
          price: number;
        };
        Update: Partial<PriceHistoryRow>;
        Relationships: [];
      };
    };
    Views: {
      product_price_summary: {
        Row: ProductPriceSummaryRow;
        Relationships: [];
      };
    };
    Functions: {
      claim_scrape_run: {
        Args: { p_scrape_date: string };
        /** Returns the slot claimed (1 or 2), or null when none is available. */
        Returns: number | null;
      };
      finish_scrape_run: {
        Args: {
          p_scrape_date: string;
          p_slot: number;
          p_status: ScrapeRunStatus;
          p_product_count?: number | null;
          p_page_count?: number | null;
          p_error_message?: string | null;
        };
        Returns: undefined;
      };
      ingest_snapshot: {
        Args: { p_scrape_date: string; p_products: SnapshotRow[] };
        Returns: IngestSnapshotResult;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
