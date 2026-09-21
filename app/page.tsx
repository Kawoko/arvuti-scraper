import { Suspense } from "react";
import { SearchX } from "lucide-react";

import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { Pagination } from "@/components/filters/pagination";
import { PageShell } from "@/components/layout/page-shell";
import { ProductList } from "@/components/products/product-list";
import { StaleDataNotice } from "@/components/products/stale-data-notice";
import { SummaryCards } from "@/components/products/summary-cards";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { hasActiveFilters, parseProductFilters } from "@/lib/filters";
import { getFilterFacets, getProductList } from "@/lib/queries/products";
import { getDashboardStats } from "@/lib/queries/stats";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = parseProductFilters(resolvedSearchParams);

  const [stats, facets, list] = await Promise.all([
    getDashboardStats(),
    getFilterFacets(),
    getProductList(filters),
  ]);

  const filtered = hasActiveFilters(filters);
  const firstRow = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const lastRow = Math.min(list.page * list.pageSize, list.total);

  return (
    <PageShell activePath="/">
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">RAM Price Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Arvutitark price history · desktop DDR5 UDIMM, 5600 & 6000 MHz
          </p>
        </header>

        <StaleDataNotice staleDays={stats.staleDays} />

        <SummaryCards stats={stats} />

        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <FilterToolbar filters={filters} facets={facets} total={list.total} />
        </Suspense>

        {list.rows.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={filtered ? "No products match these filters" : "No price data yet"}
            description={
              filtered
                ? "Try widening your search, removing a filter, or clearing the discount threshold."
                : "The daily collection has not recorded any products yet. Run `npm run scrape` or check the status page."
            }
          />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs text-muted-foreground tabular">
                Showing {firstRow}–{lastRow} of {list.total}
              </p>
              <p className="text-xs text-muted-foreground">Page {list.page} of {list.pageCount}</p>
            </div>

            <ProductList rows={list.rows} filters={filters} />

            <Pagination filters={filters} pageCount={list.pageCount} />
          </>
        )}
      </div>
    </PageShell>
  );
}
