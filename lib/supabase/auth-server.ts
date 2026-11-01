import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

/**
 * Request-scoped Supabase client that carries the visitor's auth session.
 *
 * The publishable/anon key is used on purpose: the session is subject to Row
 * Level Security, so every read and write is scoped to the signed-in user by the
 * database itself. The secret key is never used for user-facing requests.
 *
 * Cookie writes throw inside Server Components. That is expected: middleware
 * refreshes the session before the component tree renders, so the write attempt
 * there is a no-op rather than an error.
 */
export async function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component. Middleware already refreshed the
          // session, so there is nothing else to do here.
        }
      },
    },
  });
}

/**
 * Reuse one client per request. The header, the listing and the detail page all
 * ask for the same session, and each fresh client would otherwise duplicate the
 * auth round trip.
 */
const getCachedAuthClient = cache(createAuthClient);

export function getAuthClient() {
  return getCachedAuthClient();
}

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Resolve the signed-in user from the session cookie.
 *
 * `getUser()` validates the token with Supabase Auth instead of trusting the
 * cookie payload, which is what makes it safe to authorise with. Cached per
 * request so several components can call it for free.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const supabase = await getAuthClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    // Missing configuration must not take down public pages: they degrade to
    // the signed-out view.
    return null;
  }
});
