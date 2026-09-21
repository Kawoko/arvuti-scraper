import type { ReactNode } from "react";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

interface PageShellProps {
  activePath: string;
  children: ReactNode;
}

export function PageShell({ activePath, children }: PageShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader activePath={activePath} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 sm:px-6 sm:pt-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
