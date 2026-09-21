import { AlertCircle } from "lucide-react";

interface StaleDataNoticeProps {
  staleDays: number | null;
}

/**
 * Calm, factual freshness warning. Only rendered when the last successful
 * collection is older than a single day.
 */
export function StaleDataNotice({ staleDays }: StaleDataNoticeProps) {
  if (staleDays === null || staleDays < 2) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>
        Price data last refreshed{" "}
        <span className="font-medium text-foreground">{staleDays} days ago</span>. The daily
        collection may have failed or been paused.
      </p>
    </div>
  );
}
