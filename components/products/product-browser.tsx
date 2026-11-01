"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MAX_CACHED_PAGES,
  productCacheSignature,
  readProductCache,
  writeProductCachePage,
} from "@/lib/browser-cache";
import { buildProductQuery, type ProductFilters } from "@/lib/filters";
import { trackedKey } from "@/lib/tracking";
import type { ProductPriceSummaryRow } from "@/types/database";

import { ProductList } from "./product-list";

interface ProductBrowserProps {
  category: string;
  initialRows: ProductPriceSummaryRow[];
  initialPage: number;
  initialTotal: number;
  initialPageCount: number;
  filters: ProductFilters;
  pathname: string;
  trackedKeys: string[];
  authenticated: boolean;
  loginNext: string;
}

interface BatchResponse {
  rows: ProductPriceSummaryRow[];
  total: number;
  page: number;
  pageCount: number;
}

function mergeRows(
  existing: ProductPriceSummaryRow[],
  incoming: ProductPriceSummaryRow[],
): ProductPriceSummaryRow[] {
  const seen = new Set(existing.map((row) => trackedKey(row.category, row.product_id)));
  const merged = [...existing];

  for (const row of incoming) {
    const key = trackedKey(row.category, row.product_id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  return merged;
}

/**
 * Progressive listing.
 *
 * The first batch is server-rendered. Further batches are fetched only when the
 * visitor scrolls near the end (or presses "Load more"), then cached in the
 * browser so returning to the same view does not re-download them. At most two
 * batches load automatically per visit; the rest is explicit, which keeps a fast
 * connection from pulling the whole catalogue at once.
 */
export function ProductBrowser({
  category,
  initialRows,
  initialPage,
  initialTotal,
  initialPageCount,
  filters,
  pathname,
  trackedKeys,
  authenticated,
  loginNext,
}: ProductBrowserProps) {
  const signature = useMemo(() => productCacheSignature(category, filters), [category, filters]);
  const tracked = useMemo(() => new Set(trackedKeys), [trackedKeys]);

  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const [pageCount, setPageCount] = useState(initialPageCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hydratedSignature = useRef<string | null>(null);
  const autoLoads = useRef(0);

  // Seed the cache with the server-rendered page and append any later pages this
  // browser already has. Runs once per filter signature, so changing a filter
  // starts a clean list.
  useEffect(() => {
    if (hydratedSignature.current === signature) return;
    hydratedSignature.current = signature;
    autoLoads.current = 0;

    writeProductCachePage(signature, initialPage, {
      rows: initialRows,
      total: initialTotal,
      pageCount: initialPageCount,
    });

    const cached = readProductCache(signature);
    let merged = initialRows;
    let highestPage = initialPage;

    for (const [pageNumber, entry] of [...cached.entries()].sort((a, b) => a[0] - b[0])) {
      if (pageNumber <= initialPage) continue;
      merged = mergeRows(merged, entry.rows);
      highestPage = Math.max(highestPage, pageNumber);
      setTotal(entry.total);
      setPageCount(entry.pageCount);
    }

    if (merged.length > initialRows.length) {
      setRows(merged);
      setPage(highestPage);
      setFromCache(true);
    }
  }, [signature, initialPage, initialRows, initialTotal, initialPageCount]);

  const loadMore = useCallback(async () => {
    if (loading || page >= pageCount) return;

    const nextPage = page + 1;
    const cached = readProductCache(signature).get(nextPage);

    if (cached) {
      setRows((current) => mergeRows(current, cached.rows));
      setPage(nextPage);
      setTotal(cached.total);
      setPageCount(cached.pageCount);
      setFromCache(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ category });
      for (const [key, value] of new URLSearchParams(
        buildProductQuery({ ...filters, page: nextPage }),
      )) {
        params.set(key, value);
      }

      const response = await fetch(`/api/products?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Request failed");

      const batch = (await response.json()) as BatchResponse;

      setRows((current) => mergeRows(current, batch.rows));
      setPage(batch.page);
      setTotal(batch.total);
      setPageCount(batch.pageCount);

      setFromCache(false);
      writeProductCachePage(signature, batch.page, {
        rows: batch.rows,
        total: batch.total,
        pageCount: batch.pageCount,
      });
    } catch {
      setError("Could not load more products. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [category, filters, loading, page, pageCount, signature]);

  // Load one batch when the sentinel approaches the viewport, at most twice per
  // visit. Anything beyond that is an explicit click.
  useEffect(() => {
    if (page >= pageCount || loading) return;

    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (autoLoads.current >= 2) return;
        autoLoads.current += 1;
        void loadMore();
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, loading, page, pageCount]);

  const hasMore = page < pageCount;
  const cacheFull = page >= MAX_CACHED_PAGES;

  return (
    <div className="space-y-3">
      <ProductList
        rows={rows}
        filters={filters}
        pathname={pathname}
        trackedKeys={tracked}
        authenticated={authenticated}
        loginNext={loginNext}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p className="tabular">
          Showing {rows.length} of {total}
          {fromCache ? " · partly cached on this device" : ""}
        </p>

        {hasMore ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : null}
            {loading ? "Loading…" : cacheFull ? "Load more" : `Load next ${Math.min(24, total - rows.length)}`}
          </Button>
        ) : (
          <span>All {total} loaded</span>
        )}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadMore()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden className="h-2" />
    </div>
  );
}
