import { Bell, Mail, Webhook } from "lucide-react";

import { saveNotificationSettings } from "@/app/tracked/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NotificationSettingsRow } from "@/types/database";

const THRESHOLDS = [5, 10, 15, 20, 25, 30] as const;

interface PreferencesFormProps {
  settings: NotificationSettingsRow;
}

/**
 * Alert preferences. The values are persisted now; the delivery workers for
 * email and webhooks are deliberately not part of this change.
 */
export function PreferencesForm({ settings }: PreferencesFormProps) {
  const thresholds = THRESHOLDS.includes(
    settings.price_drop_percent as (typeof THRESHOLDS)[number],
  )
    ? THRESHOLDS
    : ([...THRESHOLDS, settings.price_drop_percent].sort((a, b) => a - b) as number[]);

  return (
    <form action={saveNotificationSettings} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Price drop threshold</span>
          <select
            name="priceDropPercent"
            defaultValue={String(settings.price_drop_percent)}
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {thresholds.map((value) => (
              <option key={value} value={value}>
                {value}% below the price when tracked
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">
            For example, 10% turns a €900 tracked price into a €810 alert.
          </span>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Mail className="size-3.5" />
            Email address
          </span>
          <Input
            name="emailAddress"
            type="email"
            defaultValue={settings.email_address ?? ""}
            placeholder="you@example.com"
            maxLength={254}
          />
        </label>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Delivery
        </legend>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="emailEnabled"
            defaultChecked={settings.email_enabled}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            <span className="flex flex-wrap items-center gap-2 font-medium">
              Email alerts
              <Badge variant="neutral">Not sending yet</Badge>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Your choice is saved. Email delivery will be enabled in a later update.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="webhookEnabled"
            defaultChecked={settings.webhook_enabled}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            <span className="flex items-center gap-2 font-medium">
              <Webhook className="size-3.5" />
              Webhook
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              A JSON POST when a tracked product crosses its threshold. Delivery is not wired up
              yet.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-muted-foreground">Generic webhook URL</span>
            <Input
              name="webhookUrl"
              type="url"
              defaultValue={settings.webhook_url ?? ""}
              placeholder="https://example.com/hooks/price"
              maxLength={500}
            />
          </label>

          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-muted-foreground">Discord webhook URL</span>
            <Input
              name="discordWebhookUrl"
              type="url"
              defaultValue={settings.discord_webhook_url ?? ""}
              placeholder="https://discord.com/api/webhooks/…"
              maxLength={500}
            />
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bell className="size-3.5" />
          Alerts are stored per account. Only https URLs are accepted.
        </p>
        <Button type="submit">Save preferences</Button>
      </div>
    </form>
  );
}
