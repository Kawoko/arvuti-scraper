import { Package, PackageX, Unlink } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface StockBadgeProps {
  inStock: boolean;
  /**
   * True when the retailer stopped returning this product. Takes priority over
   * `inStock`: a delisted product keeps its last recorded stock figure forever,
   * so showing "In stock" would be misleading.
   */
  delisted?: boolean;
  className?: string;
}

export function StockBadge({ inStock, delisted = false, className }: StockBadgeProps) {
  if (delisted) {
    return (
      <Badge variant="neutral" className={className}>
        <Unlink />
        No longer listed
      </Badge>
    );
  }

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
