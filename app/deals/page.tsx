import { Tag } from "lucide-react";

import { TabLinks } from "@/components/filters/tab-links";
import { PageShell } from "@/components/layout/page-shell";
import { DealCard } from "@/components/products/deal-card";
import { StaleDataNotice } from "@/components/products/stale-data-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { DEALS_TABS, getDeals, getDealsTabCounts, isDealsTab, type DealsTab } from "@/lib/queries/deals";
import { getDashboardStats } from "@/lib/queries/stats";

export const dynamic = "force-dynamic";

interface DealsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const EMPTY_COPY: Record<DealsTab, { title: string; description: string }> = {
  biggest_drops: {
    title: "No price drops recorded",
    description:
      "Nothing is currently cheaper than the price we first recorded. Check back after the next daily collection.",
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
  const rawTab = Array.isArray(resolvedSearchParams.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams.tab;
  const tab: DealsTab = isDealsTab(rawTab) ? rawTab : "biggest_drops";

  const [deals, counts, stats] = await Promise.all([
    getDeals(tab),
    getDealsTabCounts(),
    getDashboardStats(),
  ]);

  const tabLinks = DEALS_TABS.map((item) => ({
    value: item.value,
    label: item.label,
    href: item.value === "biggest_drops" ? "/deals" : `/deals?tab=${item.value}`,
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

        <StaleDataNotice staleDays={stats.staleDays} />

        <TabLinks items={tabLinks} active={tab} ariaLabel="Deal categories" />

        {deals.length === 0 ? (
          <EmptyState
            icon={<Tag />}
            title={EMPTY_COPY[tab].title}
            description={EMPTY_COPY[tab].description}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((row) => (
                <DealCard key={row.product_id} row={row} />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Showing the top {deals.length} by percentage reduction from the starting price.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
