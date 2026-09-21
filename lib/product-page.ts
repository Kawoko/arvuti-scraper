import { cache } from "react";
import type { Metadata } from "next";

import { formatCurrency } from "./format";
import { specSummaryFromRow } from "./presentation";
import { getProductDetail, type ProductDetail } from "./queries/product-detail";

/**
 * Request-scoped memoisation so `generateMetadata` and the page share a single
 * database round trip.
 */
export const getProductDetailCached = cache(getProductDetail);

/** Parse and validate a product id from a route segment. */
export function parseProductId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildProductMetadata(detail: ProductDetail | null): Metadata {
  if (!detail) return { title: "Product not found" };

  const summary = specSummaryFromRow(detail.summary);

  return {
    title: detail.summary.name,
    description: summary
      ? `${summary} — ${formatCurrency(detail.summary.current_price)}`
      : undefined,
  };
}
