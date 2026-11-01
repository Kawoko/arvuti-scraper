import type { ProductFilters } from "@/lib/filters";
import type { ProductPriceSummaryRow } from "@/types/database";

import { ProductCard } from "./product-card";
import { ProductTable } from "./product-table";

export interface ProductTrackingProps {
  trackedKeys: ReadonlySet<string>;
  authenticated: boolean;
  loginNext: string;
}

interface ProductListProps extends ProductTrackingProps {
  rows: ProductPriceSummaryRow[];
  filters: ProductFilters;
  pathname?: string;
}

/**
 * Dense, column-sortable table on desktop; stacked cards on mobile. Both are
 * rendered so the correct layout is available without client-side measurement.
 */
export function ProductList({ rows, filters, pathname = "/", ...tracking }: ProductListProps) {
  return (
    <>
      <div className="hidden md:block">
        <ProductTable rows={rows} filters={filters} pathname={pathname} {...tracking} />
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <ProductCard key={`${row.category}-${row.product_id}`} row={row} {...tracking} />
        ))}
      </div>
    </>
  );
}
