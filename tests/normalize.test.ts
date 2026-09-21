import { describe, expect, it } from "vitest";

import {
  buildProductUrl,
  coerceProductId,
  dedupeById,
  extractAttributeEntries,
  extractRamSpecs,
  formatSpecSummary,
  getAttributeText,
  matchesRamCriteria,
  normalizeProduct,
  normalizeShopStock,
  parseCapacityGb,
  parseCasLatency,
  parseFormFactor,
  parseMemoryType,
  parseModuleLayout,
  parseSpeedMhz,
  parseVoltage,
  selectLocalizedPath,
  toSnapshotRow,
} from "@/lib/arvutitark/normalize";
import type { ArvutitarkProduct } from "@/lib/arvutitark/types";

import ramPageFixture from "./fixtures/arvutitark-ram-page.json";
import realPageFixture from "./fixtures/arvutitark-real-page.json";

const products = ramPageFixture.data as unknown as ArvutitarkProduct[];
const gskill = products[0] as ArvutitarkProduct;
const kingston = products[1] as ArvutitarkProduct;
const crucial = products[2] as ArvutitarkProduct;

// Copied from the live API response shape.
const realProducts = realPageFixture.data as unknown as ArvutitarkProduct[];
const pny = realProducts[0] as ArvutitarkProduct;
const realCrucial = realProducts[1] as ArvutitarkProduct;

describe("ram attribute parsing", () => {
  it("parses memory type", () => {
    expect(parseMemoryType("DDR5")).toBe("DDR5");
    expect(parseMemoryType("ddr5 udimm")).toBe("DDR5");
    expect(parseMemoryType("DDR4 SODIMM")).toBe("DDR4");
    expect(parseMemoryType("ECC registered memory")).toBeNull();
    expect(parseMemoryType(null)).toBeNull();
  });

  it("parses speeds from the formats Arvutitark uses", () => {
    expect(parseSpeedMhz("6000 MHz")).toBe(6000);
    expect(parseSpeedMhz("6000MHz")).toBe(6000);
    expect(parseSpeedMhz("5200 MHz (PC5-41600)")).toBe(5200);
    expect(parseSpeedMhz("DDR5-5600")).toBe(5600);
    // PC5-44800 is 44800 MT/s ÷ 8 = 5600 MHz.
    expect(parseSpeedMhz("PC5-44800")).toBe(5600);
    expect(parseSpeedMhz("1600 MHz")).toBeNull();
    expect(parseSpeedMhz("DDR5 memory")).toBeNull();
  });

  it("parses CAS latency", () => {
    expect(parseCasLatency("CL30")).toBe(30);
    expect(parseCasLatency("CL46 (46-45-45)")).toBe(46);
    expect(parseCasLatency("cl36")).toBe(36);
    expect(parseCasLatency("30-38-38-96")).toBe(30);
    expect(parseCasLatency("UDIMM")).toBeNull();
  });

  it("parses module layout", () => {
    expect(parseModuleLayout("2 x 16 GB")).toEqual({ moduleCount: 2, capacityPerModuleGb: 16 });
    expect(parseModuleLayout("2x16GB")).toEqual({ moduleCount: 2, capacityPerModuleGb: 16 });
    expect(parseModuleLayout("1 × 8 GB")).toEqual({ moduleCount: 1, capacityPerModuleGb: 8 });
    expect(parseModuleLayout("16 GB")).toBeNull();
    expect(parseModuleLayout(null)).toBeNull();
  });

  it("parses total capacity, preferring the module layout", () => {
    expect(parseCapacityGb("2 x 16 GB")).toBe(32);
    expect(parseCapacityGb("32GB")).toBe(32);
    expect(parseCapacityGb("1 TB")).toBe(1024);
    expect(parseCapacityGb("memory")).toBeNull();
  });

  it("parses form factor without confusing SODIMM with DIMM", () => {
    expect(parseFormFactor("UDIMM")).toBe("UDIMM");
    expect(parseFormFactor("SODIMM")).toBe("SODIMM");
    expect(parseFormFactor("RDIMM")).toBe("RDIMM");
    expect(parseFormFactor("DIMM")).toBe("DIMM");
    expect(parseFormFactor("memory kit")).toBeNull();
  });

  it("parses voltage", () => {
    expect(parseVoltage("1.35 V")).toBe(1.35);
    expect(parseVoltage("1,35V")).toBe(1.35);
    expect(parseVoltage("CL30")).toBeNull();
  });
});

describe("attribute extraction", () => {
  it("reads an array of { id, value } objects", () => {
    const entries = extractAttributeEntries(gskill);
    expect(getAttributeText(entries, 27)).toBe("32 GB");
    expect(getAttributeText(entries, 181)).toBe("UDIMM");
  });

  it("reads an object keyed by attribute id", () => {
    const entries = extractAttributeEntries(kingston);
    expect(getAttributeText(entries, 27)).toBe("8");
    expect(getAttributeText(entries, 28)).toBe("5600");
    expect(getAttributeText(entries, 179)).toBe("36");
  });

  it("returns null for attributes that are not present", () => {
    const entries = extractAttributeEntries(kingston);
    expect(getAttributeText(entries, 182)).toBeNull();
  });
});

describe("attribute extraction (live API shape)", () => {
  it("uses values.en arrays as the value, not the attribute's display name", () => {
    const entries = extractAttributeEntries(pny);

    expect(getAttributeText(entries, 27)).toBe("8 GB");
    expect(getAttributeText(entries, 28)).toBe("5600 MHz");
    expect(getAttributeText(entries, 178)).toBe("DDR5");
    expect(getAttributeText(entries, 179)).toBe("40");
  });

  it("traverses technical_details groups into their attributes array", () => {
    const entries = extractAttributeEntries(pny);

    expect(getAttributeText(entries, 181)).toBe("UDIMM");
    expect(getAttributeText(entries, 182)).toBe("1.2 V");
    expect(getAttributeText(entries, 180)).toBe("1");
  });

  it("never records a human-readable attribute name as a value", () => {
    const texts = extractAttributeEntries(pny).map((entry) => entry.text);

    for (const label of [
      "Speed",
      "Capacity",
      "Type",
      "CL",
      "Form Factor",
      "Voltage",
      "Layout",
      "Technical Details",
    ]) {
      expect(texts).not.toContain(label);
    }
  });

  it("deduplicates an attribute present in both main_attributes and technical_details", () => {
    const entries = extractAttributeEntries(pny);
    expect(entries.filter((entry) => entry.id === 28)).toHaveLength(1);
  });

  it("works for a product that only carries main_attributes", () => {
    const entries = extractAttributeEntries(realCrucial);

    expect(getAttributeText(entries, 27)).toBe("16 GB");
    expect(getAttributeText(entries, 180)).toBe("1 x 16 GB");
    expect(getAttributeText(entries, 181)).toBe("UDIMM");
  });
});

describe("extractRamSpecs (live API shape)", () => {
  it("produces the expected specification set", () => {
    const specs = extractRamSpecs(pny);

    expect(specs.memoryType).toBe("DDR5");
    expect(specs.capacityGb).toBe(8);
    expect(specs.speedMhz).toBe(5600);
    expect(specs.casLatency).toBe(40);
    expect(specs.formFactor).toBe("UDIMM");
    expect(specs.voltage).toBe(1.2);
  });

  it("reads the module layout from the live Layout attribute", () => {
    const specs = extractRamSpecs(realCrucial);

    expect(specs.capacityGb).toBe(16);
    expect(specs.moduleCount).toBe(1);
    expect(specs.capacityPerModuleGb).toBe(16);
    expect(specs.casLatency).toBe(46);
  });

  it("normalizes a complete product from the live payload", () => {
    const product = normalizeProduct(pny);

    expect(product).not.toBeNull();
    expect(product?.id).toBe(1526679);
    expect(product?.brand).toBe("PNY");
    expect(product?.price).toBe(131.8);
    expect(product?.warehouseStock).toBe(30);
    expect(product?.localStock).toBe(0);
    expect(product?.shopStock).toEqual({ "8": 0 });
    expect(product?.sourcePriceUpdatedAt).toBe("2026-09-21T08:02:28.000Z");
  });

  it("keeps live products inside the tracked criteria", () => {
    expect(matchesRamCriteria(normalizeProduct(pny)!)).toBe(true);
    expect(matchesRamCriteria(normalizeProduct(realCrucial)!)).toBe(true);
  });
});

describe("buildProductUrl localized path", () => {
  it("prefers the Estonian path", () => {
    expect(
      buildProductUrl({
        et: "/arvutikomponendid/foo",
        en: "/en/pc-components/foo",
        ru: "/ru/pc-components/foo",
      }),
    ).toBe("https://arvutitark.ee/arvutikomponendid/foo");
  });

  it("falls back through en, then ru, then any usable locale", () => {
    expect(buildProductUrl({ en: "/en/pc-components/foo" })).toBe(
      "https://arvutitark.ee/en/pc-components/foo",
    );
    expect(buildProductUrl({ ru: "/ru/x" })).toBe("https://arvutitark.ee/ru/x");
    expect(buildProductUrl({ de: "/de/x" })).toBe("https://arvutitark.ee/de/x");
  });

  it("still supports a plain string path", () => {
    expect(buildProductUrl("/arvutikomponendid/foo")).toBe(
      "https://arvutitark.ee/arvutikomponendid/foo",
    );
    expect(buildProductUrl("arvutikomponendid/foo")).toBe(
      "https://arvutitark.ee/arvutikomponendid/foo",
    );
  });

  it("preserves absolute URLs and rejects unusable input", () => {
    expect(buildProductUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(buildProductUrl(null)).toBeNull();
    expect(buildProductUrl({})).toBeNull();
    expect(buildProductUrl(42)).toBeNull();
  });

  it("resolves the live localized path for a real product", () => {
    expect(normalizeProduct(pny)?.url).toBe(
      "https://arvutitark.ee/arvutikomponendid/malud-ram/pny-performance-ddr5-8gb-5600mhz",
    );
  });

  it("selectLocalizedPath returns a single path string", () => {
    expect(selectLocalizedPath({ et: "/a", en: "/b" })).toBe("/a");
    expect(selectLocalizedPath("/c")).toBe("/c");
    expect(selectLocalizedPath({})).toBeNull();
  });
});

describe("extractRamSpecs", () => {
  it("extracts a fully structured product", () => {
    expect(extractRamSpecs(gskill)).toEqual({
      memoryType: "DDR5",
      capacityGb: 32,
      speedMhz: 6000,
      casLatency: 30,
      moduleCount: 2,
      capacityPerModuleGb: 16,
      formFactor: "UDIMM",
      voltage: 1.35,
    });
  });

  it("extracts a product whose attributes are bare numbers", () => {
    expect(extractRamSpecs(kingston)).toEqual({
      memoryType: "DDR5",
      capacityGb: 8,
      speedMhz: 5600,
      casLatency: 36,
      moduleCount: 1,
      capacityPerModuleGb: null,
      formFactor: "UDIMM",
      voltage: null,
    });
  });

  it("never invents values it cannot determine", () => {
    const specs = extractRamSpecs({ id: 1, name: { en: "Mystery memory module" } });
    expect(specs).toEqual({
      memoryType: null,
      capacityGb: null,
      speedMhz: null,
      casLatency: null,
      moduleCount: null,
      capacityPerModuleGb: null,
      formFactor: null,
      voltage: null,
    });
  });

  it("falls back to parsing the product name", () => {
    const specs = extractRamSpecs({
      id: 2,
      name: { en: "Corsair Vengeance DDR5 64GB (2x32GB) 6000MHz CL30 UDIMM" },
    });
    expect(specs.capacityGb).toBe(64);
    expect(specs.moduleCount).toBe(2);
    expect(specs.capacityPerModuleGb).toBe(32);
    expect(specs.speedMhz).toBe(6000);
    expect(specs.casLatency).toBe(30);
    expect(specs.formFactor).toBe("UDIMM");
  });
});

describe("normalizeProduct", () => {
  it("normalizes a well-formed product", () => {
    const product = normalizeProduct(gskill);
    expect(product).not.toBeNull();
    expect(product?.id).toBe(1528502);
    expect(product?.brand).toBe("G.Skill");
    expect(product?.sku).toBe("F5-6000J3038F16GX2-FX5");
    expect(product?.ean).toBe("4711549511204");
    expect(product?.price).toBe(159.9);
    expect(product?.originalPrice).toBe(189.9);
    expect(product?.url).toBe(
      "https://arvutitark.ee/arvutikomponendid/malud-ram/gskill-flare-x5-32gb",
    );
    expect(product?.warehouseStock).toBe(50);
    expect(product?.localStock).toBe(0);
    expect(product?.shopStock).toEqual({ "4": 0, "7": 2, "10": 0 });
    expect(product?.sourcePriceUpdatedAt).toBe("2026-09-21T06:34:53.000Z");
  });

  it("rejects products without an id, name or price", () => {
    expect(normalizeProduct({ id: 0, name: "x", price: 10 })).toBeNull();
    expect(normalizeProduct({ id: 1, name: "", price: 10 })).toBeNull();
    expect(normalizeProduct({ id: 1, name: "x", price: null })).toBeNull();
    expect(normalizeProduct({ id: 1, name: "x", price: 0 })).toBeNull();
  });

  it("preserves the original payload for debugging", () => {
    const product = normalizeProduct(kingston);
    expect(product?.raw.id).toBe(1528503);
  });

  it("produces an ingest row with snake_case keys", () => {
    const product = normalizeProduct(gskill);
    expect(product).not.toBeNull();
    const row = toSnapshotRow(product!);
    expect(row.memory_type).toBe("DDR5");
    expect(row.capacity_gb).toBe(32);
    expect(row.speed_mhz).toBe(6000);
    expect(row.cas_latency).toBe(30);
    expect(row.capacity_per_module_gb).toBe(16);
    expect(row.shop_stock).toEqual({ "4": 0, "7": 2, "10": 0 });
  });
});

describe("criteria and helpers", () => {
  it("filters out products that are confidently outside the tracked RAM criteria", () => {
    expect(matchesRamCriteria(normalizeProduct(gskill)!)).toBe(true);
    expect(matchesRamCriteria(normalizeProduct(kingston)!)).toBe(true);
    // DDR5 at 4800 MHz is not tracked yet.
    expect(matchesRamCriteria(normalizeProduct(crucial)!)).toBe(false);
  });

  it("keeps products whose specs could not be parsed", () => {
    const product = normalizeProduct({ id: 9, name: { en: "Unlabelled memory" }, price: 20 });
    expect(product).not.toBeNull();
    expect(matchesRamCriteria(product!)).toBe(true);
  });

  it("deduplicates by Arvutitark product id", () => {
    const deduped = dedupeById(products);
    expect(deduped).toHaveLength(4);
    expect(deduped.filter((item) => item.id === 1528502)).toHaveLength(1);
  });

  it("coerces ids from numbers and numeric strings", () => {
    expect(coerceProductId(1528502)).toBe(1528502);
    expect(coerceProductId("1528502")).toBe(1528502);
    expect(coerceProductId("abc")).toBeNull();
    expect(coerceProductId(-5)).toBeNull();
    expect(coerceProductId(1.5)).toBeNull();
  });

  it("builds absolute retailer URLs from relative paths", () => {
    expect(buildProductUrl("toode/abc")).toBe("https://arvutitark.ee/toode/abc");
    expect(buildProductUrl("/toode/abc")).toBe("https://arvutitark.ee/toode/abc");
    expect(buildProductUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(buildProductUrl(null)).toBeNull();
  });

  it("normalizes shop stock maps and drops unparseable entries", () => {
    expect(normalizeShopStock({ "1": 2, "2": "3", "3": "n/a", "4": null })).toEqual({ "1": 2, "2": 3 });
    expect(normalizeShopStock(null)).toEqual({});
  });

  it("formats a readable spec summary", () => {
    expect(formatSpecSummary(extractRamSpecs(gskill))).toBe("32GB · 2×16GB · DDR5-6000 · CL30 · UDIMM");
  });
});
