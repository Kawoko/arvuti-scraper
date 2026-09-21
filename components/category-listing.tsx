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
import type { CategoryDefinition } from "@/lib/categories";
import { hasActiveFilters, parseProductFilters, type SearchParamsInput } from "@/lib/filters";
import { getFilterFacets, getProductList } from "@/lib/queries/products";
import { getDashboardStats } from "@/lib/queries/stats";

interface CategoryListingProps {
  definition: CategoryDefinition;
  searchParams: SearchParamsInput;
}

/**
 * The product listing for one category.
 *
 * Shared by `/` (RAM) and `/gpu`, so adding a category is a route file plus an
 * entry in the category registry — no duplicated page logic.
 */
export async function CategoryListing({ definition, searchParams }: CategoryListingProps) {
  const filters = parseProductFilters(searchParams);

  const [stats, facets, list] = await Promise.all([
    getDashboardStats(definition.category),
    getFilterFacets(definition.category),
    getProductList(filters, definition.category),
  ]);

  const filtered = hasActiveFilters(filters);
  const firstRow = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const lastRow = Math.min(list.page * list.pageSize, list.total);

  return (
    <PageShell activePath={definition.path}>
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{definition.title}</h1>
          <p className="text-sm text-muted-foreground">{definition.subtitle}</p>
        </header>

        <StaleDataNotice staleDays={stats.staleDays} />

        <SummaryCards stats={stats} hint={definition.specHint} />

        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <FilterToolbar
            filters={filters}
            facets={facets}
            total={list.total}
            definition={definition}
          />
        </Suspense>

        {list.rows.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={filtered ? "No products match these filters" : "No price data yet"}
            description={
              filtered
                ? "Try widening your search, removing a filter, or clearing the discount threshold."
                : `The daily collection has not recorded any ${definition.label} yet. Run \`npm run scrape\` or check the status page.`
            }
          />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs text-muted-foreground tabular">
                Showing {firstRow}–{lastRow} of {list.total}
              </p>
              <p className="text-xs text-muted-foreground">
                Page {list.page} of {list.pageCount}
              </p>
            </div>

            <ProductList rows={list.rows} filters={filters} pathname={definition.path} />

            <Pagination
              filters={filters}
              pageCount={list.pageCount}
              pathname={definition.path}
            />
          </>
        )}
      </div>
    </PageShell>
  );
}
