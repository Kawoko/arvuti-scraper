import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/format";
import { directionFromChange, type PriceDirection } from "@/lib/price";
import { cn } from "@/lib/utils";

const DIRECTION_TONE: Record<PriceDirection, string> = {
  down: "text-positive",
  up: "text-negative",
  same: "text-muted-foreground",
};

const DIRECTION_TEXT: Record<PriceDirection, string> = {
  down: "decreased",
  up: "increased",
  same: "unchanged",
};

export function ChangeIcon({ direction, className }: { direction: PriceDirection; className?: string }) {
  const Icon = direction === "down" ? ArrowDown : direction === "up" ? ArrowUp : Minus;
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} />;
}

interface PriceChangeProps {
  change: number | null;
  percent: number | null;
  className?: string;
  /** Hide the absolute euro amount, e.g. in compact cards. */
  showAbsolute?: boolean;
}

/**
 * Movement versus our own recorded starting price.
 *
 * Colour is a secondary cue only: an arrow icon and a screen-reader sentence
 * carry the same information.
 */
export function PriceChange({ change, percent, className, showAbsolute = true }: PriceChangeProps) {
  const direction = directionFromChange(change);
  const hasChange = change !== null && change !== 0;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 tabular", DIRECTION_TONE[direction], className)}
    >
      <ChangeIcon direction={direction} />
      {hasChange ? (
        <>
          {showAbsolute ? <span className="font-medium">{formatCurrency(Math.abs(change))}</span> : null}
          {showAbsolute ? <span className="text-muted-foreground/70">·</span> : null}
          <span className="font-medium">{formatPercent(percent)}</span>
        </>
      ) : (
        <span className="font-medium">No change</span>
      )}
      <span className="sr-only">
        {`${DIRECTION_TEXT[direction]} by ${formatCurrency(Math.abs(change ?? 0))} (${formatPercent(percent)}) since tracking began`}
      </span>
    </span>
  );
}
