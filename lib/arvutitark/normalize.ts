import { isRecord, toFiniteNumber, toIntegerOrNull } from "@/lib/utils";
import { ARVUTITARK_ATTRIBUTE_IDS, ARVUTITARK_PRODUCT_BASE_URL } from "./config";
import type {
  ArvutitarkProduct,
  AttributeEntry,
  NormalizedProduct,
  RamSpecs,
  SnapshotRow,
} from "./types";

/* ==========================================================================
 * Text helpers
 * ========================================================================== */

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeOptionalText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = normalizeWhitespace(value);
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Best single string from a value that may be a string, number, array or locale map. */
export function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string") return normalizeOptionalText(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = textFromUnknown(item);
      if (text) return text;
    }
    return null;
  }
  if (isRecord(value)) {
    for (const locale of ["en", "et", "ru"]) {
      const text = textFromUnknown(value[locale]);
      if (text) return text;
    }
    for (const item of Object.values(value)) {
      const text = textFromUnknown(item);
      if (text) return text;
    }
  }
  return null;
}

function localizedTextExact(value: unknown, locale: string): string | null {
  if (typeof value === "string") return normalizeOptionalText(value);
  if (isRecord(value)) return textFromUnknown(value[locale]);
  return null;
}

/** Resolve the display name plus the English name, without aliasing one to the other. */
export function resolveProductName(raw: unknown): { name: string | null; nameEn: string | null } {
  if (typeof raw === "string") {
    return { name: normalizeOptionalText(raw), nameEn: null };
  }
  const nameEt = localizedTextExact(raw, "et");
  const nameEn = localizedTextExact(raw, "en");
  return { name: nameEt ?? nameEn ?? textFromUnknown(raw), nameEn };
}

export function localizedName(value: unknown, locale: string): string | null {
  const exact = localizedTextExact(value, locale);
  if (exact) return exact;
  return textFromUnknown(value);
}

/* ==========================================================================
 * Attribute extraction
 * ========================================================================== */

function firstNumeric(record: Record<string, unknown>): number | null {
  for (const key of ["id", "attribute_id", "attributeId", "attr_id"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  }
  return null;
}

/**
 * Keys that hold the attribute's VALUE.
 *
 * `values` is the live Arvutitark shape (`{ en: ["5600 MHz"] }`). `name` is
 * deliberately NOT in this list: it is the human-readable label ("Speed") and
 * returning it as the value is what silently produced wrong specs.
 */
const VALUE_KEYS = ["display_value", "value", "values"] as const;

/** Legacy shapes where the value sits under a differently named key. */
const LEGACY_VALUE_KEYS = ["label", "text", "title"] as const;

/** Keys we recurse into to find nested attribute records. */
const STRUCTURAL_KEYS = [
  "options",
  "children",
  "items",
  "attributes",
  "main_attributes",
  "technical_details",
] as const;

/** Extract the attribute's value, preferring `values` over the display name. */
function valueText(record: Record<string, unknown>): string | null {
  for (const key of VALUE_KEYS) {
    if (key in record) {
      const text = textFromUnknown(record[key]);
      if (text) return text;
    }
  }
  for (const key of LEGACY_VALUE_KEYS) {
    const text = textFromUnknown(record[key]);
    if (text) return text;
  }
  return null;
}

function walkAttributes(
  source: unknown,
  out: AttributeEntry[],
  depth: number,
  inheritedId: number | null,
): void {
  if (depth > 6 || source === null || source === undefined) return;

  if (Array.isArray(source)) {
    for (const item of source) walkAttributes(item, out, depth + 1, inheritedId);
    return;
  }

  // Shape: { "27": "32 GB" } — a scalar value belonging to the keyed attribute id.
  if (typeof source === "string" || typeof source === "number") {
    const scalar = normalizeOptionalText(source);
    if (scalar) out.push({ id: inheritedId, text: scalar });
    return;
  }

  if (!isRecord(source)) return;

  // Shape: { "27": "32 GB" } / { "27": { values: { en: ["32 GB"] } } }
  const keyedEntries = Object.entries(source).filter(([key]) => /^\d+$/.test(key));
  const looksKeyed =
    keyedEntries.length > 0 &&
    !("value" in source) &&
    !("values" in source) &&
    !("id" in source) &&
    !("attribute_id" in source);
  if (looksKeyed) {
    for (const [key, value] of keyedEntries) {
      walkAttributes(value, out, depth + 1, Number(key));
    }
    return;
  }

  const ownId = firstNumeric(source) ?? inheritedId;
  const text = valueText(source);
  if (text) out.push({ id: ownId, text });

  for (const key of STRUCTURAL_KEYS) {
    const child = source[key];
    if (isRecord(child) || Array.isArray(child)) {
      walkAttributes(child, out, depth + 1, ownId);
    }
  }

  // Only descend into value containers when they yielded no usable text, so the
  // same value is not recorded twice for the same attribute id.
  if (!text) {
    for (const key of VALUE_KEYS) {
      const child = source[key];
      if (isRecord(child) || Array.isArray(child)) {
        walkAttributes(child, out, depth + 1, ownId);
      }
    }
  }
}

/** Flatten `main_attributes` / `technical_details` into `{ id, text }` pairs. */
export function extractAttributeEntries(product: ArvutitarkProduct): AttributeEntry[] {
  const out: AttributeEntry[] = [];
  walkAttributes(product.main_attributes, out, 0, null);
  walkAttributes(product.technical_details, out, 0, null);
  walkAttributes(product.attributes, out, 0, null);

  const seen = new Set<string>();
  return out.filter((entry) => {
    const signature = `${entry.id ?? "null"}:${entry.text}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function getAttributeText(entries: AttributeEntry[], id: number): string | null {
  const texts = entries.filter((entry) => entry.id === id).map((entry) => entry.text);
  return texts.length > 0 ? normalizeWhitespace(texts.join(" ")) : null;
}

/* ==========================================================================
 * RAM specification parsing
 * ========================================================================== */

function withinRange(value: number, min: number, max: number): number | null {
  if (!Number.isFinite(value)) return null;
  return value >= min && value <= max ? value : null;
}

/** Accepts a bare numeric attribute value, e.g. `"6000"` or `"1.35"`. */
function parseBareNumber(text: string | null, min: number, max: number): number | null {
  if (!text) return null;
  const match = text.trim().match(/^(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  return withinRange(Number(match[1].replace(",", ".")), min, max);
}

function parseBareInteger(text: string | null, min: number, max: number): number | null {
  const value = parseBareNumber(text, min, max);
  return value === null ? null : Math.trunc(value);
}

/** `"DDR5"`, `"DDR4"`. */
export function parseMemoryType(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\bDDR\s?([2-6])\b/i);
  return match ? `DDR${match[1]}` : null;
}

/** `"6000 MHz"`, `"5200 MHz (PC5-41600)"`, `"DDR5-5600"` → megahertz. */
export function parseSpeedMhz(text: string | null | undefined): number | null {
  if (!text) return null;

  // The floor of 2000 MHz deliberately rejects DDR3-era values so an old
  // module name is never mistaken for a tracked DDR4/DDR5 speed.
  const mhz = text.match(/(\d{3,5})\s*(?:MHz|Mhz|mhz|МГц)/i);
  if (mhz) {
    const value = withinRange(Number(mhz[1]), 2000, 12000);
    if (value !== null) return value;
  }

  const ddr = text.match(/\bDDR[2-6]\s?-\s?(\d{4,5})\b/i);
  if (ddr) {
    const value = withinRange(Number(ddr[1]), 2000, 12000);
    if (value !== null) return value;
  }

  // PC5-41600 means 41600 MT/s ÷ 8 = 5200 MHz.
  const pc = text.match(/\bPC[2-6]-(\d{4,6})\b/i);
  if (pc) {
    const value = withinRange(Math.round(Number(pc[1]) / 8), 2000, 12000);
    if (value !== null) return value;
  }

  return null;
}

/** `"CL30"`, `"CL46 (46-45-45)"` → 30 / 46. */
export function parseCasLatency(text: string | null | undefined): number | null {
  if (!text) return null;

  const cl = text.match(/\bCL\s*[-:]?\s*(\d{1,2})\b/i);
  if (cl) {
    const value = withinRange(Number(cl[1]), 3, 99);
    if (value !== null) return Math.trunc(value);
  }

  // Timings written as "46-45-45" where the first number is the CAS latency.
  const timings = text.match(/\b(\d{1,2})\s*-\s*\d{1,2}\s*-\s*\d{1,2}\b/);
  if (timings) {
    const value = withinRange(Number(timings[1]), 3, 99);
    if (value !== null) return Math.trunc(value);
  }

  return null;
}

/** `"2 x 16 GB"`, `"2x16GB"` → `{ moduleCount: 2, capacityPerModuleGb: 16 }`. */
export function parseModuleLayout(
  text: string | null | undefined,
): { moduleCount: number; capacityPerModuleGb: number } | null {
  if (!text) return null;
  const match = text.match(/(\d{1,2})\s*[x×*]\s*(\d{1,3})\s*GB/i);
  if (!match) return null;

  const moduleCount = Number(match[1]);
  const capacityPerModuleGb = Number(match[2]);
  if (!(moduleCount >= 1 && moduleCount <= 16)) return null;
  if (!(capacityPerModuleGb >= 1 && capacityPerModuleGb <= 256)) return null;

  return { moduleCount, capacityPerModuleGb };
}

/** Total kit capacity in GB. Understands `"2 x 16 GB"` and `"32GB"`. */
export function parseCapacityGb(text: string | null | undefined): number | null {
  if (!text) return null;

  const layout = parseModuleLayout(text);
  if (layout) return layout.moduleCount * layout.capacityPerModuleGb;

  const gb = text.match(/(\d{1,4})\s*GB\b/i);
  if (gb) return withinRange(Number(gb[1]), 1, 4096);

  const tb = text.match(/(\d{1,2})\s*TB\b/i);
  if (tb) return withinRange(Number(tb[1]) * 1024, 1, 4096);

  return null;
}

/** `"UDIMM"`, `"SODIMM"`, `"RDIMM"`, `"DIMM"`. */
export function parseFormFactor(text: string | null | undefined): string | null {
  if (!text) return null;
  const upper = text.toUpperCase();
  for (const factor of ["SODIMM", "UDIMM", "RDIMM", "LRDIMM"]) {
    if (upper.includes(factor)) return factor;
  }
  if (/\bDIMM\b/.test(upper)) return "DIMM";
  return null;
}

/** `"1.35 V"`, `"1,35"` → 1.35. */
export function parseVoltage(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*V\b/i);
  if (!match) return null;
  return withinRange(Number(match[1].replace(",", ".")), 0.5, 3);
}

/* ==========================================================================
 * Spec assembly
 * ========================================================================== */

export function extractRamSpecs(product: ArvutitarkProduct): RamSpecs {
  const entries = extractAttributeEntries(product);
  const attribute = (id: number) => getAttributeText(entries, id);

  const { name, nameEn } = resolveProductName(product.name);
  const nameText = [nameEn, name].filter((value): value is string => Boolean(value)).join(" ");
  const combined = `${nameText} ${entries.map((entry) => entry.text).join(" ")}`.trim();

  const capacityRaw = attribute(ARVUTITARK_ATTRIBUTE_IDS.capacity);
  const speedRaw = attribute(ARVUTITARK_ATTRIBUTE_IDS.speed);
  const memoryTypeRaw = attribute(ARVUTITARK_ATTRIBUTE_IDS.memoryType);
  const casRaw = attribute(ARVUTITARK_ATTRIBUTE_IDS.casLatency);
  const moduleRaw = attribute(ARVUTITARK_ATTRIBUTE_IDS.moduleCount);
  const formFactorRaw = attribute(ARVUTITARK_ATTRIBUTE_IDS.formFactor);
  const voltageRaw = attribute(ARVUTITARK_ATTRIBUTE_IDS.voltage);

  const layout =
    parseModuleLayout(moduleRaw) ?? parseModuleLayout(nameText) ?? parseModuleLayout(combined);

  const capacityGb =
    parseCapacityGb(capacityRaw) ??
    parseBareNumber(capacityRaw, 1, 4096) ??
    (layout ? layout.moduleCount * layout.capacityPerModuleGb : null) ??
    parseCapacityGb(nameText);

  const moduleCount = layout?.moduleCount ?? parseBareInteger(moduleRaw, 1, 16);

  const capacityPerModuleGb =
    layout?.capacityPerModuleGb ??
    (capacityGb !== null && moduleCount !== null && moduleCount > 1 && capacityGb % moduleCount === 0
      ? capacityGb / moduleCount
      : null);

  const speedMhz =
    parseSpeedMhz(speedRaw) ?? parseBareNumber(speedRaw, 2000, 12000) ?? parseSpeedMhz(nameText);

  const casLatency =
    parseCasLatency(casRaw) ?? parseBareInteger(casRaw, 3, 99) ?? parseCasLatency(nameText);

  const memoryType = parseMemoryType(memoryTypeRaw) ?? parseMemoryType(combined);

  const formFactor = parseFormFactor(formFactorRaw) ?? parseFormFactor(combined);

  const voltage = parseVoltage(voltageRaw) ?? parseBareNumber(voltageRaw, 0.5, 3);

  return {
    memoryType,
    capacityGb,
    speedMhz,
    casLatency,
    moduleCount,
    capacityPerModuleGb,
    formFactor,
    voltage,
  };
}

/* ==========================================================================
 * Product normalization
 * ========================================================================== */

export function coerceProductId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * Resolve `path` to a single relative path string.
 *
 * The live API returns a localized object (`{ et, en, ru }`), but a plain
 * string has also been seen, so both are accepted. Preference is
 * et -> en -> ru -> first usable value.
 */
export function selectLocalizedPath(path: unknown): string | null {
  if (typeof path === "string") return normalizeOptionalText(path);

  if (isRecord(path)) {
    for (const locale of ["et", "en", "ru"]) {
      const value = normalizeOptionalText(path[locale]);
      if (value) return value;
    }
    for (const candidate of Object.values(path)) {
      const value = normalizeOptionalText(candidate);
      if (value) return value;
    }
  }

  return null;
}

export function buildProductUrl(path: unknown): string | null {
  const value = selectLocalizedPath(path);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${ARVUTITARK_PRODUCT_BASE_URL}/${value.replace(/^\/+/, "")}`;
}

export function normalizeShopStock(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, shopValue] of Object.entries(value)) {
    const parsed = toIntegerOrNull(shopValue);
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}

export function normalizeIsoTimestamp(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** Convert a raw API product into a validated, typed product. Returns null when unusable. */
export function normalizeProduct(raw: ArvutitarkProduct): NormalizedProduct | null {
  const id = coerceProductId(raw.id);
  if (id === null) return null;

  const { name, nameEn } = resolveProductName(raw.name);
  if (!name) return null;

  const price = toFiniteNumber(raw.price);
  if (price === null || price <= 0) return null;

  const stock = isRecord(raw.stock) ? raw.stock : {};

  return {
    id,
    retailer: "arvutitark",
    category: "ram",
    sku: normalizeOptionalText(raw.sku),
    ean: normalizeOptionalText(raw.ean),
    name,
    nameEn,
    brand:
      normalizeOptionalText(raw.brand_name) ??
      localizedName(raw.brand, "en") ??
      localizedName(raw.brand, "et"),
    url: buildProductUrl(raw.path),
    specs: extractRamSpecs(raw),
    price,
    originalPrice: toFiniteNumber(raw.original_price),
    sourcePriceUpdatedAt: normalizeIsoTimestamp(raw.price_updated_at),
    warehouseStock: toIntegerOrNull(stock.warehouse),
    localStock: toIntegerOrNull(stock.in_stock),
    shopStock: normalizeShopStock(stock.shops),
    raw,
  };
}

/**
 * Softly enforce the collection criteria. Only rejects a product when we are
 * confident it does not match, so unparseable specs are kept rather than lost.
 */
export function matchesRamCriteria(product: NormalizedProduct): boolean {
  const { memoryType, speedMhz, formFactor } = product.specs;
  if (memoryType !== null && memoryType !== "DDR5") return false;
  if (speedMhz !== null && speedMhz !== 5600 && speedMhz !== 6000) return false;
  if (formFactor !== null && formFactor !== "UDIMM") return false;
  return true;
}

/** Deduplicate raw products by Arvutitark product id, keeping the first seen. */
export function dedupeById<T extends { id: ArvutitarkProduct["id"] }>(items: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const item of items) {
    const id = coerceProductId(item.id);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export function toSnapshotRow(product: NormalizedProduct): SnapshotRow {
  return {
    id: product.id,
    sku: product.sku,
    ean: product.ean,
    name: product.name,
    name_en: product.nameEn,
    brand: product.brand,
    url: product.url,
    category: product.category,
    memory_type: product.specs.memoryType,
    capacity_gb: product.specs.capacityGb,
    speed_mhz: product.specs.speedMhz,
    cas_latency: product.specs.casLatency,
    module_count: product.specs.moduleCount,
    capacity_per_module_gb: product.specs.capacityPerModuleGb,
    form_factor: product.specs.formFactor,
    voltage: product.specs.voltage,
    price: product.price,
    original_price: product.originalPrice,
    source_price_updated_at: product.sourcePriceUpdatedAt,
    warehouse_stock: product.warehouseStock,
    local_stock: product.localStock,
    shop_stock: product.shopStock,
  };
}

/** Human-readable one-line spec summary, e.g. `32GB · 2×16GB · DDR5-6000 · CL30`. */
export function formatSpecSummary(specs: RamSpecs): string {
  const parts: string[] = [];
  if (specs.capacityGb !== null) parts.push(`${specs.capacityGb}GB`);
  if (specs.moduleCount !== null && specs.capacityPerModuleGb !== null) {
    parts.push(`${specs.moduleCount}×${specs.capacityPerModuleGb}GB`);
  }
  if (specs.memoryType !== null && specs.speedMhz !== null) {
    parts.push(`${specs.memoryType}-${specs.speedMhz}`);
  } else if (specs.memoryType !== null) {
    parts.push(specs.memoryType);
  } else if (specs.speedMhz !== null) {
    parts.push(`${specs.speedMhz} MHz`);
  }
  if (specs.casLatency !== null) parts.push(`CL${specs.casLatency}`);
  if (specs.formFactor !== null) parts.push(specs.formFactor);
  return parts.join(" · ");
}
