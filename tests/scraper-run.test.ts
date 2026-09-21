import { describe, expect, it, vi } from "vitest";

import {
  buildSnapshotRows,
  describeEmptyResult,
  runScrape,
  type ScrapeRpcClient,
} from "@/lib/scraper/run";
import type { ArvutitarkProduct } from "@/lib/arvutitark/types";

import ramPageFixture from "./fixtures/arvutitark-ram-page.json";
import realPageFixture from "./fixtures/arvutitark-real-page.json";

const fixtureProducts = ramPageFixture.data as unknown as ArvutitarkProduct[];
const realProducts = realPageFixture.data as unknown as ArvutitarkProduct[];

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
  claim?: () => Promise<{ data: boolean | null; error: { message: string } | null }>;
  ingest?: () => Promise<{
    data: { product_count: number; price_count: number } | null;
    error: { message: string } | null;
  }>;
  finish?: () => Promise<{ error: { message: string } | null }>;
} = {}): Harness {
  const calls: Harness["calls"] = [];

  const rpc: ScrapeRpcClient = {
    claim: async (args) => {
      calls.push({ name: "claim", args });
      return overrides.claim ? overrides.claim() : { data: true, error: null };
    },
    ingest: async (args) => {
      calls.push({ name: "ingest", args: args as unknown as Record<string, unknown> });
      return overrides.ingest
        ? overrides.ingest()
        : { data: { product_count: 2, price_count: 2 }, error: null };
    },
    finish: async (args) => {
      calls.push({ name: "finish", args: args as unknown as Record<string, unknown> });
      return overrides.finish ? overrides.finish() : { error: null };
    },
  };

  return {
    rpc,
    calls,
    callNames: () => calls.map((call) => call.name),
  };
}

function finishCallFor(harness: Harness, status: "completed" | "failed") {
  return harness.calls.find((call) => call.name === "finish" && call.args.p_status === status);
}

describe("buildSnapshotRows", () => {
  it("keeps in-criteria products and counts what was skipped", () => {
    const result = buildSnapshotRows(fixtureProducts, silentLogger);

    // G.Skill twice (dedupe happens upstream in fetchAllProducts), Kingston once.
    expect(result.rows).toHaveLength(3);
    // Crucial 4800 MHz is outside the tracked criteria.
    expect(result.skippedByCriteria).toBe(1);
    // The product without a price is unusable.
    expect(result.skippedAsInvalid).toBe(1);
    expect(result.rawCount).toBe(5);
    expect(result.normalizedCount).toBe(4);
    expect(result.rows[0]?.speed_mhz).toBe(6000);
    expect(result.rows[0]?.capacity_gb).toBe(32);
  });

  it("produces complete rows from the live API shape", () => {
    const result = buildSnapshotRows(realProducts, silentLogger);

    expect(result.rows).toHaveLength(2);
    expect(result.rawCount).toBe(2);
    expect(result.normalizedCount).toBe(2);
    expect(result.skippedByCriteria).toBe(0);
    expect(result.skippedAsInvalid).toBe(0);

    expect(result.rows[0]).toMatchObject({
      id: 1526679,
      name: "PNY Performance DDR5 8GB 5600MHz CL40 Memory",
      brand: "PNY",
      memory_type: "DDR5",
      capacity_gb: 8,
      speed_mhz: 5600,
      cas_latency: 40,
      form_factor: "UDIMM",
      voltage: 1.2,
      price: 131.8,
      warehouse_stock: 30,
      local_stock: 0,
      url: "https://arvutitark.ee/arvutikomponendid/malud-ram/pny-performance-ddr5-8gb-5600mhz",
    });

    expect(result.rows[1]).toMatchObject({
      id: 1526680,
      capacity_gb: 16,
      capacity_per_module_gb: 16,
      module_count: 1,
      cas_latency: 46,
    });
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

  it("distinguishes products rejected by the RAM criteria", () => {
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

    const result = await runScrape({ rpc: harness.rpc, fetchProducts, logger: silentLogger });

    expect(harness.callNames()[0]).toBe("claim");
    expect(fetchProducts).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("completed");
  });

  it("does NOT contact Arvutitark when the day is already claimed", async () => {
    const harness = createHarness({
      claim: async () => ({ data: false, error: null }),
    });
    const fetchProducts = vi.fn(async () => ({ products: fixtureProducts, pageCount: 1 }));

    const result = await runScrape({ rpc: harness.rpc, fetchProducts, logger: silentLogger });

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

    const result = await runScrape({ rpc: harness.rpc, fetchProducts, logger: silentLogger });

    expect(fetchProducts).not.toHaveBeenCalled();
    expect(result.outcome).toBe("failed");
    expect(result.errorMessage).toBe("fetch failed");
  });

  it("does NOT contact Arvutitark when the claim returns a database error", async () => {
    const harness = createHarness({
      claim: async () => ({ data: null, error: { message: "permission denied" } }),
    });
    const fetchProducts = vi.fn(async () => ({ products: fixtureProducts, pageCount: 1 }));

    const result = await runScrape({ rpc: harness.rpc, fetchProducts, logger: silentLogger });

    expect(fetchProducts).not.toHaveBeenCalled();
    expect(result.outcome).toBe("failed");
  });

  it("marks the run failed when the retailer request fails, without retrying", async () => {
    const harness = createHarness();
    const fetchProducts = vi.fn(async () => {
      throw new Error("Arvutitark responded with HTTP 503");
    });

    const result = await runScrape({ rpc: harness.rpc, fetchProducts, logger: silentLogger });

    expect(fetchProducts).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_error_message).toContain("HTTP 503");
    // The run row is updated, never removed, and nothing else is called.
    expect(harness.callNames()).toEqual(["claim", "finish"]);
  });

  it("marks the run failed when ingestion fails", async () => {
    const harness = createHarness({
      ingest: async () => ({ data: null, error: { message: "deadlock detected" } }),
    });

    const result = await runScrape({
      rpc: harness.rpc,
      fetchProducts: async () => ({ products: fixtureProducts, pageCount: 1 }),
      logger: silentLogger,
    });

    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_error_message).toBe("deadlock detected");
  });

  it("fails loudly when the API returns nothing at all", async () => {
    const harness = createHarness();

    const result = await runScrape({
      rpc: harness.rpc,
      fetchProducts: async () => ({ products: [], pageCount: 1 }),
      logger: silentLogger,
    });

    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_error_message).toContain("returned 0 products");
  });

  it("fails loudly when products arrived but the RAM criteria rejected all of them", async () => {
    const harness = createHarness();

    // Same product, but at 4800 MHz, which is outside the tracked speeds.
    const outsideCriteria: ArvutitarkProduct[] = [
      {
        ...realProducts[0],
        main_attributes: [{ id: 28, values: { en: ["4800 MHz"] } }],
        technical_details: undefined,
      },
    ];

    const result = await runScrape({
      rpc: harness.rpc,
      fetchProducts: async () => ({ products: outsideCriteria, pageCount: 1 }),
      logger: silentLogger,
    });

    expect(result.outcome).toBe("failed");
    expect(finishCallFor(harness, "failed")?.args.p_error_message).toContain(
      "outside the tracked RAM criteria",
    );
  });

  it("logs the phase-by-phase snapshot breakdown", async () => {
    const harness = createHarness();
    const { logger, infoMessages } = captureLogger();

    await runScrape({
      rpc: harness.rpc,
      fetchProducts: async () => ({ products: realProducts, pageCount: 1 }),
      logger,
    });

    expect(infoMessages).toContain("Raw products: 2");
    expect(infoMessages).toContain("Normalized/usable: 2");
    expect(infoMessages).toContain("Outside criteria: 0");
    expect(infoMessages).toContain("Invalid: 0");
    expect(infoMessages).toContain("Snapshot rows: 2");
  });

  it("completes a run using the live API shape", async () => {
    const harness = createHarness();

    const result = await runScrape({
      rpc: harness.rpc,
      fetchProducts: async () => ({ products: realProducts, pageCount: 1 }),
      logger: silentLogger,
    });

    expect(result.outcome).toBe("completed");
    expect(result.productCount).toBe(2);
    expect(finishCallFor(harness, "completed")?.args.p_product_count).toBe(2);
  });

  it("records the completion with counts and page totals", async () => {
    const harness = createHarness();

    const result = await runScrape({
      rpc: harness.rpc,
      fetchProducts: async () => ({ products: fixtureProducts, pageCount: 2 }),
      logger: silentLogger,
    });

    const finish = finishCallFor(harness, "completed");
    expect(finish?.args.p_product_count).toBe(2);
    expect(finish?.args.p_page_count).toBe(2);
    expect(result.productCount).toBe(2);
  });

  it("derives the claim date from the Tallinn calendar, not UTC", async () => {
    const harness = createHarness();

    const result = await runScrape({
      rpc: harness.rpc,
      fetchProducts: async () => ({ products: fixtureProducts, pageCount: 1 }),
      // 21:30 UTC is already the next day in Tallinn (UTC+3).
      now: () => new Date("2026-09-21T21:30:00Z"),
      logger: silentLogger,
    });

    expect(result.scrapeDate).toBe("2026-09-22");
    expect(harness.calls[0]?.args.p_scrape_date).toBe("2026-09-22");
    expect(harness.calls[1]?.args.p_scrape_date).toBe("2026-09-22");
  });
});
