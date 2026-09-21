import { CalendarCheck, Clock, FileStack, History, Rows3 } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { ScrapeStatusBadge, sanitizeRunError } from "@/components/status/scrape-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime, formatDuration, formatInteger } from "@/lib/format";
import { getLastSuccessfulScrapeRun, getRecentScrapeRuns } from "@/lib/queries/scrape-runs";
import type { ScrapeRunRow } from "@/types/database";

export const dynamic = "force-dynamic";

interface SummaryItem {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}

function buildSummary(runs: ScrapeRunRow[], lastSuccessful: ScrapeRunRow | null): SummaryItem[] {
  const latest = runs[0] ?? null;

  return [
    {
      label: "Last attempt",
      value: latest ? formatDate(latest.scrape_date) : "—",
      hint: latest ? formatDateTime(latest.attempted_at) : undefined,
      icon: <Clock />,
    },
    {
      label: "Last successful scan",
      value: lastSuccessful ? formatDate(lastSuccessful.scrape_date) : "—",
      hint: lastSuccessful ? formatDateTime(lastSuccessful.finished_at) : "No successful run yet",
      icon: <CalendarCheck />,
    },
    {
      label: "Latest status",
      value: latest ? latest.status : "—",
      hint: latest?.error_message ? "See the run list below" : undefined,
      icon: <History />,
    },
    {
      label: "Products",
      value: formatInteger(latest?.product_count ?? lastSuccessful?.product_count ?? null),
      hint: "In the most recent successful collection",
      icon: <FileStack />,
    },
    {
      label: "Pages",
      value: formatInteger(latest?.page_count ?? null),
      hint: "Arvutitark API pages fetched",
      icon: <Rows3 />,
    },
    {
      label: "Duration",
      value: latest ? formatDuration(latest.attempted_at, latest.finished_at) : "—",
      hint: latest?.finished_at ? "Attempt to finish" : "Still running",
      icon: <Clock />,
    },
  ];
}

function RunRowItem({ run }: { run: ScrapeRunRow }) {
  const detail =
    run.status === "completed"
      ? `${formatInteger(run.product_count)} products · ${formatInteger(run.page_count)} pages`
      : run.status === "failed"
        ? (sanitizeRunError(run.error_message) ?? "Collection failed")
        : "In progress";

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
      <span className="w-28 shrink-0 font-medium tabular">{formatDate(run.scrape_date)}</span>
      <ScrapeStatusBadge status={run.status} />
      <span className={run.status === "failed" ? "text-negative" : "text-muted-foreground"}>
        {detail}
      </span>
      <span className="ml-auto text-xs text-muted-foreground tabular">
        {run.finished_at ? formatDateTime(run.finished_at) : formatDateTime(run.attempted_at)}
      </span>
    </li>
  );
}

export default async function StatusPage() {
  const [runs, lastSuccessful] = await Promise.all([
    getRecentScrapeRuns(14),
    getLastSuccessfulScrapeRun(),
  ]);

  const summary = buildSummary(runs, lastSuccessful);

  return (
    <PageShell activePath="/status">
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Collection status</h1>
          <p className="text-sm text-muted-foreground">
            Arvutitark is contacted at most once per Estonian calendar day, no matter how often the
            scheduler runs.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {summary.map((item) => (
            <Card key={item.label}>
              <CardContent className="flex flex-col gap-2 px-4 py-3">
                <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  {item.label}
                  <span className="[&_svg]:size-3.5">{item.icon}</span>
                </span>
                <span className="text-sm font-semibold capitalize tabular">{item.value}</span>
                {item.hint ? (
                  <span className="text-[11px] text-muted-foreground">{item.hint}</span>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {runs.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="No runs recorded yet"
                  description="Once the daily scheduler executes, each attempt and its outcome appears here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {runs.map((run) => (
                  <RunRowItem key={run.scrape_date} run={run} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How the daily limit works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              {`The scheduler may invoke the scraper every hour. Each invocation first tries to claim today's date in the database. If the claim already exists, the script exits without contacting Arvutitark.`}
            </p>
            <p>
              A failed run stays recorded and is never retried on the same day, so a crash or a
              retailer outage cannot produce duplicate API traffic.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
