import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { buildProductHref, type ProductFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

interface PaginationProps {
  filters: ProductFilters;
  pageCount: number;
  pathname?: string;
}

function pageWindow(page: number, pageCount: number): number[] {
  const pages = new Set<number>([1, pageCount, page]);
  for (let offset = 1; offset <= 2; offset += 1) {
    if (page - offset >= 1) pages.add(page - offset);
    if (page + offset <= pageCount) pages.add(page + offset);
  }
  return [...pages].sort((a, b) => a - b);
}

export function Pagination({ filters, pageCount, pathname = "/" }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = pageWindow(filters.page, pageCount);
  const previousDisabled = filters.page <= 1;
  const nextDisabled = filters.page >= pageCount;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {previousDisabled ? (
        <span
          aria-disabled="true"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "pointer-events-none opacity-50")}
        >
          <ChevronLeft />
        </span>
      ) : (
        <Link
          href={buildProductHref(pathname, { ...filters, page: filters.page - 1 })}
          aria-label="Previous page"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronLeft />
        </Link>
      )}

      {pages.map((page, index) => {
        const previous = index > 0 ? pages[index - 1] : null;
        const gap = previous !== null && page - previous > 1;

        return (
          <span key={page} className="flex items-center gap-1">
            {gap ? <span className="px-1 text-xs text-muted-foreground">…</span> : null}
            <Link
              href={buildProductHref(pathname, { ...filters, page })}
              aria-current={page === filters.page ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: page === filters.page ? "default" : "outline", size: "sm" }),
                "min-w-8 justify-center tabular",
              )}
            >
              {page}
            </Link>
          </span>
        );
      })}

      {nextDisabled ? (
        <span
          aria-disabled="true"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "pointer-events-none opacity-50")}
        >
          <ChevronRight />
        </span>
      ) : (
        <Link
          href={buildProductHref(pathname, { ...filters, page: filters.page + 1 })}
          aria-label="Next page"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronRight />
        </Link>
      )}
    </nav>
  );
}
