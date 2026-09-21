import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { productDetailHref } from "@/lib/categories";
import { EMPTY_VALUE, formatCurrency, formatDayMonth } from "@/lib/format";
import { specSummaryFromRow } from "@/lib/presentation";
import type { ProductPriceSummaryRow } from "@/types/database";

import { PriceChange } from "./price-change";
import { StockBadge } from "./stock-badge";

export function ProductCard({ row }: { row: ProductPriceSummaryRow }) {
  const specs = specSummaryFromRow(row);

  return (
    <Link
      href={productDetailHref(row.category, row.product_id)}
      className="surface surface-interactive block p-4 focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {row.brand ? <p className="text-xs text-muted-foreground">{row.brand}</p> : null}
          <p className="line-clamp-2 text-sm font-medium leading-snug">{row.name}</p>
        </div>
        <StockBadge inStock={row.in_stock} className="shrink-0" />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{specs || EMPTY_VALUE}</p>

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-base font-semibold tabular">{formatCurrency(row.current_price)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular">
            Start {formatCurrency(row.start_price)}
          </p>
        </div>

        <div className="text-right">
          <PriceChange
            change={row.price_change}
            percent={row.price_change_percent}
            className="justify-end text-sm"
          />
          <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-muted-foreground tabular">
            {row.is_at_historical_low ? <Badge variant="positive">Low</Badge> : null}
            <span>Low {formatCurrency(row.lowest_price)}</span>
          </div>
        </div>
      </div>

      <p className="mt-2 text-right text-[11px] text-muted-foreground">
        Updated {formatDayMonth(row.current_observed_at)}
      </p>
    </Link>
  );
}
