import { formatSpecSummary } from "@/lib/arvutitark/normalize";
import type { RamSpecs } from "@/lib/arvutitark/types";
import { directionFromChange, type PriceDirection } from "@/lib/price";
import type { ProductPriceSummaryRow } from "@/types/database";

/** Rebuild a `RamSpecs` object from a summary row so shared formatters can be reused. */
export function ramSpecsFromRow(row: ProductPriceSummaryRow): RamSpecs {
  return {
    memoryType: row.memory_type,
    capacityGb: row.capacity_gb,
    speedMhz: row.speed_mhz,
    casLatency: row.cas_latency,
    moduleCount: row.module_count,
    capacityPerModuleGb: row.capacity_per_module_gb,
    formFactor: row.form_factor,
    voltage: row.voltage,
  };
}

/** e.g. `32GB · 2×16GB · DDR5-6000 · CL30 · UDIMM` */
export function specSummaryFromRow(row: ProductPriceSummaryRow): string {
  return formatSpecSummary(ramSpecsFromRow(row));
}

/**
 * Direction of movement relative to our own recorded starting price.
 * `null` change means "no comparable history yet", which renders as unchanged.
 */
export function changeDirectionFromRow(row: ProductPriceSummaryRow): PriceDirection {
  return directionFromChange(row.price_change);
}

export function stockLabel(inStock: boolean): string {
  return inStock ? "In stock" : "Out of stock";
}

export function openInNewTabProps() {
  return { target: "_blank", rel: "noreferrer noopener" } as const;
}
