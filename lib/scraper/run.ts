import { getTallinnDate } from "@/lib/dates";
import { matchesCategoryCriteria, normalizeProduct, toSnapshotRow } from "@/lib/arvutitark/normalize";
import { snapshotRowSchema } from "@/lib/arvutitark/validation";
import type { ArvutitarkProduct, ComponentCategory, SnapshotRow } from "@/lib/arvutitark/types";

/** One group to collect, with the Arvutitark filter that selects it. */
export interface ScrapeTarget {
  category: ComponentCategory;
  /** Arvutitark category id, or null for the id-pinned group. */
  categoryId: number | null;
  /** Attribute filter, or null for the id-pinned group. */
  attributes: string | null;
  /** Brands filter, ASCII comma separated. */
  brands?: string;
  /** Comma-separated product ids. Present only for the pinned group. */
  ids?: string;
}

/**
 * Orchestration for a single scrape attempt.
 *
 * The ordering here is the core safety guarantee of the whole project:
 *
 *   claim today's date in Supabase
 *              ↓
 *        claimed successfully?
 *      no  →  STOP (never contact Arvutitark)
 *      yes ↓
 *        fetch Arvutitark
 *              ↓
 *        ingest + record outcome
 *
 * Dependencies are injected so this behaviour is unit-testable without a
 * database or the live retailer API.
 */

export interface ScrapeLogger {
  info(message: string): void;
  error(message: string): void;
}

export const consoleScrapeLogger: ScrapeLogger = {
  info: (message) => console.log(`[scrape] ${message}`),
  error: (message) => console.error(`[scrape] ${message}`),
};

export interface ScrapeRpcError {
  message: string;
}

export type ScrapeRpcResult<T> = { data: T; error: ScrapeRpcError | null };

export interface ScrapeRpcClient {
  /**
   * Claims the next available collection slot for the day.
   *
   * Returns the slot number that was claimed, or null when no slot is
   * available (both already taken, or the second is not due yet).
   */
  claim(args: { p_scrape_date: string }): Promise<ScrapeRpcResult<number | null>>;
  ingest(args: {
    p_scrape_date: string;
    p_products: SnapshotRow[];
  }): Promise<ScrapeRpcResult<{ product_count: number; price_count: number } | null>>;
  finish(args: {
    p_scrape_date: string;
    p_slot: number;
    p_status: "completed" | "failed";
    p_product_count: number | null;
    p_page_count: number | null;
    p_error_message: string | null;
  }): Promise<{ error: ScrapeRpcError | null }>;
}

export interface FetchedProducts {
  products: ArvutitarkProduct[];
  pageCount: number;
}

export interface ScrapeRunDeps {
  rpc: ScrapeRpcClient;
  /** Categories to collect, in order. Each is fetched once per scrape. */
  targets: ScrapeTarget[];
  /** Only ever invoked AFTER the daily slot has been successfully claimed. */
  fetchProducts: (target: ScrapeTarget) => Promise<FetchedProducts>;
  now?: () => Date;
  logger?: ScrapeLogger;
}

export type ScrapeOutcome = "skipped" | "completed" | "failed";

export interface ScrapeRunResult {
  outcome: ScrapeOutcome;
  scrapeDate: string;
  /** Slot claimed for the day, or null when nothing was claimed. */
  slot: number | null;
  productCount: number;
  pageCount: number;
  errorMessage: string | null;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

/**
 * Normalize, filter and validate a batch of raw API products.
 *
 * Invalid rows are dropped rather than aborting the whole run, but a result of
 * zero usable products is treated as a failure so a changed API shape is loud
 * instead of silent.
 */
export interface SnapshotBuildResult {
  rows: SnapshotRow[];
  /** Products returned by the API after cross-page deduplication. */
  rawCount: number;
  /** Products that survived normalization. */
  normalizedCount: number;
  /** Normalized products rejected for being outside the tracked RAM criteria. */
  skippedByCriteria: number;
  /** Products dropped because they could not be normalized at all. */
  skippedAsInvalid: number;
}

export function buildSnapshotRows(
  products: ArvutitarkProduct[],
  category: ComponentCategory,
  logger: ScrapeLogger = consoleScrapeLogger,
): SnapshotBuildResult {
  const rows: SnapshotRow[] = [];
  let skippedByCriteria = 0;
  let skippedAsInvalid = 0;

  for (const raw of products) {
    const product = normalizeProduct(raw, category);
    if (!product) {
      skippedAsInvalid += 1;
      continue;
    }
    if (!matchesCategoryCriteria(product)) {
      skippedByCriteria += 1;
      continue;
    }

    const candidate = toSnapshotRow(product);
    const parsed = snapshotRowSchema.safeParse(candidate);
    if (!parsed.success) {
      logger.error(
        `Dropping product ${product.id}: ${parsed.error.issues
          .slice(0, 2)
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
      );
      skippedAsInvalid += 1;
      continue;
    }

    rows.push(candidate);
  }

  return {
    rows,
    rawCount: products.length,
    normalizedCount: products.length - skippedAsInvalid,
    skippedByCriteria,
    skippedAsInvalid,
  };
}

/**
 * Explain exactly which phase removed every candidate product, so a future API
 * change is immediately diagnosable from the log alone.
 */
export function describeEmptyResult(result: SnapshotBuildResult): string {
  if (result.rawCount === 0) {
    return "Arvutitark returned 0 products (data.length = 0); the API filter or query parameters are probably wrong";
  }
  if (result.normalizedCount === 0) {
    return `Arvutitark returned ${result.rawCount} product(s) but none could be normalized; the product structure may have changed`;
  }
  return `Arvutitark returned ${result.rawCount} product(s) but all ${result.skippedByCriteria} were outside the tracked RAM criteria (DDR5 UDIMM 5600/6000 MHz)`;
}

export async function runScrape(deps: ScrapeRunDeps): Promise<ScrapeRunResult> {
  const now = deps.now ?? (() => new Date());
  const logger = deps.logger ?? consoleScrapeLogger;
  const scrapeDate = getTallinnDate(now());

  logger.info(`Tallinn scrape date: ${scrapeDate}`);

  // ---------------------------------------------------------------------
  // 1. Claim today's slot. Must succeed before anything external happens.
  // ---------------------------------------------------------------------
  let slot: number;
  try {
    const { data, error } = await deps.rpc.claim({ p_scrape_date: scrapeDate });
    if (error) throw new Error(error.message);

    if (data === null || data === undefined) {
      logger.info(
        `No collection slot available for ${scrapeDate} (both slots already taken, or the second is not due yet). Exiting without contacting Arvutitark.`,
      );
      return {
        outcome: "skipped",
        scrapeDate,
        slot: null,
        productCount: 0,
        pageCount: 0,
        errorMessage: null,
      };
    }

    slot = data;
  } catch (error) {
    const message = describeError(error);
    logger.error(
      `Could not claim a scrape slot (${message}). Aborting without contacting Arvutitark.`,
    );
    return {
      outcome: "failed",
      scrapeDate,
      slot: null,
      productCount: 0,
      pageCount: 0,
      errorMessage: message,
    };
  }

  logger.info(`Claimed ${scrapeDate} slot ${slot} of 2. Contacting Arvutitark.`);

  // ---------------------------------------------------------------------
  // 2. For each category: fetch, normalize, validate and ingest.
  //
  //    Every category shares the single daily claim taken above, so adding a
  //    category does not add an extra daily fetch opportunity.
  // ---------------------------------------------------------------------
  let pageCount = 0;
  let productCount = 0;

  try {
    for (const target of deps.targets) {
      logger.info(
        `--- ${target.category.toUpperCase()} ${
          target.ids ? `(pinned ids ${target.ids})` : `(Arvutitark category ${target.categoryId})`
        } ---`,
      );

      const fetched = await deps.fetchProducts(target);
      pageCount += fetched.pageCount;
      logger.info(
        `Fetched ${fetched.products.length} unique products across ${fetched.pageCount} page(s).`,
      );

      const built = buildSnapshotRows(fetched.products, target.category, logger);

      // Phase-by-phase accounting. This is what turns a bare "zero products"
      // failure into something immediately diagnosable.
      logger.info(`Raw products: ${built.rawCount}`);
      logger.info(`Normalized/usable: ${built.normalizedCount}`);
      logger.info(`Outside criteria: ${built.skippedByCriteria}`);
      logger.info(`Invalid: ${built.skippedAsInvalid}`);
      logger.info(`Snapshot rows: ${built.rows.length}`);

      // Safety check retained: an empty snapshot must fail the run rather than
      // be recorded as a successful collection.
      if (built.rows.length === 0) {
        throw new Error(`[${target.category}] ${describeEmptyResult(built)}`);
      }

      const { data: ingestResult, error: ingestError } = await deps.rpc.ingest({
        p_scrape_date: scrapeDate,
        p_products: built.rows,
      });
      if (ingestError) throw new Error(`[${target.category}] ${ingestError.message}`);

      const ingested = ingestResult?.product_count ?? built.rows.length;
      productCount += ingested;

      logger.info(
        `Ingested ${ingested} product(s); ${ingestResult?.price_count ?? 0} price observation(s) recorded.`,
      );
    }

    const { error: finishError } = await deps.rpc.finish({
      p_scrape_date: scrapeDate,
      p_slot: slot,
      p_status: "completed",
      p_product_count: productCount,
      p_page_count: pageCount,
      p_error_message: null,
    });
    if (finishError) throw new Error(finishError.message);

    logger.info(`Run for ${scrapeDate} slot ${slot} completed successfully.`);

    return {
      outcome: "completed",
      scrapeDate,
      slot,
      productCount,
      pageCount,
      errorMessage: null,
    };
  } catch (error) {
    const message = describeError(error);
    logger.error(`Run for ${scrapeDate} failed: ${message}`);

    // Record the failure but keep the row: the day stays claimed and is not
    // retried until the next calendar day.
    try {
      const { error: finishError } = await deps.rpc.finish({
        p_scrape_date: scrapeDate,
        p_slot: slot,
        p_status: "failed",
        p_product_count: null,
        p_page_count: null,
        p_error_message: message,
      });
      if (finishError) logger.error(`Could not record failure status: ${finishError.message}`);
    } catch (finishFailure) {
      logger.error(`Could not record failure status: ${describeError(finishFailure)}`);
    }

    return { outcome: "failed", scrapeDate, slot, productCount: 0, pageCount, errorMessage: message };
  }
}
