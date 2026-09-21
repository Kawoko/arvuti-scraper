import { z } from "zod";

/**
 * Runtime validation for the snapshot we hand to the `ingest_snapshot` RPC.
 *
 * The scraper normalizes defensively, but this is the last line of defence
 * before data enters the database, so it is validated explicitly rather than
 * trusted.
 */
export const snapshotRowSchema = z.object({
  id: z.number().int().positive(),
  sku: z.string().nullable(),
  ean: z.string().nullable(),
  name: z.string().min(1),
  name_en: z.string().nullable(),
  brand: z.string().nullable(),
  url: z.string().nullable(),
  category: z.enum(["ram", "gpu"]),
  chipset: z.string().nullable(),
  memory_type: z.string().nullable(),
  capacity_gb: z.number().int().positive().nullable(),
  speed_mhz: z.number().int().positive().nullable(),
  cas_latency: z.number().int().positive().nullable(),
  module_count: z.number().int().positive().nullable(),
  capacity_per_module_gb: z.number().int().positive().nullable(),
  form_factor: z.string().nullable(),
  voltage: z.number().positive().nullable(),
  price: z.number().positive(),
  original_price: z.number().positive().nullable(),
  source_price_updated_at: z.string().nullable(),
  warehouse_stock: z.number().int().nullable(),
  local_stock: z.number().int().nullable(),
  shop_stock: z.record(z.string(), z.number().int()),
});

export const snapshotRowsSchema = z.array(snapshotRowSchema);

export type ValidatedSnapshotRow = z.infer<typeof snapshotRowSchema>;
