import Link from "next/link";

import { cn } from "@/lib/utils";

export interface TabLinkItem {
  value: string;
  label: string;
  href: string;
  count?: number;
}

interface TabLinksProps {
  items: TabLinkItem[];
  active: string;
  ariaLabel: string;
}

/**
 * URL-driven tabs. Server-rendered links keep every tab state shareable and
 * avoid shipping client-side state for what is really navigation.
 */
export function TabLinks({ items, active, ariaLabel }: TabLinksProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/40 p-1"
    >
      {items.map((item) => {
        const isActive = item.value === active;
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              isActive
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="text-xs text-muted-foreground tabular">{item.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
