import { Package, PackageX } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function StockBadge({ inStock, className }: { inStock: boolean; className?: string }) {
  if (inStock) {
    return (
      <Badge variant="positive" className={className}>
        <Package />
        In stock
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" className={className}>
      <PackageX />
      Out of stock
    </Badge>
  );
}
