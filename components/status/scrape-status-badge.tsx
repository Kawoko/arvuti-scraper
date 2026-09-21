import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ScrapeRunStatus } from "@/types/database";

const LABELS: Record<ScrapeRunStatus, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export function ScrapeStatusBadge({ status }: { status: ScrapeRunStatus }) {
  if (status === "completed") {
    return (
      <Badge variant="positive">
        <CircleCheck />
        {LABELS.completed}
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="negative">
        <CircleX />
        {LABELS.failed}
      </Badge>
    );
  }

  return (
    <Badge variant="neutral">
      <LoaderCircle />
      {LABELS.running}
    </Badge>
  );
}

/** Truncate and flatten stored error text so the UI never shows raw internals. */
export function sanitizeRunError(message: string | null, maxLength = 160): string | null {
  if (!message) return null;
  const singleLine = message.replace(/\s+/g, " ").trim();
  if (singleLine === "") return null;
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
}
