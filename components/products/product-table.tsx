import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EMPTY_VALUE, formatCurrency, formatDayMonth } from "@/lib/format";
import { specSummaryFromRow } from "@/lib/presentation";
import type { ProductPriceSummaryRow } from "@/types/database";

import { PriceChange } from "./price-change";
import { StockBadge } from "./stock-badge";

export function ProductTable({ rows }: { rows: ProductPriceSummaryRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Product</TableHead>
            <TableHead>Specs</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">Start</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="text-right">Lowest</TableHead>
            <TableHead className="pl-5">Stock</TableHead>
            <TableHead className="pr-5 text-right">Last updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const specs = specSummaryFromRow(row);

            return (
              <TableRow key={row.product_id}>
                <TableCell className="pl-5">
                  <div className="flex flex-col gap-0.5">
                    {row.brand ? (
                      <span className="text-xs text-muted-foreground">{row.brand}</span>
                    ) : null}
                    <Link
                      href={`/ram/${row.product_id}`}
                      className="max-w-[22rem] truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </div>
                </TableCell>

                <TableCell className="max-w-[16rem] text-xs text-muted-foreground">
                  <span className="line-clamp-1">{specs || EMPTY_VALUE}</span>
                </TableCell>

                <TableCell className="text-right text-sm font-semibold tabular">
                  {formatCurrency(row.current_price)}
                </TableCell>

                <TableCell className="text-right text-sm tabular text-muted-foreground">
                  {formatCurrency(row.start_price)}
                </TableCell>

                <TableCell className="text-right text-sm">
                  <PriceChange change={row.price_change} percent={row.price_change_percent} className="justify-end" />
                </TableCell>

                <TableCell className="text-right text-sm tabular">
                  <span className={row.is_at_historical_low ? "font-semibold" : undefined}>
                    {formatCurrency(row.lowest_price)}
                  </span>
                </TableCell>

                <TableCell className="pl-5">
                  <StockBadge inStock={row.in_stock} />
                </TableCell>

                <TableCell className="pr-5 text-right text-xs text-muted-foreground">
                  {formatDayMonth(row.current_observed_at)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
