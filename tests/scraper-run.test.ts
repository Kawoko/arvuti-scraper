import { describe, expect, it, vi } from "vitest";

import { extractGpuSpecs, extractRamSpecs, formatSpecSummary } from "@/lib/arvutitark/normalize";
import type { ArvutitarkProduct } from "@/lib/arvutitark/types";
import {
  buildSnapshotRows,
  describeEmptyResult,
  runScrape,
  type ScrapeRpcClient,
  type ScrapeRunDeps,
  type ScrapeTarget,
} from "@/lib/scraper/run";

import gpuPageFixture from "./fixtures/arvutitark-gpu-page.json";
import ramPageFixture from "./fixtures/arvutitark-ram-page.json";
import realPageFixture from "./fixtures/arvutitark-real-page.json";

const fixtureProducts = ramPageFixture.data as unknown as ArvutitarkProduct[];
const realProducts = realPageFixture.data as unknown as ArvutitarkProduct[];
const gpuProducts = gpuPageFixture.data as unknown as ArvutitarkProduct[];

const RAM_TARGET: ScrapeTarget = { category: "ram", categoryId: 20, attributes: "ram-filter" };
const GPU_TARGET: ScrapeTarget = { category: "gpu", categoryId: 18, attributes: "gpu-filter" };

const silentLogger = { info: () => {}, error: () => {} };

/** Logger that records everything so message content can be asserted. */
function captureLogger() {
  const infoMessages: string[] = [];
  const errorMessages: string[] = [];
  return {
    infoMessages,
    errorMessages,
    logger: {
      info: (message: string) => infoMessages.push(message),
      error: (message: string) => errorMessages.push(message),
    },
  };
}

type CallName = "claim" | "ingest" | "finish";

interface Harness {
  rpc: ScrapeRpcClient;
  calls: Array<{ name: CallName; args: Record<string, unknown> }>;
  callNames: () => string[];
}

function createHarness(overrides: {
  claim?: () => Promise<{ data: number | null; error: { message: string } | null }>;
  ingest?: (args: Record<string, unknown>) => Promise<{
    data: { product_count: number; price_count: number } | null;
    error: { message: string } | null;
  }>;
  finish?: () => Promise<{ error: { message: string } | null }>;
} = {}): Harness {
  const calls: Harness["calls"] = [];

  const rpc: ScrapeRpcClient = {
    claim: async (args) => {
      calls.push({ name: "claim", args });
      // Slot 1 is the default claim in tests.
      return overrides.claim ? overrides.claim() : { data: 1, error: null };
    },
    ingest: async (args) => {
      calls.push({ name: "ingest", args: args as unknown as Record<string, unknown> });
      if (overrides.ingest) return overrides.ingest(args as unknown as Record<string, unknown>);

      // Mirrors the real RPC: it reports how many rows it received.
      const rows = (args as { p_products: unknown[] }).p_products;
      return { data: { product_count: rows.length, price_count: rows.length }, error: null };
    },
    finish: async (args) => {
      calls.push({ name: "finish", args: args as unknown as Record<string, unknown> });
      return overrides.finish ? overrides.finish() : { error: null };
    },
  };

  return { rpc, calls, callNames: () => calls.map((call) => call.name) };
}

function finishCallFor(harness: Harness, status: "completed" | "failed") {
  return harness.calls.find((call) => call.name === "finish" && call.args.p_status === status);
}

/** Deps with sensible defaults, so each test overrides only what it cares about. */
function makeDeps(harness: Harness, overrides: Partial<ScrapeRunDeps> = {}): ScrapeRunDeps {
  return {
    rpc: harness.rpc,
    targets: [RAM_TARGET],
    fetchProducts: async () => ({ products: fixtureProducts, pageCount: 1 }),
    logger: silentLogger,
    ...overrides,
  };
}

describe("buildSnapshotRows", () => {
  it("keeps in-criteria RAM and counts what was skipped", () => {
    const result = buildSnapshotRows(fixtureProducts, "ram", silentLogger);

    // G.Skill twice (dedupe happens upstream in fetchAllProducts), Kingston once.
    expect(result.rows).toHaveLength(3);
    expect(result.skippedByCriteria).toBe(1);
    expect(result.skippedAsInvalid).toBe(1);
    expect(result.rawCount).toBe(5);
    expect(result.normalizedCount).toBe(4);
    expect(result.rows[0]?.category).toBe("ram");
    expect(result.rows[0]?.chipset).toBeNull();
  });

  it("produces complete rows from the live RAM shape", () => {
    const result = buildSnapshotRows(realProducts, "ram", silentLogger);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      id: 1526679,
      category: "ram",
      memory_type: "DDR5",
      capacity_gb: 8,
      speed_mhz: 5600,
      cas_latency: 40,
      chipset: null,
      form_factor: "UDIMM",
      voltage: 1.2,
    });
  });

  it("produces complete rows from the live GPU shape", () => {
    const result = buildSnapshotRows(gpuProducts, "gpu", silentLogger);

    expect(result.rawCount).toBe(4);
    expect(result.normalizedCount).toBe(4);
    // The RTX 4060 Ti is off the tracked chipset list.
    expect(result.skippedByCriteria).toBe(1);
    expect(result.skippedAsInvalid).toBe(0);
    expect(result.rows).toHaveLength(3);

    expect(result.rows[0]).toMatchObject({
      id: 1527001,
      category: "gpu",
      brand: "PNY",
      chipset: "NVIDIA GeForce RTX™ 5070",
      memory_type: "GDDR7",
      capacity_gb: 16,
      speed_mhz: null,
      cas_latency: null,
      module_count: null,
      voltage: null,
      price: 699.9,
      warehouse_stock: 8,
      url: "https://arvutitark.ee/arvutikomponendid/graafikakaardid-vga/pny-rtx-5070-16gb",
    });

    expect(result.rows.map((row) => row.chipset)).toEqual([
      "NVIDIA GeForce RTX™ 5070",
      "NVIDIA GeForce RTX™ 5070 Ti",
      "AMD Radeon™ RX 9070 XT",
    ]);
  });

  it("drops products the retailer files under a different category", () => {
    const result = buildSnapshotRows(gpuProducts, "ram", silentLogger);

    // Every graphics card declares primary_category_id 18, so none of them is
    // misfiled as RAM even though the RAM spec criteria are deliberately soft.
    expect(result.rows).toHaveLength(0);
    expect(result.skippedAsInvalid).toBe(4);
    expect(result.skippedByCriteria).toBe(0);
  });

  it("accepts products whose declared category matches", () => {
    const result = buildSnapshotRows(realProducts, "ram", silentLogger);

    // The live RAM fixture declares no category, so the guard stays permissive.
    expect(result.rows).toHaveLength(2);
  });
});

describe("graphics card specification extraction", () => {
  it("reads VRAM, memory technology and chipset", () => {
    const specs = extractGpuSpecs(gpuProducts[0] as ArvutitarkProduct);

    expect(specs.capacityGb).toBe(16);
    expect(specs.memoryType).toBe("GDDR7");
    expect(specs.chipset).toBe("NVIDIA GeForce RTX™ 5070");
    // RAM-only fields stay null rather than being invented.
    expect(specs.speedMhz).toBeNull();
    expect(specs.casLatency).toBeNull();
    expect(specs.moduleCount).toBeNull();
    expect(specs.capacityPerModuleGb).toBeNull();
    expect(specs.formFactor).toBeNull();
    expect(specs.voltage).toBeNull();
  });

  it("keeps RAM extraction free of a chipset", () => {
    expect(extractRamSpecs(realProducts[0] as ArvutitarkProduct).chipset).toBeNull();
  });

  it("formats a graphics card summary chipset-first", () => {
    expect(formatSpecSummary(extractGpuSpecs(gpuProducts[0] as ArvutitarkProduct))).toBe(
      "NVIDIA GeForce RTX™ 5070 · 16GB · GDDR7",
    );
  });

  it("still formats a RAM summary the RAM way", () => {
    expect(formatSpecSummary(extractRamSpecs(realProducts[0] as ArvutitarkProduct))).toBe(
      "8GB · DDR5-5600 · CL40 · UDIMM",
    );
  });
});

describe("describeEmptyResult", () => {
  it("distinguishes an empty API response", () => {
    const message = describeEmptyResult({
      rows: [],
      rawCount: 0,
      normalizedCount: 0,
      skippedByCriteria: 0,
      skippedAsInvalid: 0,
    });

    expect(message).toContain("returned 0 products");
    expect(message).toContain("query parameters");
  });

  it("distinguishes products that could not be normalized", () => {
    const message = describeEmptyResult({
      rows: [],
      rawCount: 40,
      normalizedCount: 0,
      skippedByCriteria: 0,
      skippedAsInvalid: 40,
    });

    expect(message).toContain("40 product(s)");
    expect(message).toContain("none could be normalized");
  });

  it("distinguishes products rejected by the criteria", () => {
    const message = describeEmptyResult({
      rows: [],
      rawCount: 40,
      normalizedCount: 40,
      skippedByCriteria: 40,
      skippedAsInvalid: 0,
    });

    expect(message).toContain("outside the tracked RAM criteria");
    expect(message).toContain("5600/6000");
  });
});

describe("runScrape daily claim guarantee", () => {
  it("claims the day before contacting Arvutitark", async () => {
    const harness = createHarness();
    const fetchProducts = vi.fn(async () => ({ products: fixtureProducts, pageCount: 1 }));

    const result = await runScrape(makeDeps(harness, { fetchProducts }));

    expect(harness.callNames()[0]).toBe("claim");
    expect(fetchProducts).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("completed");
  });

  it("does NOT contact Arvutitark when no slot is available", async () => {
    const harness = createHarness({ claim: async () => ({ data: null, error: null }) });
    const fetchProducts = vi.fn(async () => ({ products: fixtureProducts, pageCount: 1 }));

    const result = await runScrape(makeDeps(harness, { fetchProducts }));

    expect(fetchProducts).not.toHaveBeenCalled();
    expect(result.outcome).toBe("skipped");
    expect(harness.callNames()).toEqual(["claim"]);
  });

  it("does NOT contact Arvutitark when Supabase is unavailable", async () => {
    const harness = createHarness({
      claim: async () => {
        throw new Error("fetch failed");
      },
    });
    const fetchProducts = vi.fn(async () => ({ products: fixtureProducts, pageCount: 1 }));

    const result = await runScrape(makeDeps(harness, { fetchProducts }));

    expect(fetchProducts).not.toHaveBeenCalled();
    expect(result.outcome).toBe("failed");
    expect(result.errorMessage).toBe("fetch failed");
  });

  it("does NOT contact Arvutitark when the claim returns a database error", async () => {
    const harness = createHarness({
      claim: async () => ({ data: null, error: { message: "permission denied" } }),
    });
    const fetchProducts = vi.fn(async () => ({ products: fixtureProducts, pageCount: 1 }));

    const result = await runScrape(makeDeps(harness, { fetchProducts }));

    expect(fetchProducts).not.toHaveBeenCalled();
    expect(result.outcome).toBe("failed");
    expect(result.slot).toBeNull();
  });

  it("records the claimed slot on the run", async () => {
    const harness = createHarness({ claim: async () => ({ data: 2, error: null }) });

    const result = await runScrape(makeDeps(harness));

    expect(result.outcome).toBe("completed");
    expect(result.slot).toBe(2);
    expect(finishCallFor(harness, "completed")?.args.p_slot).toBe(2);
  });

  it("reports slot 1 for the first collection of the day", async () => {
    const harness = createHarness();

    const result = await runScrape(makeDeps(harness));

    expect(result.slot).toBe(1);
    expect(finishCallFor(harness, "completed")?.args.p_slot).toBe(1);
  });

  it("sends the claimed slot when recording a failure", async () => {
    const harness = createHarness({ claim: async () => ({ data: 2, error: null }) });

    const result = await runScrape(
      makeDeps(harness, {
        fetchProducts: async () => {
          throw new Error("Arvutitark responded with HTTP 503");
        },
      }),
    );

    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_slot).toBe(2);
  });

  it("marks the run failed when the retailer request fails, without retrying", async () => {
    const harness = createHarness();
    const fetchProducts = vi.fn(async () => {
      throw new Error("Arvutitark responded with HTTP 503");
    });

    const result = await runScrape(makeDeps(harness, { fetchProducts }));

    expect(fetchProducts).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_error_message).toContain("HTTP 503");
    expect(harness.callNames()).toEqual(["claim", "finish"]);
  });

  it("marks the run failed when ingestion fails", async () => {
    const harness = createHarness({
      ingest: async () => ({ data: null, error: { message: "deadlock detected" } }),
    });

    const result = await runScrape(makeDeps(harness));

    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_error_message).toContain("deadlock detected");
  });

  it("fails loudly when the API returns nothing at all", async () => {
    const harness = createHarness();

    const result = await runScrape(
      makeDeps(harness, { fetchProducts: async () => ({ products: [], pageCount: 1 }) }),
    );

    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_error_message).toContain("returned 0 products");
  });

  it("fails loudly when products arrived but the criteria rejected all of them", async () => {
    const harness = createHarness();

    // Same product, but at 4800 MHz, which is outside the tracked speeds.
    const outsideCriteria: ArvutitarkProduct[] = [
      {
        ...realProducts[0],
        main_attributes: [{ id: 28, values: { en: ["4800 MHz"] } }],
        technical_details: undefined,
      },
    ];

    const result = await runScrape(
      makeDeps(harness, {
        fetchProducts: async () => ({ products: outsideCriteria, pageCount: 1 }),
      }),
    );

    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_error_message).toContain(
      "outside the tracked RAM criteria",
    );
  });

  it("logs the phase-by-phase snapshot breakdown", async () => {
    const harness = createHarness();
    const { logger, infoMessages } = captureLogger();

    await runScrape(makeDeps(harness, { logger }));

    expect(infoMessages).toContain("Raw products: 5");
    expect(infoMessages).toContain("Normalized/usable: 4");
    expect(infoMessages).toContain("Outside criteria: 1");
    expect(infoMessages).toContain("Invalid: 1");
    expect(infoMessages).toContain("Snapshot rows: 3");
  });

  it("records the completion with counts and page totals", async () => {
    const harness = createHarness();

    const result = await runScrape(
      makeDeps(harness, { fetchProducts: async () => ({ products: fixtureProducts, pageCount: 2 }) }),
    );

    const finish = finishCallFor(harness, "completed");
    expect(finish?.args.p_product_count).toBe(3);
    expect(finish?.args.p_page_count).toBe(2);
    expect(result.productCount).toBe(3);
  });

  it("derives the claim date from the Tallinn calendar, not UTC", async () => {
    const harness = createHarness();

    const result = await runScrape(
      makeDeps(harness, { now: () => new Date("2026-09-21T21:30:00Z") }),
    );

    expect(result.scrapeDate).toBe("2026-09-22");
    expect(harness.calls[0]?.args.p_scrape_date).toBe("2026-09-22");
    expect(harness.calls[1]?.args.p_scrape_date).toBe("2026-09-22");
  });
});

describe("runScrape across categories", () => {
  it("collects every category under a single daily claim", async () => {
    const harness = createHarness();
    const requested: string[] = [];

    const result = await runScrape(
      makeDeps(harness, {
        targets: [RAM_TARGET, GPU_TARGET],
        fetchProducts: async (target) => {
          requested.push(target.category);
          return target.category === "gpu"
            ? { products: gpuProducts, pageCount: 1 }
            : { products: realProducts, pageCount: 1 };
        },
      }),
    );

    expect(result.outcome).toBe("completed");
    expect(requested).toEqual(["ram", "gpu"]);
    // Two categories, still exactly one claim for the day.
    expect(harness.calls.filter((call) => call.name === "claim")).toHaveLength(1);
    expect(harness.calls.filter((call) => call.name === "ingest")).toHaveLength(2);
    // 2 RAM products + 3 tracked graphics cards.
    expect(result.productCount).toBe(5);
  });

  it("records each category with its own category value", async () => {
    const harness = createHarness();

    await runScrape(
      makeDeps(harness, {
        targets: [RAM_TARGET, GPU_TARGET],
        fetchProducts: async (target) =>
          target.category === "gpu"
            ? { products: gpuProducts, pageCount: 1 }
            : { products: realProducts, pageCount: 1 },
      }),
    );

    const ingestedCategories = harness.calls
      .filter((call) => call.name === "ingest")
      .map((call) => (call.args.p_products as Array<{ category: string }>)[0]?.category);

    expect(ingestedCategories).toEqual(["ram", "gpu"]);
  });

  it("fails the whole run and names the category that failed", async () => {
    const harness = createHarness();

    const result = await runScrape(
      makeDeps(harness, {
        targets: [RAM_TARGET, GPU_TARGET],
        fetchProducts: async (target) => {
          if (target.category === "gpu") return { products: [], pageCount: 1 };
          return { products: realProducts, pageCount: 1 };
        },
      }),
    );

    expect(result.outcome).toBe("failed");
    const message = finishCallFor(harness, "failed")?.args.p_error_message as string;
    expect(message).toContain("[gpu]");
    expect(message).toContain("returned 0 products");
    // RAM still ingested before the graphics card failure.
    expect(harness.calls.filter((call) => call.name === "ingest")).toHaveLength(1);
  });
});
