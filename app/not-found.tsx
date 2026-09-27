import Link from "next/link";
import { PackageSearch } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-24 sm:px-6">
      <EmptyState
        icon={<PackageSearch />}
        title="Product not found"
        description="This product is not tracked in this group, or the link is incorrect. It may have been delisted by the retailer, or it may be tracked under a different group."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              RAM
            </Link>
            <Link href="/gpu" className={buttonVariants({ variant: "outline" })}>
              GPUs
            </Link>
            <Link href="/cpu" className={buttonVariants({ variant: "outline" })}>
              CPUs
            </Link>
            <Link href="/hdd" className={buttonVariants({ variant: "outline" })}>
              HDDs
            </Link>
            <Link href="/ssd" className={buttonVariants({ variant: "outline" })}>
              SSDs
            </Link>
            <Link href="/custom" className={buttonVariants({ variant: "outline" })}>
              Custom
            </Link>
          </div>
        }
      />
    </div>
  );
}
