import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Info } from "lucide-react";

import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { PageShell } from "@/components/layout/page-shell";
import { PriceChange } from "@/components/products/price-change";
import { ProductPriceStats } from "@/components/products/product-price-stats";
import { ProductSpecList } from "@/components/products/product-spec-list";
import { StockBadge } from "@/components/products/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateTime, formatInteger } from "@/lib/format";
import { specSummaryFromRow } from "@/lib/presentation";
import { getProductDetail } from "@/lib/queries/product-detail";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

/** Request-scoped memoisation so metadata and the page share one query. */
const getProductDetailCached = cache(getProductDetail);

function parseProductId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const productId = parseProductId(id);
  if (productId === null) return { title: "Product not found" };

  const detail = await getProductDetailCached(productId);
  if (!detail) return { title: "Product not found" };

  const summary = specSummaryFromRow(detail.summary);

  return {
    title: detail.summary.name,
    description: summary ? `${summary} — ${formatCurrency(detail.summary.current_price)}` : undefined,
  };
}

function AvailabilityPanel({
  warehouseStock,
  localStock,
  shopStock,
  totalStock,
  observedAt,
}: {
  warehouseStock: number | null;
  localStock: number | null;
  shopStock: Record<string, number> | null;
  totalStock: number;
  observedAt: string;
}) {
  const shops = Object.entries(shopStock ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <div className="space-y-3">
      <dl className="space-y-2">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
          <dt className="text-xs text-muted-foreground">Central warehouse</dt>
          <dd className="text-sm font-medium tabular">{formatInteger(warehouseStock ?? 0)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
          <dt className="text-xs text-muted-foreground">Local stock</dt>
          <dd className="text-sm font-medium tabular">{formatInteger(localStock ?? 0)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
          <dt className="text-xs text-muted-foreground">Total across shops</dt>
          <dd className="text-sm font-medium tabular">{formatInteger(totalStock)}</dd>
        </div>
      </dl>

      {shops.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Per shop</p>
          <div className="flex flex-wrap gap-1.5">
            {shops.map(([shopId, count]) => (
              <span
                key={shopId}
                className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs tabular text-muted-foreground"
              >
                Shop {shopId}: {count}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Recorded {formatDateTime(observedAt)} · Tallinn time
      </p>
    </div>
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const productId = parseProductId(id);
  if (productId === null) notFound();

  const detail = await getProductDetailCached(productId);
  if (!detail) notFound();

  const { summary, history } = detail;
  const specs = specSummaryFromRow(summary);

  return (
    <PageShell activePath="/">
      <div className="space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All RAM
        </Link>

        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {summary.brand ?? "RAM"}
            </p>
            <h1 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              {summary.name}
            </h1>
            {specs ? <p className="text-sm text-muted-foreground">{specs}</p> : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              <span className="text-3xl font-semibold tabular tracking-tight">
                {formatCurrency(summary.current_price)}
              </span>
              <PriceChange change={summary.price_change} percent={summary.price_change_percent} />
              <StockBadge inStock={summary.in_stock} />
            </div>
          </div>

          {summary.url ? (
            <Button asChild variant="outline" className="shrink-0">
              <a href={summary.url} target="_blank" rel="noreferrer noopener">
                View on Arvutitark
                <ArrowUpRight />
              </a>
            </Button>
          ) : null}
        </header>

        <ProductPriceStats row={summary} />

        <Card>
          <CardHeader>
            <CardTitle>Price history</CardTitle>
            <CardDescription>
              One observation per day, recorded in Estonia time. The dashed line marks the price we
              first recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState
                icon={<Info />}
                title="No price history yet"
                description="This product has not accumulated any daily observations."
              />
            ) : (
              <PriceHistoryChart history={history} startPrice={summary.start_price} />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Specifications</CardTitle>
              <CardDescription>{"Extracted from the retailer's product data."}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductSpecList row={summary} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
              <CardDescription>
                {summary.in_stock ? "Available at Arvutitark" : "Currently out of stock"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvailabilityPanel
                warehouseStock={summary.current_warehouse_stock}
                localStock={summary.current_local_stock}
                shopStock={summary.current_shop_stock}
                totalStock={summary.current_total_stock}
                observedAt={summary.current_observed_at}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
