import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildProductsUrl } from "@/lib/arvutitark/client";
import {
  ARVUTITARK_CPU_ATTRIBUTES,
  ARVUTITARK_HDD_ATTRIBUTES,
  ARVUTITARK_SSD_ATTRIBUTES,
} from "@/lib/arvutitark/config";
import {
  extractCpuSpecs,
  extractCustomSpecs,
  extractGpuSpecs,
  extractStorageSpecs,
  formatSpecSummary,
  normalizeProduct,
  toSnapshotRow,
} from "@/lib/arvutitark/normalize";
import type { ArvutitarkProduct } from "@/lib/arvutitark/types";
import { CATEGORY_LIST, productDetailHref } from "@/lib/categories";
import { CUSTOM_ITEM_IDS, customItemsIdFilter } from "@/lib/custom-items";
import { DEAL_COLUMNS } from "@/lib/queries/deals";
import { LIST_COLUMNS } from "@/lib/queries/products";
import { buildSnapshotRows } from "@/lib/scraper/run";

import groupsFixture from "./fixtures/arvutitark-groups-page.json";
import gpuFixture from "./fixtures/arvutitark-gpu-page.json";

const products = groupsFixture.data as unknown as ArvutitarkProduct[];
const gpuProducts = gpuFixture.data as unknown as ArvutitarkProduct[];

const [cpu, hdd, ssd, lexar, gskill, asrock] = products as [
  ArvutitarkProduct,
  ArvutitarkProduct,
  ArvutitarkProduct,
  ArvutitarkProduct,
  ArvutitarkProduct,
  ArvutitarkProduct,
];

const silentLogger = { info: () => {}, error: () => {} };

describe("CPU specification extraction", () => {
  it("reads family and socket from the live attribute shape", () => {
    const specs = extractCpuSpecs(cpu);

    expect(specs.family).toBe("AMD Ryzen\u2122 5");
    expect(specs.socket).toBe("AM5");
  });

  it("never invents fields that do not apply to a CPU", () => {
    const specs = extractCpuSpecs(cpu);

    expect(specs.capacityGb).toBeNull();
    expect(specs.memoryType).toBeNull();
    expect(specs.chipset).toBeNull();
    expect(specs.readSpeedMbs).toBeNull();
    expect(specs.interfaceType).toBeNull();
  });

  it("formats a CPU summary as family and socket", () => {
    expect(formatSpecSummary(extractCpuSpecs(cpu))).toBe("AMD Ryzen\u2122 5 · AM5");
  });
});

describe("storage specification extraction", () => {
  it("reads HDD capacity, form factor, interface and transfer rates", () => {
    const specs = extractStorageSpecs(hdd, "hdd");

    expect(specs.capacityGb).toBe(1024);
    expect(specs.formFactor).toBe('3.5"');
    expect(specs.interfaceType).toBe("Serial ATA III");
    expect(specs.readSpeedMbs).toBe(150);
    expect(specs.writeSpeedMbs).toBe(150);
  });

  it("reads SSD capacity, form factor, interface and transfer rates", () => {
    const specs = extractStorageSpecs(ssd, "ssd");

    expect(specs.capacityGb).toBe(1024);
    expect(specs.formFactor).toBe("M.2 22x80mm");
    expect(specs.interfaceType).toBe("PCIe 4.0");
    expect(specs.readSpeedMbs).toBe(5000);
    expect(specs.writeSpeedMbs).toBe(4200);
  });

  it("uses a different capacity attribute for HDD and SSD", () => {
    // Attribute 25 is HDD capacity and 23 is SSD capacity. Reading the wrong
    // one would silently produce a null capacity, so the name deliberately
    // carries no capacity for this to be provable.
    const onlySsdCapacity = {
      id: 1,
      name: { en: "Generic NVMe drive" },
      main_attributes: [{ id: 23, values: { en: ["2 TB"] } }],
    };

    expect(extractStorageSpecs(onlySsdCapacity, "ssd").capacityGb).toBe(2048);
    expect(extractStorageSpecs(onlySsdCapacity, "hdd").capacityGb).toBeNull();
  });

  it("falls back to the product name when the capacity attribute is absent", () => {
    // Both fixtures name their capacity, so a name-only product still resolves.
    expect(extractStorageSpecs(hdd, "ssd").capacityGb).toBe(1024);
  });

  it("formats a drive summary with capacity, interface and throughput", () => {
    expect(formatSpecSummary(extractStorageSpecs(ssd, "ssd"))).toBe(
      "1 TB · M.2 22x80mm · PCIe 4.0 · 5000/4200 MB/s",
    );
  });
});

describe("custom tracked item extraction", () => {
  it("extracts SSD specs and records the source category", () => {
    const product = normalizeProduct(lexar, "custom");

    expect(product).not.toBeNull();
    expect(product?.category).toBe("custom");
    expect(product?.sourceCategory).toBe("ssd");
    expect(product?.specs.capacityGb).toBe(2048);
    expect(product?.specs.readSpeedMbs).toBe(7000);
    expect(product?.specs.writeSpeedMbs).toBe(6000);
  });

  it("extracts RAM specs and records the source category", () => {
    const product = normalizeProduct(gskill, "custom");

    expect(product?.sourceCategory).toBe("ram");
    expect(product?.specs.capacityGb).toBe(32);
    expect(product?.specs.speedMhz).toBe(6000);
    expect(product?.specs.casLatency).toBe(30);
    expect(product?.specs.moduleCount).toBe(2);
    expect(product?.specs.capacityPerModuleGb).toBe(16);
    expect(product?.specs.formFactor).toBe("UDIMM");
    expect(product?.specs.voltage).toBe(1.35);
  });

  it("extracts GPU specs even though the chipset filter would exclude older cards", () => {
    const product = normalizeProduct(asrock, "custom");

    expect(product?.sourceCategory).toBe("gpu");
    expect(product?.specs.chipset).toBe("AMD Radeon RX 9070");
    expect(product?.specs.capacityGb).toBe(16);
    expect(product?.specs.memoryType).toBe("GDDR6");
  });

  it("leaves source_category null for category-tracked rows", () => {
    expect(normalizeProduct(ssd, "ssd")?.sourceCategory).toBeNull();
    expect(normalizeProduct(cpu, "cpu")?.sourceCategory).toBeNull();
  });

  it("falls back to RAM parsing when the source category is unknown", () => {
    const specs = extractCustomSpecs({ id: 1, name: { en: "Unknown DDR5 16GB 5600MHz UDIMM" } });

    expect(specs.capacityGb).toBe(16);
    expect(specs.memoryType).toBe("DDR5");
  });
});

describe("group independence", () => {
  it("keeps the same product id as a separate row per group", () => {
    const asGpu = normalizeProduct(asrock, "gpu");
    const asCustom = normalizeProduct(asrock, "custom");

    // The composite identity (id, category) is what lets both exist at once.
    const gpuRow = toSnapshotRow(asGpu!);
    const customRow = toSnapshotRow(asCustom!);

    expect(gpuRow.id).toBe(customRow.id);
    expect(gpuRow.category).toBe("gpu");
    expect(customRow.category).toBe("custom");
  });

  it("keeps the GPU group's chipset filter while the custom group accepts anything", () => {
    // The fixture contains an RTX 4060 Ti, which is off the tracked whitelist.
    const asGpu = buildSnapshotRows(gpuProducts, "gpu", silentLogger);
    const asCustom = buildSnapshotRows(gpuProducts, "custom", silentLogger);

    expect(asGpu.rows).toHaveLength(3);
    expect(asGpu.skippedByCriteria).toBe(1);

    // Pinning is deliberate: the custom group must not apply category filters.
    expect(asCustom.rows).toHaveLength(4);
    expect(asCustom.skippedByCriteria).toBe(0);
  });

  it("does not filter CPU or storage rows locally", () => {
    const cpuRows = buildSnapshotRows([cpu], "cpu", silentLogger);
    const hddRows = buildSnapshotRows([hdd], "hdd", silentLogger);
    const ssdRows = buildSnapshotRows([ssd], "ssd", silentLogger);

    expect(cpuRows.rows).toHaveLength(1);
    expect(hddRows.rows).toHaveLength(1);
    expect(ssdRows.rows).toHaveLength(1);
    expect(cpuRows.rows[0]?.family).toBe("AMD Ryzen\u2122 5");
    expect(hddRows.rows[0]?.interface_type).toBe("Serial ATA III");
    expect(ssdRows.rows[0]?.read_speed_mbs).toBe(5000);
  });

  it("drops a product whose declared category does not match the group", () => {
    // The SSD payload asked for as a CPU must not be stored as a CPU.
    expect(normalizeProduct(ssd, "cpu")).toBeNull();
  });

  it("still allows the custom group to take products from any category", () => {
    expect(normalizeProduct(ssd, "custom")).not.toBeNull();
    expect(normalizeProduct(cpu, "custom")).not.toBeNull();
  });
});

describe("request building for the new groups", () => {
  it("sends the brands filter for CPUs", () => {
    const url = buildProductsUrl("https://cms.arvutitark.ee/api/products", {
      page: 1,
      category: 15,
      attributes: ARVUTITARK_CPU_ATTRIBUTES,
      brands: "intel,amd",
    });

    expect(url).toContain("brands=intel%2Camd");
    expect(url).toContain("categories=15");
  });

  it("uses U+FE50 ranges for HDD and SSD filters", () => {
    expect(ARVUTITARK_HDD_ATTRIBUTES).toBe("25[1000\uFE50-\uFE505000]");
    expect(ARVUTITARK_SSD_ATTRIBUTES).toBe(
      "23[864\uFE50-\uFE5031458];185[3500\uFE50-\uFE5014900];186[3500\uFE50-\uFE5014000]",
    );
    expect(ARVUTITARK_HDD_ATTRIBUTES).not.toContain(",");
    expect(ARVUTITARK_SSD_ATTRIBUTES).not.toContain(",");
  });

  it("requests pinned items by id and omits the category filters", () => {
    const url = buildProductsUrl("https://cms.arvutitark.ee/api/products", {
      page: 1,
      ids: customItemsIdFilter(),
    });

    expect(url).toContain("ids=1436318%2C1183913%2C1392056");
    // Sending them would exclude the very products being pinned.
    expect(url).not.toContain("attributes=");
    expect(url).not.toContain("categories=");
  });
});

describe("product links stay inside their own group", () => {
  /** Every file that renders a link to a product detail page. */
  function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
      }
    };

    for (const dir of ["app", "components", "lib"]) walk(dir);
    return out;
  }

  it("never hardcodes a /ram/ detail path", () => {
    // Regression guard: a hardcoded `/ram/${id}` link sent every SSD, HDD, CPU
    // and GPU deal to /ram/<id>, where the lookup is scoped to the RAM group and
    // therefore found nothing. Detail links must go through productDetailHref.
    const offenders = sourceFiles().filter((file) =>
      readFileSync(file, "utf8").includes("/ram/"),
    );

    expect(offenders).toEqual([]);
  });

  it("selects the columns that product links depend on", () => {
    // The real regression guard. A missing `category` column does not throw: the
    // row's category is simply undefined, productDetailHref falls back to /ram,
    // and every SSD/HDD/CPU/GPU link silently points at the RAM group. Scanning
    // for the literal string "/ram/" does not catch that, so this asserts the
    // data contract the link depends on.
    for (const [name, columns] of [
      ["LIST_COLUMNS", LIST_COLUMNS],
      ["DEAL_COLUMNS", DEAL_COLUMNS],
    ] as const) {
      const selected = columns.split(",");
      expect(selected, `${name} must select category`).toContain("category");
      expect(selected, `${name} must select is_delisted`).toContain("is_delisted");
      expect(selected, `${name} must select last_seen_date`).toContain("last_seen_date");
    }
  });

  it("falls back to the RAM path only for an unknown category", () => {
    // Documents the fallback that hid the bug, so its behaviour is explicit.
    expect(productDetailHref("nonsense", 1)).toBe("/ram/1");
    expect(productDetailHref("", 1)).toBe("/ram/1");
  });

  it("routes a non-RAM product id to its own group", () => {
    // The same numeric id means a different product in a different group.
    expect(productDetailHref("ssd", 1420998)).not.toContain("/ram/");
    expect(productDetailHref("hdd", 1210237)).not.toContain("/ram/");
    expect(productDetailHref("cpu", 1375186)).not.toContain("/ram/");
    expect(productDetailHref("gpu", 1527001)).not.toContain("/ram/");
  });

  it("passes the delisted flag to every stock badge", () => {
    // A stock badge without `delisted` keeps showing "In stock" for a product
    // the retailer removed, because the last recorded stock figure is frozen.
    const offenders = sourceFiles().filter((file) => {
      const source = readFileSync(file, "utf8");
      const badges = source.match(/<StockBadge[^>]*>/g) ?? [];
      return badges.some((badge) => !badge.includes("delisted="));
    });

    expect(offenders).toEqual([]);
  });
});

describe("group registry", () => {
  it("registers every tracked group", () => {
    expect(CATEGORY_LIST.map((definition) => definition.category)).toEqual([
      "ram",
      "gpu",
      "cpu",
      "hdd",
      "ssd",
      "custom",
    ]);
  });

  it("pins exactly the three requested custom items", () => {
    expect(CUSTOM_ITEM_IDS).toEqual([1436318, 1183913, 1392056]);
  });

  it("routes each group's product detail pages to its own base path", () => {
    expect(productDetailHref("custom", 1436318)).toBe("/custom/1436318");
    expect(productDetailHref("cpu", 1375186)).toBe("/cpu/1375186");
    expect(productDetailHref("hdd", 1210237)).toBe("/hdd/1210237");
    expect(productDetailHref("ssd", 1420998)).toBe("/ssd/1420998");
  });

  it("gives the custom group no category id and no attribute filter", () => {
    const custom = CATEGORY_LIST.find((definition) => definition.category === "custom");

    expect(custom?.arvutitarkCategoryId).toBeNull();
    expect(custom?.attributes).toBeNull();
  });

  it("keeps GPU extraction available for category-tracked graphics cards", () => {
    const specs = extractGpuSpecs(gpuProducts[0] as ArvutitarkProduct);
    expect(specs.chipset).toBe("NVIDIA GeForce RTX\u2122 5070");
  });
});
