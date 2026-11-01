import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

/**
 * Refresh the Supabase session on every request and pass the rotated cookies to
 * both the downstream request and the browser response.
 *
 * Without this, a magic-link session would silently expire after its access
 * token lifetime, because Server Components cannot persist refreshed cookies.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();

  // Auth is optional for the public read-only pages. Do not break them when the
  // environment is incomplete.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Important: do not remove. This refreshes an expired token and writes the
  // new cookie pair through `setAll`.
  await supabase.auth.getUser();

  return response;
}
