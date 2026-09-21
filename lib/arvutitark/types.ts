/**
 * Types describing the Arvutitark JSON products API.
 *
 * The retailer's payload is only partially documented, so the "raw" types are
 * intentionally loose (`unknown` for nested structures). Strict, trustworthy
 * shapes are produced by `normalize.ts`, never assumed here.
 */

export type ArvutitarkId = number | string;

export interface ArvutitarkLocalizedText {
  [locale: string]: string | undefined;
  et?: string;
  en?: string;
  ru?: string;
}

export type ArvutitarkLocalized = string | ArvutitarkLocalizedText;

export interface ArvutitarkStock {
  warehouse?: number | string | null;
  in_stock?: number | string | null;
  shops?: Record<string, number | string> | null;
}

/** `{ en: ["5600 MHz"], et: ["5600 MHz"] }` */
export type ArvutitarkLocalizedValues = Record<
  string,
  ReadonlyArray<string> | string | undefined
>;

/**
 * The real Arvutitark attribute shape, used by `main_attributes` and by the
 * entries inside `technical_details[].attributes`.
 *
 * The value lives under `values`, NOT under `name`. `name` is the human-readable
 * label ("Speed") and must never be treated as the value.
 */
export interface ArvutitarkAttribute {
  id?: ArvutitarkId;
  name?: ArvutitarkLocalized | null;
  values?: ArvutitarkLocalizedValues | null;
  value?: unknown;
}

/** `technical_details` is an array of groups, each containing an `attributes` array. */
export interface ArvutitarkAttributeGroup {
  name?: ArvutitarkLocalized | null;
  attributes?: ArvutitarkAttribute[] | null;
}

export interface ArvutitarkProduct {
  id: ArvutitarkId;
  name?: ArvutitarkLocalized | null;
  price?: number | string | null;
  original_price?: number | string | null;
  price_updated_at?: string | null;
  brand_name?: string | null;
  brand?: ArvutitarkLocalized | null;
  /**
   * Returns a localized object (`{ et, en, ru }`) in the live API, but has been
   * seen as a plain string, so both are accepted.
   */
  path?: string | ArvutitarkLocalizedText | null;
  sku?: string | null;
  ean?: string | null;
  stock?: ArvutitarkStock | null;
  technical_details?: unknown;
  main_attributes?: unknown;
  attributes?: unknown;
  [key: string]: unknown;
}

export interface ArvutitarkPageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number | null;
  total: number | null;
}

export interface ArvutitarkPage {
  products: ArvutitarkProduct[];
  meta: ArvutitarkPageMeta;
}

/** A single attribute pair recovered from `main_attributes` / `technical_details`. */
export interface AttributeEntry {
  id: number | null;
  text: string;
}

/** Normalized RAM specification values. `null` means "could not be determined". */
export interface RamSpecs {
  memoryType: string | null;
  capacityGb: number | null;
  speedMhz: number | null;
  casLatency: number | null;
  moduleCount: number | null;
  capacityPerModuleGb: number | null;
  formFactor: string | null;
  voltage: number | null;
}

export const EMPTY_RAM_SPECS: RamSpecs = {
  memoryType: null,
  capacityGb: null,
  speedMhz: null,
  casLatency: null,
  moduleCount: null,
  capacityPerModuleGb: null,
  formFactor: null,
  voltage: null,
};

export type ComponentCategory = "ram";
export type Retailer = "arvutitark";

export interface NormalizedProduct {
  id: number;
  retailer: Retailer;
  category: ComponentCategory;
  sku: string | null;
  ean: string | null;
  name: string;
  nameEn: string | null;
  brand: string | null;
  url: string | null;
  specs: RamSpecs;
  price: number;
  originalPrice: number | null;
  sourcePriceUpdatedAt: string | null;
  warehouseStock: number | null;
  localStock: number | null;
  shopStock: Record<string, number>;
  /** Original retailer payload, kept for debugging and future re-parsing. */
  raw: ArvutitarkProduct;
}

/** snake_case row matching `public.ingest_snapshot`'s jsonb_to_recordset. */
export interface SnapshotRow {
  id: number;
  sku: string | null;
  ean: string | null;
  name: string;
  name_en: string | null;
  brand: string | null;
  url: string | null;
  category: ComponentCategory;
  memory_type: string | null;
  capacity_gb: number | null;
  speed_mhz: number | null;
  cas_latency: number | null;
  module_count: number | null;
  capacity_per_module_gb: number | null;
  form_factor: string | null;
  voltage: number | null;
  price: number;
  original_price: number | null;
  source_price_updated_at: string | null;
  warehouse_stock: number | null;
  local_stock: number | null;
  shop_stock: Record<string, number>;
}
