import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Star } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { StaleDataNotice } from "@/components/products/stale-data-notice";
import { PreferencesForm } from "@/components/tracked/preferences-form";
import { TrackedTable } from "@/components/tracked/tracked-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getDataFreshness } from "@/lib/queries/stats";
import { getNotificationSettings, getTrackedProducts, getTrackingContext } from "@/lib/queries/tracked";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tracked items",
  description: "Products you track and the price-drop alerts you want.",
};

interface TrackedPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TrackedPage({ searchParams }: TrackedPageProps) {
  const params = await searchParams;
  const { user } = await getTrackingContext();

  if (!user) {
    return (
      <PageShell activePath="/tracked">
        <div className="mx-auto w-full max-w-lg space-y-6 pt-6">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">Tracked items</h1>
          </header>

          <Card>
            <CardHeader className="gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Star className="size-4" />
              </span>
              <CardTitle className="text-lg">Sign in to see your tracked products</CardTitle>
              <CardDescription>
                Starred products and alert preferences are saved to your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/login?next=%2Ftracked">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Browse products</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  const [items, settings, freshness] = await Promise.all([
    getTrackedProducts(),
    getNotificationSettings(user.email),
    getDataFreshness(),
  ]);

  const saved = readParam(params.saved) === "1";
  const saveError = readParam(params.error);

  return (
    <PageShell activePath="/tracked">
      <div className="space-y-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Tracked items</h1>
          <p className="text-sm text-muted-foreground tabular">
            {items.length} product{items.length === 1 ? "" : "s"}
          </p>
        </header>

        <StaleDataNotice staleDays={freshness.staleDays} />

        {saved ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-positive-muted/60 px-3 py-2 text-sm text-positive">
            <CheckCircle2 className="size-4 shrink-0" />
            Preferences saved.
          </div>
        ) : saveError ? (
          <div className="rounded-lg border border-border bg-negative-muted/60 px-3 py-2 text-sm text-negative">
            {saveError}
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={<Star />}
            title="Nothing tracked yet"
            description="Open any category and press the star beside a product to track it here."
          />
        ) : (
          <TrackedTable
            rows={items}
            thresholdPercent={settings.price_drop_percent}
            authenticated
            loginNext="/tracked"
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Price-drop alerts</CardTitle>
            <CardDescription>
              Choose the drop that matters to you. Delivery is not enabled yet — preferences are
              saved for when it is.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreferencesForm settings={settings} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
