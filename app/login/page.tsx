import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth";
import { getCurrentUser } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to track products and save price-drop preferences.",
};

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNextPath(readParam(params.next));
  const user = await getCurrentUser();

  if (user) redirect(next);

  const initialError = readParam(params.error);

  return (
    <PageShell activePath="/login">
      <div className="mx-auto w-full max-w-md pt-6">
        <Card>
          <CardHeader className="gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="size-4" />
            </span>
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>
              Track products across every category and choose when you want to be alerted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm next={next} initialError={initialError} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
