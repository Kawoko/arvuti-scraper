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
        description="This product is not tracked, or the link is incorrect. It may have been delisted by the retailer."
        action={
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to all RAM
          </Link>
        }
      />
    </div>
  );
}
