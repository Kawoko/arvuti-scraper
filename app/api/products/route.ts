import { NextResponse } from "next/server";

import type { ComponentCategory } from "@/lib/arvutitark/types";
import { isComponentCategory } from "@/lib/categories";
import { parseProductFilters } from "@/lib/filters";
import { getProductList } from "@/lib/queries/products";

export const dynamic = "force-dynamic";

/**
 * One batch of product rows for the progressive listing.
 *
 * Deliberately not cached at the server/CDN layer: prices must stay current.
 * The browser caches the batches it has already received (`lib/browser-cache.ts`),
 * so repeat visits do not re-download the catalogue.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const rawCategory = url.searchParams.get("category") ?? "ram";
  const category: ComponentCategory = isComponentCategory(rawCategory) ? rawCategory : "ram";

  try {
    const filters = parseProductFilters(Object.fromEntries(url.searchParams));
    const list = await getProductList(filters, category);

    return NextResponse.json(
      {
        rows: list.rows,
        total: list.total,
        page: list.page,
        pageCount: list.pageCount,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not load more products." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
