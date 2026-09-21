/**
 * Entry point for the Arvutitark daily scraper.
 *
 * All orchestration (and the one-attempt-per-Tallinn-day guarantee) lives in
 * `lib/scraper/run.ts`; this file only wires up real dependencies and the exit
 * code. It is safe to run hourly.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { fetchAllProducts } from "@/lib/arvutitark/client";
import { getScraperConfig } from "@/lib/arvutitark/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { consoleScrapeLogger, runScrape, type ScrapeRpcClient } from "@/lib/scraper/run";

function createRpcClient(): ScrapeRpcClient {
  const supabase = getSupabaseAdmin();

  return {
    async claim(args) {
      const { data, error } = await supabase.rpc("claim_scrape_run", args);
      return { data: data ?? null, error: error ? { message: error.message } : null };
    },
    async ingest(args) {
      const { data, error } = await supabase.rpc("ingest_snapshot", args);
      return { data: data ?? null, error: error ? { message: error.message } : null };
    },
    async finish(args) {
      const { error } = await supabase.rpc("finish_scrape_run", args);
      return { error: error ? { message: error.message } : null };
    },
  };
}

async function main(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    consoleScrapeLogger.error(
      "Supabase environment is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY). Aborting without contacting Arvutitark.",
    );
    process.exitCode = 1;
    return;
  }

  const config = getScraperConfig();
  if (config.debug) {
    consoleScrapeLogger.info("SCRAPER_DEBUG is enabled: verbose request logging is on.");
  }

  let rpc: ScrapeRpcClient;
  try {
    rpc = createRpcClient();
  } catch (error) {
    consoleScrapeLogger.error(
      `Failed to initialize Supabase client: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  const result = await runScrape({
    rpc,
    fetchProducts: () =>
      fetchAllProducts({
        baseUrl: config.baseUrl,
        timeoutMs: config.requestTimeoutMs,
        pageDelayMs: config.pageDelayMs,
        maxPages: config.maxPages,
        debug: config.debug,
        onDebug: (message) => consoleScrapeLogger.info(message),
        onPage: ({ page, lastPage, count }) => {
          if (count === -1) {
            consoleScrapeLogger.info(
              `Reached the page ceiling at page ${page} (API reported last page ${lastPage}).`,
            );
          } else {
            consoleScrapeLogger.info(`Page ${page}/${lastPage}: ${count} products`);
          }
        },
      }),
    logger: consoleScrapeLogger,
  });

  consoleScrapeLogger.info(`Outcome: ${result.outcome}`);
  process.exitCode = result.outcome === "failed" ? 1 : 0;
}

main().catch((error: unknown) => {
  consoleScrapeLogger.error(
    `Unhandled scraper error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
