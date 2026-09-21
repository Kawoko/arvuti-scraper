import type { CategoryDefinition } from "@/lib/categories";
import { formatInteger } from "@/lib/format";
import type { ProductPriceSummaryRow } from "@/types/database";

interface SpecRow {
  label: string;
  value: string;
}

function buildSpecRows(row: ProductPriceSummaryRow, capacityLabel: string): SpecRow[] {
  const rows: SpecRow[] = [];

  // Graphics cards.
  if (row.chipset) rows.push({ label: "Chipset", value: row.chipset });

  if (row.memory_type) rows.push({ label: "Memory type", value: row.memory_type });
  if (row.capacity_gb !== null) {
    rows.push({ label: capacityLabel, value: `${formatInteger(row.capacity_gb)} GB` });
  }

  // RAM-specific fields; all null for graphics cards.
  if (row.module_count !== null) rows.push({ label: "Modules", value: `${row.module_count}` });
  if (row.capacity_per_module_gb !== null) {
    rows.push({
      label: "Capacity per module",
      value: `${formatInteger(row.capacity_per_module_gb)} GB`,
    });
  }
  if (row.speed_mhz !== null) {
    rows.push({ label: "Speed", value: `${formatInteger(row.speed_mhz)} MHz` });
  }
  if (row.cas_latency !== null) rows.push({ label: "CAS latency", value: `CL${row.cas_latency}` });
  if (row.form_factor) rows.push({ label: "Form factor", value: row.form_factor });
  if (row.voltage !== null) {
    rows.push({ label: "Voltage", value: `${Number(row.voltage).toFixed(2)} V` });
  }

  if (row.sku) rows.push({ label: "SKU", value: row.sku });
  if (row.ean) rows.push({ label: "EAN", value: row.ean });

  return rows;
}

interface ProductSpecListProps {
  row: ProductPriceSummaryRow;
  definition: CategoryDefinition;
}

export function ProductSpecList({ row, definition }: ProductSpecListProps) {
  const rows = buildSpecRows(row, definition.capacityLabel);

  return (
    <dl className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
      {rows.map((spec) => (
        <div
          key={spec.label}
          className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0"
        >
          <dt className="text-xs text-muted-foreground">{spec.label}</dt>
          <dd className="text-right text-sm font-medium">{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}
