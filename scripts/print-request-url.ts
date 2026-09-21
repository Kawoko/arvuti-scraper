/**
 * Prints the exact Arvutitark request URL WITHOUT contacting the API.
 *
 * Use this to compare our request against the browser's working request, and to
 * confirm that the multi-value filter uses U+FE50 SMALL COMMA (encoded as
 * %EF%B9%90) rather than an ASCII comma (which the API answers with zero
 * products).
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { buildProductsUrl } from "@/lib/arvutitark/client";
import { ARVUTITARK_RAM_ATTRIBUTES, getScraperConfig } from "@/lib/arvutitark/config";

const config = getScraperConfig();
const url = buildProductsUrl(config.baseUrl, { page: 1 });

// Render U+FE50 as an escape sequence so it is unambiguous in a terminal.
const escapedFilter = ARVUTITARK_RAM_ATTRIBUTES.replace(/\uFE50/g, "\\uFE50");

console.log("Arvutitark request preview (no network request is made)\n");
console.log("Attributes filter (decoded):");
console.log(`  ${ARVUTITARK_RAM_ATTRIBUTES}`);
console.log("\nAttributes filter (with U+FE50 shown as an escape):");
console.log(`  ${escapedFilter}`);
console.log("\nRequest URL:");
console.log(`  ${url}`);
console.log("\nEncoding checks:");
console.log(`  contains %EF%B9%90 (correct U+FE50) : ${url.includes("%EF%B9%90")}`);
console.log(`  contains %2C       (wrong ASCII comma): ${url.includes("%2C")}`);
console.log(`  contains shops= filter                : ${url.includes("shops=")}`);

if (url.includes("%2C")) {
  console.error("\nERROR: the filter uses an ASCII comma. Arvutitark will return zero products.");
  process.exitCode = 1;
}
