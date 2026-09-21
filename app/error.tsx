"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. Deliberately exposes no stack traces, database
 * details or credentials — only a friendly message and a retry.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side logging only; the message shown to users stays generic.
    console.error("Route error:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-6">
      <div className="flex size-10 items-center justify-center rounded-full bg-negative-muted text-negative">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          The price data could not be loaded right now. This is usually a temporary database
          connection problem.
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
