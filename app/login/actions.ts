"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/auth-server";

export interface LoginState {
  status: "idle" | "sent" | "error";
  message: string;
  email?: string;
}

async function resolveOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host ?? "localhost:3000"}`;
}

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit")) {
    return "Too many sign-in attempts. Please wait a minute and try again.";
  }
  if (lower.includes("invalid email")) {
    return "That email address does not look valid.";
  }
  return "We could not send the sign-in link. Please try again.";
}

export async function sendMagicLink(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = safeNextPath(formData.get("next"));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { status: "error", message: "Enter a valid email address." };
  }

  let supabase;
  try {
    supabase = await createAuthClient();
  } catch {
    return {
      status: "error",
      message: "Sign-in is not configured on this instance yet.",
    };
  }

  const origin = await resolveOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { status: "error", message: friendlyAuthError(error.message) };
  }

  return {
    status: "sent",
    email,
    message: "Check your inbox and open the link on this device to finish signing in.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/");
}
