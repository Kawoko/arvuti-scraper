import Link from "next/link";
import { Activity, Layers } from "lucide-react";

import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { href: "/", label: "RAM" },
  { href: "/deals", label: "Deals" },
  { href: "/status", label: "Status" },
] as const;

interface SiteHeaderProps {
  activePath: string;
}

export function SiteHeader({ activePath }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers className="size-4" />
          </span>
          <span className="hidden sm:inline">Arvutitark Tracker</span>
          <span className="sm:hidden">Tracker</span>
        </Link>

        <nav aria-label="Main" className="ml-1 flex items-center gap-0.5">
          {NAV_LINKS.map((link) => {
            const active = link.href === activePath;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
            <Activity className="size-3.5" />
            Europe/Tallinn
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
