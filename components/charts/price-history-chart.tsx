"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency, formatDayMonth } from "@/lib/format";
import type { PriceHistoryPoint } from "@/lib/queries/product-detail";

interface ChartPoint {
  date: string;
  label: string;
  price: number;
}

interface PriceHistoryChartProps {
  history: PriceHistoryPoint[];
  startPrice: number;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{point.label}</p>
      <p className="text-sm font-semibold tabular text-popover-foreground">
        {formatCurrency(point.price)}
      </p>
    </div>
  );
}

function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function PriceHistoryChart({ history, startPrice }: PriceHistoryChartProps) {
  const isDark = useDarkMode();

  const data: ChartPoint[] = history.map((point) => ({
    date: point.observedDate,
    label: formatDayMonth(`${point.observedDate}T00:00:00Z`),
    price: point.price,
  }));

  const prices = data.map((point) => point.price);
  const min = Math.min(startPrice, ...prices);
  const max = Math.max(startPrice, ...prices);
  const padding = Math.max(1, (max - min) * 0.15);
  const domain: [number, number] = [Math.floor(min - padding), Math.ceil(max + padding)];

  const gridColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const axisColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const lineColor = isDark ? "oklch(0.7 0.155 265)" : "oklch(0.54 0.185 265)";

  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          {/* Horizontal gridlines only: enough to read values, no clutter. */}
          <CartesianGrid stroke={gridColor} vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fill: axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={domain}
            tick={{ fill: axisColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => `€${Math.round(value)}`}
          />

          <Tooltip content={<ChartTooltip />} cursor={{ stroke: gridColor }} />

          {/* Starting price reference: dashed and subtle, never misleading. */}
          <ReferenceLine
            y={startPrice}
            stroke={axisColor}
            strokeDasharray="4 4"
            strokeWidth={1}
            ifOverflow="extendDomain"
          />

          <Line
            type="monotone"
            dataKey="price"
            stroke={lineColor}
            strokeWidth={2}
            dot={data.length <= 45 ? { r: 2, strokeWidth: 0, fill: lineColor } : false}
            activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
