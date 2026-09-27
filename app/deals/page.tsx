import { Suspense } from "react";
import { Tag } from "lucide-react";

import { GroupSelect } from "@/components/filters/group-select";
import { TabLinks } from "@/components/filters/tab-links";
import { PageShell } from "@/components/layout/page-shell";
import { DealCard } from "@/components/products/deal-card";
import { StaleDataNotice } from "@/components/products/stale-data-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComponentCategory } from "@/lib/arvutitark/types";
import { CATEGORY_LIST, isComponentCategory } from "@/lib/categories";
import {
  DEALS_TABS,
  getDeals,
  getDealsTabCounts,
  isDealsTab,
  type DealsTab,
} from "@/lib/queries/deals";
import { getDataFreshness } from "@/lib/queries/stats";

export const dynamic = "force-dynamic";

interface DealsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Preserves the selected group when switching deal tab, and vice versa. */
function dealsHref(group: string, tab: DealsTab): string {
  const params = new URLSearchParams();
  if (group !== "all") params.set("group", group);
  if (tab !== "biggest_drops") params.set("tab", tab);
  const query = params.toString();
  return query ? `/deals?${query}` : "/deals";
}

const EMPTY_COPY: Record<DealsTab, { title: string; description: string }> = {
  biggest_drops: {
    title: "No price drops recorded",
    description:
      "Nothing is currently cheaper than the price we first recorded. Check back after the next collection.",
  },
  new_lows: {
    title: "No products at a historical low",
    description: "No tracked product is currently at its lowest recorded price.",
  },
  below_start: {
    title: "Nothing below its starting price",
    description: "Every tracked product is at or above the price we first recorded.",
  },
  in_stock: {
    title: "No in-stock discounts",
    description: "No currently available product is cheaper than our recorded starting price.",
  },
};

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const resolvedSearchParams = await searchParams;

  const rawTab = readParam(resolvedSearchParams.tab);
  const tab: DealsTab = isDealsTab(rawTab) ? rawTab : "biggest_drops";

  const rawGroup = readParam(resolvedSearchParams.group);
  const group: ComponentCategory | undefined =
    rawGroup !== null && isComponentCategory(rawGroup) ? rawGroup : undefined;

  const [deals, counts, freshness] = await Promise.all([
    getDeals(tab, group),
    getDealsTabCounts(group),
    getDataFreshness(),
  ]);

  const groupLabel = group ? (CATEGORY_LIST.find((d) => d.category === group)?.label ?? null) : null;

  const tabLinks = DEALS_TABS.map((item) => ({
    value: item.value,
    label: item.label,
    href: dealsHref(group ?? "all", item.value),
    count: counts[item.value],
  }));

  return (
    <PageShell activePath="/deals">
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="text-sm text-muted-foreground">
            {`Products ranked by how far they have fallen from the price we first recorded — not by the retailer's own discount label.`}
          </p>
        </header>

        <StaleDataNotice staleDays={freshness.staleDays} />

        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={<Skeleton className="h-9 w-56 rounded-lg" />}>
            <GroupSelect
              value={group ?? "all"}
              ariaLabel="Filter deals by component group"
              options={[
                { value: "all", label: "All groups" },
                ...CATEGORY_LIST.map((definition) => ({
                  value: definition.category,
                  label: definition.label,
                })),
              ]}
            />
          </Suspense>

          <TabLinks items={tabLinks} active={tab} ariaLabel="Deal categories" />
        </div>

        {deals.length === 0 ? (
          <EmptyState
            icon={<Tag />}
            title={groupLabel ? `No ${groupLabel} deals right now` : EMPTY_COPY[tab].title}
            description={EMPTY_COPY[tab].description}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((row) => (
                // The same product id can exist in two groups, so both are needed.
                <DealCard key={`${row.category}-${row.product_id}`} row={row} />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Showing the top {deals.length} {groupLabel ? `${groupLabel} ` : ""}by percentage
              reduction from the recorded starting price.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
