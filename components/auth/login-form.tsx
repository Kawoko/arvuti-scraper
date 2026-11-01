"use client";

import { useActionState } from "react";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink, type LoginState } from "@/app/login/actions";

const INITIAL_STATE: LoginState = { status: "idle", message: "" };

interface LoginFormProps {
  next: string;
  initialError?: string;
}

export function LoginForm({ next, initialError }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(sendMagicLink, INITIAL_STATE);

  const error = state.status === "error" ? state.message : initialError;

  if (state.status === "sent") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Sign-in link sent</p>
            <p className="text-muted-foreground">
              We sent a link to <span className="font-medium text-foreground">{state.email}</span>.
              Open it on this device to continue.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          No email after a minute? Check spam, then request another link.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />

      <label htmlFor="email" className="text-sm font-medium">
        Email address
      </label>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        maxLength={254}
      />

      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Mail />}
        {pending ? "Sending…" : "Send sign-in link"}
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        No password needed. An account is created the first time you sign in.
      </p>
    </form>
  );
}
