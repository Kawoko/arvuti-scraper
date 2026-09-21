import type { ProductFilters } from "@/lib/filters";
import type { ProductPriceSummaryRow } from "@/types/database";

import { ProductCard } from "./product-card";
import { ProductTable } from "./product-table";

interface ProductListProps {
  rows: ProductPriceSummaryRow[];
  filters: ProductFilters;
  pathname?: string;
}

/**
 * Dense, column-sortable table on desktop; stacked cards on mobile. Both are
 * rendered so the correct layout is available without client-side measurement.
 *
 * Sorting is only exposed through the table headers here; on mobile the toolbar's
 * sort control is the equivalent, since card layouts have no headers to click.
 */
export function ProductList({ rows, filters, pathname = "/" }: ProductListProps) {
  return (
    <>
      <div className="hidden md:block">
        <ProductTable rows={rows} filters={filters} pathname={pathname} />
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <ProductCard key={row.product_id} row={row} />
        ))}
      </div>
    </>
  );
}
