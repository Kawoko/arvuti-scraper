import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Price history collected once per day from{" "}
          <a
            href="https://arvutitark.ee"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            arvutitark.ee
          </a>
          . Not affiliated with Arvutitark.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/status" className="transition-colors duration-150 hover:text-foreground">
            Data status
          </Link>
          <Link href="/deals" className="transition-colors duration-150 hover:text-foreground">
            Deals
          </Link>
        </div>
      </div>
    </footer>
  );
}
