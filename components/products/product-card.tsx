import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { productDetailHref } from "@/lib/categories";
import { EMPTY_VALUE, formatCurrency, formatDayMonth } from "@/lib/format";
import { specSummaryFromRow } from "@/lib/presentation";
import { trackedKey } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import type { ProductPriceSummaryRow } from "@/types/database";

import { FavoriteButton } from "./favorite-button";
import { PriceChange } from "./price-change";
import { StockBadge } from "./stock-badge";

interface ProductCardProps {
  row: ProductPriceSummaryRow;
  trackedKeys: ReadonlySet<string>;
  authenticated: boolean;
  loginNext: string;
}

export function ProductCard({ row, trackedKeys, authenticated, loginNext }: ProductCardProps) {
  const specs = specSummaryFromRow(row);

  return (
    <article className={cn("surface relative p-4", row.is_delisted && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {row.brand ? <p className="text-xs text-muted-foreground">{row.brand}</p> : null}
          <Link
            href={productDetailHref(row.category, row.product_id)}
            className="line-clamp-2 text-sm font-medium leading-snug underline-offset-4 after:absolute after:inset-0 after:content-[''] hover:underline"
          >
            {row.name}
          </Link>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <StockBadge inStock={row.in_stock} delisted={row.is_delisted} />
          <FavoriteButton
            productId={row.product_id}
            category={row.category}
            initialTracked={trackedKeys.has(trackedKey(row.category, row.product_id))}
            authenticated={authenticated}
            loginNext={loginNext}
          />
        </div>
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
    </article>
  );
}
