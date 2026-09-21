import { describe, expect, it } from "vitest";

import {
  ARVUTITARK_ATTRIBUTE_IDS,
  ARVUTITARK_MULTI_VALUE_SEPARATOR,
  ARVUTITARK_RAM_ATTRIBUTES,
  buildAttributeFilter,
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
