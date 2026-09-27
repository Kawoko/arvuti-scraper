import Link from "next/link";
import { ArrowDownRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CATEGORY_DEFINITIONS, isComponentCategory, productDetailHref } from "@/lib/categories";
import { formatCurrency, formatPercent } from "@/lib/format";
import { specSummaryFromRow } from "@/lib/presentation";
import type { ProductPriceSummaryRow } from "@/types/database";

import { StockBadge } from "./stock-badge";

export function DealCard({ row }: { row: ProductPriceSummaryRow }) {
  const specs = specSummaryFromRow(row);
  const percent = row.price_change_percent;
  const savings = row.price_change === null ? null : Math.abs(row.price_change);
  const group = isComponentCategory(row.category) ? CATEGORY_DEFINITIONS[row.category] : null;

  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {group ? <Badge variant="default">{group.label}</Badge> : null}
            {row.brand ? (
              <span className="text-xs text-muted-foreground">{row.brand}</span>
            ) : null}
          </div>
          {/* Routed to the row's own group; a deal may come from any category. */}
          <Link
            href={productDetailHref(row.category, row.product_id)}
            className="line-clamp-2 text-sm font-medium leading-snug underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
          <p className="text-xs text-muted-foreground">{specs}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {percent !== null && percent < 0 ? (
            <Badge variant="positive">
              <ArrowDownRight />
              {formatPercent(percent)}
            </Badge>
          ) : percent !== null && percent > 0 ? (
            <Badge variant="negative">{formatPercent(percent)}</Badge>
          ) : null}
          {row.is_at_historical_low ? (
            <Badge variant="outline">
              <Sparkles />
              Historical low
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xl font-semibold tabular tracking-tight">
            {formatCurrency(row.current_price)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular">
            Was {formatCurrency(row.start_price)} when tracking began
          </p>
          {savings !== null && savings > 0 ? (
            <p className="mt-1 text-xs font-medium text-positive tabular">
              ↓ {formatCurrency(savings)} below the starting price
            </p>
          ) : row.price_change !== null && row.price_change > 0 ? (
            <p className="mt-1 text-xs font-medium text-negative tabular">
              ↑ {formatCurrency(row.price_change)} above the starting price
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StockBadge inStock={row.in_stock} delisted={row.is_delisted} />
          <p className="text-xs text-muted-foreground tabular">
            Low {formatCurrency(row.lowest_price)}
          </p>
        </div>
      </div>
    </div>
  );
}
