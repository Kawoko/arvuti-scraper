import { formatInteger } from "@/lib/format";
import type { ProductPriceSummaryRow } from "@/types/database";

interface SpecRow {
  label: string;
  value: string;
}

function buildSpecRows(row: ProductPriceSummaryRow): SpecRow[] {
  const rows: SpecRow[] = [];

  if (row.memory_type) rows.push({ label: "Memory type", value: row.memory_type });
  if (row.capacity_gb !== null) rows.push({ label: "Total capacity", value: `${formatInteger(row.capacity_gb)} GB` });
  if (row.module_count !== null) rows.push({ label: "Modules", value: `${row.module_count}` });
  if (row.capacity_per_module_gb !== null) {
    rows.push({ label: "Capacity per module", value: `${formatInteger(row.capacity_per_module_gb)} GB` });
  }
  if (row.speed_mhz !== null) rows.push({ label: "Speed", value: `${formatInteger(row.speed_mhz)} MHz` });
  if (row.cas_latency !== null) rows.push({ label: "CAS latency", value: `CL${row.cas_latency}` });
  if (row.form_factor) rows.push({ label: "Form factor", value: row.form_factor });
  if (row.voltage !== null) rows.push({ label: "Voltage", value: `${Number(row.voltage).toFixed(2)} V` });
  if (row.sku) rows.push({ label: "SKU", value: row.sku });
  if (row.ean) rows.push({ label: "EAN", value: row.ean });

  return rows;
}

export function ProductSpecList({ row }: { row: ProductPriceSummaryRow }) {
  const rows = buildSpecRows(row);

  return (
    <dl className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
      {rows.map((spec) => (
        <div
          key={spec.label}
          className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0 sm:[&:nth-last-child(-n+1)]:border-b"
        >
          <dt className="text-xs text-muted-foreground">{spec.label}</dt>
          <dd className="text-right text-sm font-medium">{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}
