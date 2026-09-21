import { getSupabaseReadClient } from "@/lib/supabase/server";
import type { ProductPriceSummaryRow } from "@/types/database";
import { DataAccessError } from "./errors";

/**
 * A single historical observation. This is the only place in the app that
 * reads the full price history, and it is scoped to one product.
 */
export interface PriceHistoryPoint {
  observedDate: string;
  observedAt: string;
  price: number;
  originalPrice: number | null;
  warehouseStock: number | null;
  localStock: number | null;
  totalStock: number;
}

export interface ProductDetail {
  summary: ProductPriceSummaryRow;
  history: PriceHistoryPoint[];
}

function shopStockTotal(shopStock: Record<string, number> | null): number {
  if (!shopStock) return 0;
  return Object.values(shopStock).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export async function getProductDetail(productId: number): Promise<ProductDetail | null> {
  const supabase = getSupabaseReadClient();

  const { data: summary, error: summaryError } = await supabase
    .from("product_price_summary")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  if (summaryError) {
    throw new DataAccessError("Failed to load the product", summaryError.message);
  }
  if (!summary) return null;

  const { data: historyRows, error: historyError } = await supabase
    .from("price_history")
    .select("observed_date,observed_at,price,original_price,warehouse_stock,local_stock,shop_stock")
    .eq("product_id", productId)
    .order("observed_date", { ascending: true });

  if (historyError) {
    throw new DataAccessError("Failed to load the price history", historyError.message);
  }

  const history: PriceHistoryPoint[] = (historyRows ?? []).map((row) => {
    const localStock = row.local_stock ?? 0;
    const warehouseStock = row.warehouse_stock ?? 0;
    const shopTotal = shopStockTotal(row.shop_stock);

    return {
      observedDate: row.observed_date,
      observedAt: row.observed_at,
      price: Number(row.price),
      originalPrice: row.original_price === null ? null : Number(row.original_price),
      warehouseStock: row.warehouse_stock,
      localStock: row.local_stock,
      totalStock: localStock + warehouseStock + shopTotal,
    };
  });

  return { summary, history };
}
