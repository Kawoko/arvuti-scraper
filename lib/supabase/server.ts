import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Read-only Supabase client for Server Components and server utilities.
 *
 * Prefers the publishable/anon key, which is restricted to read-only access by
 * Row Level Security. Falls back to the secret key when no publishable key is
 * configured: this still runs server-side only and is never exposed to the
 * browser.
 */
let cached: SupabaseClient<Database> | null = null;

export function getSupabaseReadClient(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_SECRET_KEY) environment variable",
    );
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return cached;
}
