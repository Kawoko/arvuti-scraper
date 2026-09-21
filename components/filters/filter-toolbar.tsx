"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AVAILABILITY_OPTIONS,
  DISCOUNT_OPTIONS,
  PRICE_STATUS_OPTIONS,
  SORT_OPTIONS,
  countActiveFilters,
  type ProductFilters,
} from "@/lib/filters";
import type { FilterFacets } from "@/lib/queries/products";
import { cn } from "@/lib/utils";

const ALL = "all";

interface FilterToolbarProps {
  filters: ProductFilters;
  facets: FilterFacets;
  total: number;
}

export function FilterToolbar({ filters, facets, total }: FilterToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(filters.q);

  const busy = isPending;

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "" || value === ALL) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Any filter change resets pagination so results are not skipped.
      if (key !== "page") params.delete("page");

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Keep the input in sync when the URL changes from elsewhere (e.g. Reset).
  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  // Debounced search so we do not push a URL change on every keystroke.
  useEffect(() => {
    if (searchValue === filters.q) return;
    const timer = setTimeout(() => {
      setParam("q", searchValue.trim() === "" ? null : searchValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.q, searchValue, setParam]);

  const activeCount = countActiveFilters(filters);

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-xs sm:p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by name, brand or SKU…"
              aria-label="Search products"
              className="pl-9"
            />
          </div>

          <div className="sm:w-56">
            <Select value={filters.sort} onValueChange={(value) => setParam("sort", value)}>
              <SelectTrigger aria-label="Sort products">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Select
            value={filters.brand || ALL}
            onValueChange={(value) => setParam("brand", value)}
          >
            <SelectTrigger aria-label="Filter by brand">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All brands</SelectItem>
              {facets.brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.capacityGb || ALL}
            onValueChange={(value) => setParam("capacity", value)}
          >
            <SelectTrigger aria-label="Filter by capacity">
              <SelectValue placeholder="Capacity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any capacity</SelectItem>
              {facets.capacities.map((capacity) => (
                <SelectItem key={capacity} value={String(capacity)}>
                  {capacity} GB
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.speedMhz || ALL} onValueChange={(value) => setParam("speed", value)}>
            <SelectTrigger aria-label="Filter by speed">
              <SelectValue placeholder="Speed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any speed</SelectItem>
              {facets.speeds.map((speed) => (
                <SelectItem key={speed} value={String(speed)}>
                  {speed} MHz
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.casLatency || ALL}
            onValueChange={(value) => setParam("cl", value)}
          >
            <SelectTrigger aria-label="Filter by CAS latency">
              <SelectValue placeholder="CL" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any CL</SelectItem>
              {facets.casLatencies.map((casLatency) => (
                <SelectItem key={casLatency} value={String(casLatency)}>
                  CL{casLatency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.moduleCount || ALL}
            onValueChange={(value) => setParam("modules", value)}
          >
            <SelectTrigger aria-label="Filter by module configuration">
              <SelectValue placeholder="Modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any layout</SelectItem>
              {facets.moduleCounts.map((modules) => (
                <SelectItem key={modules} value={String(modules)}>
                  {modules} module{modules === 1 ? "" : "s"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.availability}
            onValueChange={(value) => setParam("availability", value)}
          >
            <SelectTrigger aria-label="Filter by availability">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.priceStatus} onValueChange={(value) => setParam("price", value)}>
            <SelectTrigger aria-label="Filter by price status">
              <SelectValue placeholder="Price status" />
            </SelectTrigger>
            <SelectContent>
              {PRICE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.minDiscount} onValueChange={(value) => setParam("discount", value)}>
            <SelectTrigger aria-label="Filter by discount">
              <SelectValue placeholder="Discount" />
            </SelectTrigger>
            <SelectContent>
              {DISCOUNT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span aria-live="polite" className={cn(busy && "opacity-60")}>
            {busy ? "Updating…" : `${total} product${total === 1 ? "" : "s"}`}
          </span>

          {activeCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchValue("");
                startTransition(() => router.replace(pathname, { scroll: false }));
              }}
            >
              <X />
              Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
