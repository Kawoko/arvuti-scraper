import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { productDetailHref } from "@/lib/categories";
import { buildSortHref, type ProductFilters, type SortColumn, type SortDirection } from "@/lib/filters";
import { EMPTY_VALUE, formatCurrency, formatDayMonth } from "@/lib/format";
import { specSummaryFromRow } from "@/lib/presentation";
import { cn } from "@/lib/utils";
import type { ProductPriceSummaryRow } from "@/types/database";

import { PriceChange } from "./price-change";
import { StockBadge } from "./stock-badge";

function SortArrow({ active, dir }: { active: boolean; dir: SortDirection }) {
  if (!active) {
    return (
      <ChevronsUpDown
        aria-hidden
        className="size-3.5 text-muted-foreground/40 transition-colors duration-150 group-hover:text-muted-foreground"
      />
    );
  }

  const Icon = dir === "asc" ? ChevronUp : ChevronDown;
  return <Icon aria-hidden className="size-3.5" />;
}

interface SortableHeaderProps {
  column: SortColumn;
  label: string;
  filters: ProductFilters;
  pathname: string;
  align?: "left" | "right";
  className?: string;
}

/**
 * Clickable column header. Renders a link so the sort lives in the URL and the
 * table stays a Server Component.
 */
function SortableHeader({
  column,
  label,
  filters,
  pathname,
  align = "right",
  className,
}: SortableHeaderProps) {
  const active = filters.sort === column;

  return (
    <TableHead
      aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <Link
        href={buildSortHref(pathname, filters, column)}
        scroll={false}
        title={`Sort by ${label.toLowerCase()}`}
        className={cn(
          "group -mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors duration-150",
          "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
          active ? "text-foreground" : "text-muted-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <SortArrow active={active} dir={filters.dir} />
      </Link>
    </TableHead>
  );
}

interface ProductTableProps {
  rows: ProductPriceSummaryRow[];
  filters: ProductFilters;
  pathname?: string;
}

export function ProductTable({ rows, filters, pathname = "/" }: ProductTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHeader
              column="name"
              label="Product"
              filters={filters}
              pathname={pathname}
              align="left"
              className="pl-5"
            />
            <TableHead>Specs</TableHead>
            <SortableHeader column="price" label="Current" filters={filters} pathname={pathname} />
            <SortableHeader column="start" label="Start" filters={filters} pathname={pathname} />
            <SortableHeader column="change" label="Change" filters={filters} pathname={pathname} />
            <SortableHeader column="lowest" label="Lowest" filters={filters} pathname={pathname} />
            <TableHead className="pl-5">Stock</TableHead>
            <SortableHeader
              column="updated"
              label="Last updated"
              filters={filters}
              pathname={pathname}
              className="pr-5"
            />
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
                      href={productDetailHref(row.category, row.product_id)}
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
                  <PriceChange
                    change={row.price_change}
                    percent={row.price_change_percent}
                    className="justify-end"
                  />
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
