import { describe, expect, it } from "vitest";

import {
  ARVUTITARK_ATTRIBUTE_IDS,
  ARVUTITARK_GPU_ATTRIBUTES,
  ARVUTITARK_GPU_CATEGORY_ID,
  ARVUTITARK_GPU_CHIPSETS,
  ARVUTITARK_GPU_VRAM_GB,
  ARVUTITARK_MULTI_VALUE_SEPARATOR,
  ARVUTITARK_RAM_ATTRIBUTES,
  buildAttributeFilter,
  encodeAttributeValue,
  readBooleanEnv,
} from "@/lib/arvutitark/config";

describe("ARVUTITARK_MULTI_VALUE_SEPARATOR", () => {
  it("is U+FE50 SMALL COMMA, not an ASCII comma", () => {
    expect(ARVUTITARK_MULTI_VALUE_SEPARATOR).toBe("\uFE50");
    expect(ARVUTITARK_MULTI_VALUE_SEPARATOR.codePointAt(0)).toBe(0xfe50);
    expect(ARVUTITARK_MULTI_VALUE_SEPARATOR).not.toBe(",");
  });
});

describe("ARVUTITARK_RAM_ATTRIBUTES", () => {
  it("matches the filter the retailer's own UI sends", () => {
    expect(ARVUTITARK_RAM_ATTRIBUTES).toBe("28[5600\uFE506000];178[DDR5];181[UDIMM]");
  });

  it("does not contain an ASCII comma", () => {
    expect(ARVUTITARK_RAM_ATTRIBUTES).not.toContain(",");
    // The exact value that caused the API to return zero products.
    expect(ARVUTITARK_RAM_ATTRIBUTES).not.toBe("28[5600,6000];178[DDR5];181[UDIMM]");
  });

  it("uses the documented attribute ids", () => {
    expect(ARVUTITARK_RAM_ATTRIBUTES).toContain(`${ARVUTITARK_ATTRIBUTE_IDS.speed}[5600`);
    expect(ARVUTITARK_RAM_ATTRIBUTES).toContain(
      `${ARVUTITARK_ATTRIBUTE_IDS.memoryType}[DDR5]`,
    );
    expect(ARVUTITARK_RAM_ATTRIBUTES).toContain(`${ARVUTITARK_ATTRIBUTE_IDS.formFactor}[UDIMM]`);
  });

  it("excludes shop availability so out-of-stock products are still tracked", () => {
    expect(ARVUTITARK_RAM_ATTRIBUTES).not.toContain("shops");
    expect(ARVUTITARK_RAM_ATTRIBUTES).not.toContain("in_stock");
  });
});

describe("graphics card filter", () => {
  it("targets category 18 and the 16 GB VRAM filter", () => {
    expect(ARVUTITARK_GPU_CATEGORY_ID).toBe(18);
    expect(ARVUTITARK_GPU_VRAM_GB).toBe(16);
    expect(ARVUTITARK_GPU_ATTRIBUTES.startsWith("15[16];110[")).toBe(true);
  });

  it("lists every tracked chipset", () => {
    expect(ARVUTITARK_GPU_CHIPSETS).toHaveLength(12);
    expect(ARVUTITARK_GPU_CHIPSETS).toContain("Intel\u00AE Arc\u2122");
    expect(ARVUTITARK_GPU_CHIPSETS).toContain("NVIDIA GeForce RTX\u2122 5090");
    expect(ARVUTITARK_GPU_CHIPSETS).toContain("AMD Radeon\u2122 RX 9070 XT");
  });

  it("separates the chipset values with U+FE50, not an ASCII comma", () => {
    expect(ARVUTITARK_GPU_ATTRIBUTES).toContain("\uFE50");
    expect(ARVUTITARK_GPU_ATTRIBUTES).not.toContain(",");
  });

  it("pre-encodes spaces and trademark symbols the way the retailer does", () => {
    // The retailer's own URLs carry %20 and %E2%84%A2, and the browser then
    // encodes the % again. Reproducing that is what makes the filter match.
    expect(ARVUTITARK_GPU_ATTRIBUTES).toContain("AMD%20Radeon%E2%84%A2%20RX%209070");
    expect(ARVUTITARK_GPU_ATTRIBUTES).toContain("Intel%C2%AE%20Arc%E2%84%A2");
    expect(ARVUTITARK_GPU_ATTRIBUTES).not.toContain(" ");
  });
});

describe("encodeAttributeValue", () => {
  it("encodes spaces, and trademark and registered signs", () => {
    expect(encodeAttributeValue("ab cd")).toBe("ab%20cd");
    expect(encodeAttributeValue("RTX\u2122 5070")).toBe("RTX%E2%84%A2%205070");
    expect(encodeAttributeValue("Intel\u00AE")).toBe("Intel%C2%AE");
  });

  it("escapes a literal percent so it is not double-decoded", () => {
    expect(encodeAttributeValue("100%")).toBe("100%25");
  });
});

describe("buildAttributeFilter", () => {
  it("joins multiple values with U+FE50", () => {
    expect(buildAttributeFilter(28, ["5600", "6000"])).toBe("28[5600\uFE506000]");
  });

  it("emits a single value without a separator", () => {
    expect(buildAttributeFilter(178, ["DDR5"])).toBe("178[DDR5]");
  });
});

describe("readBooleanEnv", () => {
  it("accepts the usual truthy spellings", () => {
    for (const value of ["1", "true", "TRUE", "yes", "on"]) {
      expect(readBooleanEnv("SCRAPER_DEBUG", false, { SCRAPER_DEBUG: value })).toBe(true);
    }
  });

  it("treats anything else as false", () => {
    for (const value of ["0", "false", "no", "off", ""]) {
      expect(readBooleanEnv("SCRAPER_DEBUG", false, { SCRAPER_DEBUG: value })).toBe(false);
    }
  });

  it("falls back when the variable is absent", () => {
    expect(readBooleanEnv("SCRAPER_DEBUG", false, {})).toBe(false);
  });
});
