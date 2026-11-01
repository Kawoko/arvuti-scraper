"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";

import { toggleTrackedProduct } from "@/app/tracked/actions";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  productId: number;
  category: string;
  initialTracked: boolean;
  authenticated: boolean;
  /** Where to return after signing in. */
  loginNext: string;
  className?: string;
}

/**
 * Star toggle shown on every product row.
 *
 * The filled state flips immediately; the server action result is authoritative
 * and is rolled back on failure. Signed-out visitors are sent to sign in instead
 * of being shown an error they cannot act on.
 */
export function FavoriteButton({
  productId,
  category,
  initialTracked,
  authenticated,
  loginNext,
  className,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [tracked, setTracked] = useState(initialTracked);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    // The button sits inside clickable cards and rows; never navigate.
    event.preventDefault();
    event.stopPropagation();

    if (!authenticated) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }

    const next = !tracked;
    setTracked(next);
    setMessage(null);

    startTransition(async () => {
      const result = await toggleTrackedProduct(productId, category);

      if (result.requiresAuth) {
        setTracked(!next);
        router.push(`/login?next=${encodeURIComponent(loginNext)}`);
        return;
      }
      if (result.error) {
        setTracked(!next);
        setMessage(result.error);
        return;
      }
      setTracked(result.tracked);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={tracked}
      aria-label={tracked ? "Remove from tracked items" : "Add to tracked items"}
      title={message ?? (tracked ? "Tracked — click to remove" : "Track this product")}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150",
        "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
        tracked && "text-amber-500 hover:text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Star className="size-4" fill={tracked ? "currentColor" : "none"} />
      )}
    </button>
  );
}
