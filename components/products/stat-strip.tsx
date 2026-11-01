import { formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/queries/stats";

/** Small server-rendered ring; no chart library and no client JavaScript. */
function StatRing({ percent, tone }: { percent: number; tone: string }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * circumference;

  return (
    <span className="relative inline-flex size-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="size-10 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className={cn("transition-[stroke-dasharray]", tone)}
        />
      </svg>
      <span className="absolute text-[9px] font-semibold tabular text-muted-foreground">
        {Math.round(clamped)}%
      </span>
    </span>
  );
}

interface StatItem {
  label: string;
  value: number;
  /** Denominator for the ring; 0 renders an empty ring. */
  total: number;
  caption: string;
  tone: string;
}

interface StatStripProps {
  stats: DashboardStats;
}

/**
 * The only summary figures on a listing page: four counts, each with its share
 * of the tracked catalogue. No marketing copy, no second row of freshness text.
 */
export function StatStrip({ stats }: StatStripProps) {
  const total = stats.productsTracked;

  const items: StatItem[] = [
    {
      label: "Products tracked",
      value: total,
      total,
      caption: "in this group",
      tone: "stroke-primary",
    },
    {
      label: "Price drops today",
      value: stats.dropsToday,
      total,
      caption: "vs. previous scan",
      tone: "stroke-positive",
    },
    {
      label: "Below starting price",
      value: stats.belowStartPrice,
      total,
      caption: "vs. first recorded price",
      tone: "stroke-primary",
    },
    {
      label: "New historical lows",
      value: stats.newHistoricalLows,
      total,
      caption: "at their lowest recorded price",
      tone: "stroke-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs sm:grid-cols-4 sm:divide-y-0">
      {items.map((item) => {
        const percent = item.total > 0 ? (item.value / item.total) * 100 : 0;

        return (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 px-4 py-3.5"
            title={`${formatInteger(item.value)} of ${formatInteger(item.total)} · ${item.caption}`}
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-xl font-semibold leading-none tabular tracking-tight">
                {formatInteger(item.value)}
              </p>
              <p className="mt-1 truncate text-[10px] text-muted-foreground">{item.caption}</p>
            </div>
            {item.label === "Products tracked" ? (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold tabular text-muted-foreground">
                {formatInteger(item.value)}
              </span>
            ) : (
              <StatRing percent={percent} tone={item.tone} />
            )}
          </div>
        );
      })}
    </div>
  );
}
