import { CalendarClock, Package, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatInteger } from "@/lib/format";
import type { DashboardStats } from "@/lib/queries/stats";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular tracking-tight">{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

interface SummaryCardsProps {
  stats: DashboardStats;
  /** Short description of what is tracked, e.g. "DDR5 UDIMM 5600 / 6000 MHz". */
  hint: string;
}

export function SummaryCards({ stats, hint }: SummaryCardsProps) {
  const lastScan = stats.lastSuccessfulScan;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Products tracked"
        value={formatInteger(stats.productsTracked)}
        hint={hint}
        icon={<Package />}
      />
      <StatCard
        label="Price drops today"
        value={formatInteger(stats.dropsToday)}
        hint="Cheaper than the previous scan"
        icon={<TrendingDown />}
      />
      <StatCard
        label="Below starting price"
        value={formatInteger(stats.belowStartPrice)}
        hint="Versus our first recorded price"
        icon={<TrendingUp />}
      />
      <StatCard
        label="New historical lows"
        value={formatInteger(stats.newHistoricalLows)}
        hint="At their lowest recorded price"
        icon={<Sparkles />}
      />

      <Card className="col-span-2 lg:col-span-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Last successful scan
          </span>
          <span className="flex items-center gap-3 text-xs">
            <span className="font-medium tabular">
              {lastScan ? formatDate(lastScan.scrape_date) : "No successful scan yet"}
            </span>
            {lastScan?.product_count ? (
              <span className="text-muted-foreground tabular">{formatInteger(lastScan.product_count)} products</span>
            ) : null}
            <Link href="/status" className="text-primary underline-offset-4 hover:underline">
              View status
            </Link>
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
