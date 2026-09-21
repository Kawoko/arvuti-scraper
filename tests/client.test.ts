import { describe, expect, it } from "vitest";

import {
  ArvutitarkApiError,
  buildProductsUrl,
  fetchAllProducts,
  fetchProductPage,
  parseProductPageResponse,
} from "@/lib/arvutitark/client";
import type { ArvutitarkProduct } from "@/lib/arvutitark/types";

import ramPageFixture from "./fixtures/arvutitark-ram-page.json";
import realPageFixture from "./fixtures/arvutitark-real-page.json";

const fixtureProducts = ramPageFixture.data as unknown as ArvutitarkProduct[];
const realProducts = realPageFixture.data as unknown as ArvutitarkProduct[];

/**
 * Written with an explicit escape on purpose, so this assertion is independent
 * of the production constant. U+FE50 SMALL COMMA is the character Arvutitark's
 * own filter UI sends; an ASCII comma makes the API return zero products.
 */
const EXPECTED_ATTRIBUTES = "28[5600\uFE506000];178[DDR5];181[UDIMM]";
const WRONG_ATTRIBUTES_WITH_ASCII_COMMA = "28[5600,6000];178[DDR5];181[UDIMM]";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type FetchHandler = (url: URL, callIndex: number) => Response | Promise<Response>;

/** Fake `fetch` that records every requested URL. */
function createFetchStub(handler: FetchHandler) {
  const calls: URL[] = [];

  const fetchImpl = (async (input: RequestInfo | URL) => {
    const raw =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw);
    calls.push(url);
    return handler(url, calls.length - 1);
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

describe("buildProductsUrl", () => {
  it("sends the RAM filter set without shop availability filters", () => {
    const url = new URL(buildProductsUrl("https://cms.arvutitark.ee/api/products", { page: 3 }));

    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("perPage")).toBe("200");
    expect(url.searchParams.get("sort")).toBe("price-asc");
    expect(url.searchParams.get("categories")).toBe("20");
    expect(url.searchParams.get("locale")).toBe("et");
    expect(url.searchParams.get("attributes")).toBe(EXPECTED_ATTRIBUTES);
    // Availability must never be part of historical collection.
    expect(url.searchParams.get("shops")).toBeNull();
  });

  it("separates multi-values with U+FE50 SMALL COMMA, not an ASCII comma", () => {
    const attributes = new URL(
      buildProductsUrl("https://cms.arvutitark.ee/api/products", { page: 1 }),
    ).searchParams.get("attributes");

    expect(attributes).toBe(EXPECTED_ATTRIBUTES);
    expect(attributes).toContain("\uFE50");
    expect(attributes).not.toContain(",");
    // Explicit regression guard against the exact value that broke the scrape.
    expect(attributes).not.toBe(WRONG_ATTRIBUTES_WITH_ASCII_COMMA);
  });

  it("percent-encodes U+FE50 as %EF%B9%90 and never as %2C", () => {
    const url = buildProductsUrl("https://cms.arvutitark.ee/api/products", { page: 1 });

    // U+FE50 encodes to EF B9 90 in UTF-8.
    expect(url).toContain("28%5B5600%EF%B9%906000%5D");
    expect(url).not.toContain("%2C");
  });

  it("keeps attribute groups separated by an ASCII semicolon", () => {
    const url = buildProductsUrl("https://cms.arvutitark.ee/api/products", { page: 1 });

    expect(url).toContain("%3B178%5BDDR5%5D");
    expect(url).toContain("%3B181%5BUDIMM%5D");
  });
});

describe("parseProductPageResponse (live Laravel shape)", () => {
  it("reads root-level pagination and the data array", () => {
    const page = parseProductPageResponse(realPageFixture, 1);

    expect(page.products).toHaveLength(2);
    expect(page.meta).toEqual({ currentPage: 1, lastPage: 1, perPage: 200, total: 2 });
  });

  it("leaves per_page and total null when the API omits them", () => {
    const page = parseProductPageResponse({ current_page: 1, last_page: 2, data: [] }, 1);

    expect(page.meta).toEqual({ currentPage: 1, lastPage: 2, perPage: null, total: null });
  });
});

describe("parseProductPageResponse", () => {
  it("reads a { data, meta } envelope", () => {
    const page = parseProductPageResponse(ramPageFixture, 1);
    expect(page.products).toHaveLength(5);
    expect(page.meta).toEqual({ currentPage: 1, lastPage: 2, perPage: 200, total: 240 });
  });

  it("reads a bare array and infers a single page", () => {
    const page = parseProductPageResponse(fixtureProducts, 1);
    expect(page.products).toHaveLength(5);
    expect(page.meta.lastPage).toBe(1);
  });

  it("reads a { products, current_page, last_page } envelope", () => {
    const page = parseProductPageResponse(
      { products: fixtureProducts, current_page: 2, last_page: 4 },
      2,
    );
    expect(page.products).toHaveLength(5);
    expect(page.meta.currentPage).toBe(2);
    expect(page.meta.lastPage).toBe(4);
  });

  it("infers another page when a full page comes back without metadata", () => {
    const fullPage = Array.from({ length: 200 }, (_, index) => ({ id: index + 1 }));
    const page = parseProductPageResponse(fullPage, 1);
    expect(page.meta.lastPage).toBe(2);
  });

  it("fails safely when the response shape changes", () => {
    expect(() => parseProductPageResponse({ unexpected: true }, 1)).toThrow(ArvutitarkApiError);
    expect(() => parseProductPageResponse("nope", 1)).toThrow(/Unexpected Arvutitark response shape/);
    expect(() => parseProductPageResponse(null, 1)).toThrow(ArvutitarkApiError);
  });
});

describe("fetchProductPage", () => {
  it("sends the required headers", async () => {
    let seenHeaders: Headers | undefined;

    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenHeaders = new Headers(init?.headers);
      return jsonResponse(ramPageFixture);
    }) as unknown as typeof fetch;

    await fetchProductPage({ page: 1 }, { fetchImpl, timeoutMs: 1000 });

    expect(seenHeaders?.get("accept")).toBe("application/json");
    expect(seenHeaders?.get("x-arv-country")).toBe("est");
  });

  it("reports HTTP failures with the status code", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 503, statusText: "Service Unavailable" })) as
      unknown as typeof fetch;

    await expect(fetchProductPage({ page: 1 }, { fetchImpl })).rejects.toMatchObject({
      name: "ArvutitarkApiError",
      status: 503,
    });
  });

  it("reports a non-JSON response", async () => {
    const fetchImpl = (async () => new Response("<html>maintenance</html>", { status: 200 })) as
      unknown as typeof fetch;

    await expect(fetchProductPage({ page: 1 }, { fetchImpl })).rejects.toThrow(/not valid JSON/);
  });

  it("times out instead of hanging forever", async () => {
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      })) as unknown as typeof fetch;

    await expect(fetchProductPage({ page: 1 }, { fetchImpl, timeoutMs: 10 })).rejects.toThrow(
      /timed out/,
    );
  });
});

describe("fetchProductPage diagnostics", () => {
  function collectMessages() {
    const messages: string[] = [];
    return { messages, onDebug: (message: string) => messages.push(message) };
  }

  it("logs the request URL, HTTP status and pagination metadata when debug is on", async () => {
    const { messages, onDebug } = collectMessages();
    const { fetchImpl } = createFetchStub(() => jsonResponse(realPageFixture));

    await fetchProductPage({ page: 1 }, { fetchImpl, debug: true, onDebug });

    expect(messages[0]).toMatch(/^GET https:\/\/cms\.arvutitark\.ee\/api\/products\?/);
    expect(messages.some((message) => message.startsWith("HTTP 200"))).toBe(true);
    expect(
      messages.some(
        (message) =>
          message.includes("current_page=1") &&
          message.includes("last_page=1") &&
          message.includes("per_page=200") &&
          message.includes("total=2") &&
          message.includes("data.length=2"),
      ),
    ).toBe(true);
  });

  it("stays quiet on a healthy page when debug is off", async () => {
    const { messages, onDebug } = collectMessages();
    const { fetchImpl } = createFetchStub(() => jsonResponse(realPageFixture));

    await fetchProductPage({ page: 1 }, { fetchImpl, onDebug });

    expect(messages).toHaveLength(0);
  });

  it("always reports response metadata when a page comes back empty", async () => {
    const { messages, onDebug } = collectMessages();
    const { fetchImpl } = createFetchStub(() =>
      jsonResponse({ current_page: 1, last_page: 1, per_page: 200, total: 0, data: [] }),
    );

    await fetchProductPage({ page: 1 }, { fetchImpl, onDebug });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("0 products");
    expect(messages[0]).toContain("root keys:");
    expect(messages[0]).toContain("data.length=0");
    expect(messages[0]).toContain("total=0");
  });

  it("never writes credentials or secrets into debug output", async () => {
    const { messages, onDebug } = collectMessages();
    const { fetchImpl } = createFetchStub(() => jsonResponse(realPageFixture));

    await fetchProductPage({ page: 1 }, { fetchImpl, debug: true, onDebug });

    const joined = messages.join("\n");
    expect(joined).not.toMatch(/supabase/i);
    expect(joined).not.toMatch(/service_role/i);
    expect(joined).not.toMatch(/eyJ/); // JWT prefix
  });

  it("does not dump product bodies into debug output", async () => {
    const { messages, onDebug } = collectMessages();
    const { fetchImpl } = createFetchStub(() => jsonResponse(realPageFixture));

    await fetchProductPage({ page: 1 }, { fetchImpl, debug: true, onDebug });

    // Real product names live in the payload; only counts and metadata may leak.
    expect(messages.join("\n")).not.toContain("Crucial");
    expect(messages.join("\n")).not.toContain("PNY");
  });
});

describe("fetchAllProducts", () => {
  it("follows pagination, deduplicates by product id and never loops tightly", async () => {
    const { fetchImpl, calls } = createFetchStub((_url, callIndex) => {
      if (callIndex === 0) {
        return jsonResponse({
          data: [fixtureProducts[0], fixtureProducts[1]],
          meta: { current_page: 1, last_page: 3, per_page: 200 },
        });
      }
      if (callIndex === 1) {
        // Page 2 repeats product 1528502 and adds 1528504.
        return jsonResponse({
          data: [fixtureProducts[0], fixtureProducts[2]],
          meta: { current_page: 2, last_page: 3, per_page: 200 },
        });
      }
      return jsonResponse({
        data: [fixtureProducts[1]],
        meta: { current_page: 3, last_page: 3, per_page: 200 },
      });
    });

    const result = await fetchAllProducts({ fetchImpl, pageDelayMs: 0 });

    expect(calls).toHaveLength(3);
    expect(result.pageCount).toBe(3);
    expect(result.products).toHaveLength(3);
    expect(new Set(result.products.map((product) => product.id)).size).toBe(3);
  });

  it("stops at the configured page ceiling", async () => {
    const { fetchImpl, calls } = createFetchStub(() =>
      jsonResponse({
        data: fixtureProducts,
        meta: { current_page: 1, last_page: 99, per_page: 200 },
      }),
    );

    const result = await fetchAllProducts({ fetchImpl, pageDelayMs: 0, maxPages: 2 });

    expect(calls).toHaveLength(2);
    expect(result.pageCount).toBe(2);
  });

  it("stops when a page comes back empty", async () => {
    const { fetchImpl, calls } = createFetchStub((_url, callIndex) =>
      jsonResponse(
        callIndex === 0
          ? { data: fixtureProducts, meta: { current_page: 1, last_page: 5, per_page: 200 } }
          : { data: [], meta: { current_page: 2, last_page: 5, per_page: 200 } },
      ),
    );

    const result = await fetchAllProducts({ fetchImpl, pageDelayMs: 0 });

    expect(calls).toHaveLength(2);
    // The fixture repeats a product id, so 5 rows deduplicate to 4 products.
    expect(result.products).toHaveLength(4);
  });

  it("passes live-shape products through unchanged", async () => {
    const { fetchImpl } = createFetchStub(() => jsonResponse(realPageFixture));

    const result = await fetchAllProducts({ fetchImpl, pageDelayMs: 0 });

    expect(result.pageCount).toBe(1);
    expect(result.products).toHaveLength(realProducts.length);
    expect(result.products.map((product) => product.id)).toEqual([1526679, 1526680]);
  });

  it("propagates API errors instead of retrying in a loop", async () => {
    const { fetchImpl, calls } = createFetchStub(() => new Response("down", { status: 500 }));

    await expect(fetchAllProducts({ fetchImpl, pageDelayMs: 0 })).rejects.toThrow(ArvutitarkApiError);
    expect(calls).toHaveLength(1);
  });
});
