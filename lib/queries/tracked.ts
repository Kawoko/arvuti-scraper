import type { ComponentCategory } from "@/lib/arvutitark/types";
import { isComponentCategory } from "@/lib/categories";
import {
  getAuthClient,
  getCurrentUser,
  type SessionUser,
} from "@/lib/supabase/auth-server";
import { trackedKey } from "@/lib/tracking";
import type {
  NotificationSettingsRow,
  TrackedProductDetailRow,
} from "@/types/database";

import { DataAccessError } from "./errors";
import { LIST_COLUMNS } from "./products";

/** Extra columns the tracked page needs on top of the normal list shape. */
export const TRACKED_COLUMNS = ["tracked_at", "price_at_tracking", LIST_COLUMNS].join(",");

export interface TrackedItem {
  productId: number;
  category: ComponentCategory;
  /** Composite key used by the star buttons. */
  key: string;
  trackedAt: string;
  priceAtTracking: number | null;
}

export interface TrackingContext {
  user: SessionUser | null;
  /** Composite keys of every starred product, for the star buttons. */
  trackedKeys: Set<string>;
}

/**
 * Resolve the signed-in user and their starred keys in one round trip instead
 * of two. Public pages degrade to the signed-out state if auth is unavailable.
 */
export async function getTrackingContext(): Promise<TrackingContext> {
  try {
    const user = await getCurrentUser();
    if (!user) return { user: null, trackedKeys: new Set() };

    const supabase = await getAuthClient();
    const { data, error } = await supabase
      .from("tracked_products")
      .select("product_id,category")
      .eq("user_id", user.id);

    if (error) return { user, trackedKeys: new Set() };

    return {
      user,
      trackedKeys: new Set(
        (data ?? [])
          .filter((row) => isComponentCategory(row.category))
          .map((row) => trackedKey(row.category, row.product_id)),
      ),
    };
  } catch {
    return { user: null, trackedKeys: new Set() };
  }
}

/**
 * Every product the signed-in user has starred, as composite keys.
 *
 * One small query is issued per listing render so the star can render filled
 * without fetching the full tracked rows. RLS scopes the result to the caller.
 */
export async function getTrackedKeys(): Promise<Set<string>> {
  return (await getTrackingContext()).trackedKeys;
}

/**
 * Starred products joined to their current price summary, newest first.
 *
 * The view enforces `auth.uid() = user_id` through its underlying RLS policy,
 * so this can never return another user's favourites.
 */
export async function getTrackedProducts(): Promise<TrackedProductDetailRow[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await getAuthClient();
  const { data, error } = await supabase
    .from("tracked_product_details")
    .select(TRACKED_COLUMNS)
    .eq("user_id", user.id)
    .order("tracked_at", { ascending: false })
    .order("product_id", { ascending: true });

  if (error) {
    throw new DataAccessError("Failed to load your tracked products", error.message);
  }

  return (data ?? []) as unknown as TrackedProductDetailRow[];
}

export const DEFAULT_NOTIFICATION_SETTINGS = {
  price_drop_percent: 10,
  email_enabled: false,
  email_address: null,
  discord_webhook_url: null,
  webhook_enabled: false,
  webhook_url: null,
} as const;

export async function getNotificationSettings(
  emailFallback: string | null,
): Promise<NotificationSettingsRow> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user_id: "",
      updated_at: new Date(0).toISOString(),
      ...DEFAULT_NOTIFICATION_SETTINGS,
      email_address: emailFallback,
    };
  }

  const supabase = await getAuthClient();
  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Failed to load your alert preferences", error.message);
  }

  return (
    data ?? {
      user_id: user.id,
      updated_at: new Date(0).toISOString(),
      ...DEFAULT_NOTIFICATION_SETTINGS,
      email_address: emailFallback,
    }
  );
}
