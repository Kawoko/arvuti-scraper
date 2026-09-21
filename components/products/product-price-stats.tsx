import { formatCurrency, formatDate, formatPercent, formatSignedCurrency } from "@/lib/format";
import { directionFromChange } from "@/lib/price";
import { cn } from "@/lib/utils";
import type { ProductPriceSummaryRow } from "@/types/database";

interface StatItem {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
}

export function ProductPriceStats({ row }: { row: ProductPriceSummaryRow }) {
  const direction = directionFromChange(row.price_change);

  const items: StatItem[] = [
    {
      label: "Starting price",
      value: formatCurrency(row.start_price),
      hint: `First recorded ${formatDate(row.start_date)}`,
    },
    {
      label: "Current price",
      value: formatCurrency(row.current_price),
    },
    {
      label: "Historical low",
      value: formatCurrency(row.lowest_price),
    },
    {
      label: "Historical high",
      value: formatCurrency(row.highest_price),
    },
    {
      label: "Average",
      value: formatCurrency(row.average_price),
      hint: `${row.observation_count} observation${row.observation_count === 1 ? "" : "s"}`,
    },
    {
      label: "Total change",
      value:
        row.price_change === null
          ? "—"
          : `${formatSignedCurrency(row.price_change)} · ${formatPercent(row.price_change_percent)}`,
      tone: direction === "down" ? "positive" : direction === "up" ? "negative" : "neutral",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-card px-4 py-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 text-sm font-semibold tabular",
              item.tone === "positive" && "text-positive",
              item.tone === "negative" && "text-negative",
            )}
          >
            {item.value}
          </dd>
          {item.hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}
