import type { ProductPriceSummaryRow } from "@/types/database";

import { ProductCard } from "./product-card";
import { ProductTable } from "./product-table";

/**
 * Dense table on desktop, stacked cards on mobile. Both are rendered so the
 * correct layout is available without client-side measurement.
 */
export function ProductList({ rows }: { rows: ProductPriceSummaryRow[] }) {
  return (
    <>
      <div className="hidden md:block">
        <ProductTable rows={rows} />
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <ProductCard key={row.product_id} row={row} />
        ))}
      </div>
    </>
  );
}
