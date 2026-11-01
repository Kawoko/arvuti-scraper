import type { ComponentCategory } from "@/lib/arvutitark/types";
import { isComponentCategory } from "@/lib/categories";
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

/**
 * Load one product's current stats and its full daily history.
 *
 * Scoped by group as well as product id, so an id belonging to another group
 * cannot be displayed under the wrong heading.
 */
export async function getProductDetail(
  productId: number,
  category: ComponentCategory,
): Promise<ProductDetail | null> {
  const supabase = getSupabaseReadClient();

  const { data: summary, error: summaryError } = await supabase
    .from("product_price_summary")
    .select("*")
    .eq("product_id", productId)
    .eq("category", category)
    .maybeSingle();

  if (summaryError) {
    throw new DataAccessError("Failed to load the product", summaryError.message);
  }
  if (!summary) return null;

  const { data: historyRows, error: historyError } = await supabase
    .from("price_history")
    .select("observed_date,observed_at,price,original_price,warehouse_stock,local_stock,shop_stock")
    .eq("product_id", productId)
    .eq("category", category)
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

/**
 * Every group a product id belongs to.
 *
 * Used to rescue a link that points at the wrong group — for example a bookmark
 * made before the product was re-filed, or one whose group path was lost. When
 * exactly one group matches, the caller can redirect there instead of 404ing.
 */
export async function findProductCategories(productId: number): Promise<ComponentCategory[]> {
  const supabase = getSupabaseReadClient();

  const { data, error } = await supabase
    .from("product_price_summary")
    .select("category")
    .eq("product_id", productId);

  if (error) {
    throw new DataAccessError("Failed to look up the product group", error.message);
  }

  return (data ?? [])
    .map((row) => row.category)
    .filter((category): category is ComponentCategory => isComponentCategory(category));
}
