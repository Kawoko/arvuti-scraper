import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/auth-server";

/**
 * Magic-link landing point. Supabase verifies the emailed token and redirects
 * here with a one-time `code`, which is exchanged for a cookie-backed session.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("That sign-in link is invalid or has expired.")}`, request.url),
    );
  }

  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } catch {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("That sign-in link is invalid or has expired.")}`, request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
