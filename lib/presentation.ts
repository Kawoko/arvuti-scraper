import { formatSpecSummary } from "@/lib/arvutitark/normalize";
import type { ProductSpecs } from "@/lib/arvutitark/types";
import { directionFromChange, type PriceDirection } from "@/lib/price";
import type { ProductPriceSummaryRow } from "@/types/database";

/** Rebuild a `ProductSpecs` object from a summary row so shared formatters can be reused. */
export function productSpecsFromRow(row: ProductPriceSummaryRow): ProductSpecs {
  return {
    chipset: row.chipset,
    family: row.family,
    socket: row.socket,
    readSpeedMbs: row.read_speed_mbs,
    writeSpeedMbs: row.write_speed_mbs,
    interfaceType: row.interface_type,
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

/** e.g. `32GB · 2×16GB · DDR5-6000 · CL30 · UDIMM` or `NVIDIA GeForce RTX™ 5070 · 16GB · GDDR7` */
export function specSummaryFromRow(row: ProductPriceSummaryRow): string {
  return formatSpecSummary(productSpecsFromRow(row));
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
