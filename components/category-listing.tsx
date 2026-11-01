import { Suspense } from "react";
import { SearchX } from "lucide-react";

import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { PageShell } from "@/components/layout/page-shell";
import { ProductBrowser } from "@/components/products/product-browser";
import { StaleDataNotice } from "@/components/products/stale-data-notice";
import { StatStrip } from "@/components/products/stat-strip";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryDefinition } from "@/lib/categories";
import {
  buildProductQuery,
  hasActiveFilters,
  parseProductFilters,
  type SearchParamsInput,
} from "@/lib/filters";
import { getFilterFacetsCached, getProductList } from "@/lib/queries/products";
import { getDashboardStats } from "@/lib/queries/stats";
import { getTrackingContext } from "@/lib/queries/tracked";

interface CategoryListingProps {
  definition: CategoryDefinition;
  searchParams: SearchParamsInput;
}

/**
 * The product listing for one category.
 *
 * Shared by `/` (RAM) and the other group routes, so adding a category is a
 * route file plus an entry in the category registry — no duplicated page logic.
 */
export async function CategoryListing({ definition, searchParams }: CategoryListingProps) {
  const filters = parseProductFilters(searchParams);

  const [stats, facets, list, tracking] = await Promise.all([
    getDashboardStats(definition.category),
    getFilterFacetsCached(definition.category),
    getProductList(filters, definition.category),
    getTrackingContext(),
  ]);

  const filtered = hasActiveFilters(filters);

  // The browser holds its own row state for progressive loading. Remount it
  // whenever the URL filter/sort contract changes, otherwise a sort click would
  // update the URL while the table kept showing the previous ordering.
  const browserKey = buildProductQuery(filters) || "default";

  return (
    <PageShell activePath={definition.path}>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{definition.title}</h1>
        </header>

        <StaleDataNotice staleDays={stats.staleDays} />

        <StatStrip stats={stats} />

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
                ? "Try widening your search or clearing a filter."
                : `No ${definition.label} have been recorded in this group yet.`
            }
          />
        ) : (
          <ProductBrowser
            key={browserKey}
            category={definition.category}
            initialRows={list.rows}
            initialPage={list.page}
            initialTotal={list.total}
            initialPageCount={list.pageCount}
            filters={filters}
            pathname={definition.path}
            trackedKeys={[...tracking.trackedKeys]}
            authenticated={tracking.user !== null}
            loginNext={definition.path}
          />
        )}
      </div>
    </PageShell>
  );
}
