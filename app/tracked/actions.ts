"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth";
import { isComponentCategory } from "@/lib/categories";
import { createAuthClient, getCurrentUser } from "@/lib/supabase/auth-server";

export interface ToggleTrackedResult {
  tracked: boolean;
  requiresAuth?: boolean;
  error?: string;
}

/**
 * Add or remove one product from the signed-in user's tracked list.
 *
 * The star is optimistic on the client, so this returns the authoritative state
 * for reconciliation. Unauthenticated callers are told to sign in rather than
 * receiving a silent failure.
 */
export async function toggleTrackedProduct(
  productId: number,
  category: string,
): Promise<ToggleTrackedResult> {
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return { tracked: false, error: "Unknown product." };
  }
  if (!isComponentCategory(category)) {
    return { tracked: false, error: "Unknown product group." };
  }

  const user = await getCurrentUser();
  if (!user) return { tracked: false, requiresAuth: true };

  const supabase = await createAuthClient();

  const { data: existing, error: lookupError } = await supabase
    .from("tracked_products")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("category", category)
    .maybeSingle();

  if (lookupError) {
    return { tracked: false, error: "Could not update your tracked list." };
  }

  if (existing) {
    const { error } = await supabase.from("tracked_products").delete().eq("id", existing.id);
    if (error) return { tracked: true, error: "Could not remove this product." };
  } else {
    // Snapshot the current price so alerts can be measured from the moment the
    // user started tracking, not from the product's first-ever observation.
    const { data: summary } = await supabase
      .from("product_price_summary")
      .select("current_price")
      .eq("product_id", productId)
      .eq("category", category)
      .maybeSingle();

    const { error } = await supabase.from("tracked_products").insert({
      user_id: user.id,
      product_id: productId,
      category,
      price_at_tracking: summary?.current_price ?? null,
    });

    if (error) return { tracked: false, error: "Could not track this product." };
  }

  // The star state appears on every listing, so refresh the whole tree.
  revalidatePath("/", "layout");

  return { tracked: !existing };
}

function readString(formData: FormData, key: string, maxLength: number): string {
  return String(formData.get(key) ?? "")
    .trim()
    .slice(0, maxLength);
}

/** Accept only absolute https URLs, or an empty string meaning "not set". */
function readWebhookUrl(formData: FormData, key: string): string | null {
  const raw = readString(formData, key, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function saveNotificationSettings(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNextPath("/tracked"))}`);

  const supabase = await createAuthClient();

  const percentRaw = Number(formData.get("priceDropPercent"));
  const priceDropPercent =
    Number.isInteger(percentRaw) && percentRaw >= 1 && percentRaw <= 90 ? percentRaw : 10;

  const emailEnabled = formData.get("emailEnabled") === "on";
  const emailAddress = readString(formData, "emailAddress", 254) || user.email || null;

  const { error } = await supabase.from("notification_settings").upsert(
    {
      user_id: user.id,
      price_drop_percent: priceDropPercent,
      email_enabled: emailEnabled,
      email_address: emailAddress,
      discord_webhook_url: readWebhookUrl(formData, "discordWebhookUrl"),
      webhook_enabled: formData.get("webhookEnabled") === "on",
      webhook_url: readWebhookUrl(formData, "webhookUrl"),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    redirect("/tracked?error=Could+not+save+your+preferences.");
  }

  revalidatePath("/tracked");
  redirect("/tracked?saved=1");
}
