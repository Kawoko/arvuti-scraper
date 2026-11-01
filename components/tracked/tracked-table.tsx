import Link from "next/link";
import { BellRing, Star } from "lucide-react";

import { FavoriteButton } from "@/components/products/favorite-button";
import { PriceChange } from "@/components/products/price-change";
import { StockBadge } from "@/components/products/stock-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { productDetailHref } from "@/lib/categories";
import { EMPTY_VALUE, formatCurrency, formatDate } from "@/lib/format";
import { specSummaryFromRow } from "@/lib/presentation";
import type { TrackedProductDetailRow } from "@/types/database";

interface TrackedTableProps {
  rows: TrackedProductDetailRow[];
  thresholdPercent: number;
  authenticated: boolean;
  loginNext: string;
}

/**
 * The user's starred products with the two numbers that matter for an alert:
 * how far the price has moved since it was starred, and the price that would
 * trigger a notification.
 */
export function TrackedTable({
  rows,
  thresholdPercent,
  authenticated,
  loginNext,
}: TrackedTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-5">
              <span className="sr-only">Tracked</span>
            </TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">Since tracked</TableHead>
            <TableHead className="text-right">Alert at</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pl-5">Stock</TableHead>
            <TableHead className="pr-5 text-right">Tracked since</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const specs = specSummaryFromRow(row);
            const base = row.price_at_tracking;
            const change = base === null ? null : row.current_price - base;
            const percent =
              base !== null && base > 0 ? ((row.current_price - base) / base) * 100 : null;
            const target = base === null ? null : base * (1 - thresholdPercent / 100);
            const reached = percent !== null && percent <= -thresholdPercent;

            return (
              <TableRow
                key={`${row.category}-${row.product_id}`}
                className={row.is_delisted ? "opacity-60" : undefined}
              >
                <TableCell className="pl-5 pr-0">
                  <FavoriteButton
                    productId={row.product_id}
                    category={row.category}
                    initialTracked
                    authenticated={authenticated}
                    loginNext={loginNext}
                    className="-ml-1"
                  />
                </TableCell>

                <TableCell>
                  <div className="flex max-w-[24rem] flex-col gap-0.5">
                    {row.brand ? (
                      <span className="text-xs text-muted-foreground">{row.brand}</span>
                    ) : null}
                    <Link
                      href={productDetailHref(row.category, row.product_id)}
                      className="truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
                      {specs || EMPTY_VALUE}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="text-right text-sm font-semibold tabular">
                  {formatCurrency(row.current_price)}
                </TableCell>

                <TableCell className="text-right text-sm">
                  {base === null ? (
                    <span className="text-muted-foreground">{EMPTY_VALUE}</span>
                  ) : (
                    <PriceChange change={change} percent={percent} className="justify-end" />
                  )}
                </TableCell>

                <TableCell className="text-right text-sm tabular text-muted-foreground">
                  {target === null ? EMPTY_VALUE : formatCurrency(target)}
                </TableCell>

                <TableCell>
                  {reached ? (
                    <Badge variant="positive">
                      <BellRing />
                      Target reached
                    </Badge>
                  ) : percent === null ? (
                    <Badge variant="neutral">No baseline</Badge>
                  ) : (
                    <Badge variant="neutral">
                      <Star />
                      {`${Math.max(0, -(percent ?? 0)).toFixed(0)}% of ${thresholdPercent}%`}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="pl-5">
                  <StockBadge inStock={row.in_stock} delisted={row.is_delisted} />
                </TableCell>

                <TableCell className="pr-5 text-right text-xs text-muted-foreground">
                  {formatDate(row.tracked_at)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
