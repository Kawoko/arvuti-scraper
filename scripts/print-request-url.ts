/**
 * Prints the exact Arvutitark request URL for every tracked category WITHOUT
 * contacting the API.
 *
 * Use this to compare our requests against the browser's working requests, and
 * to confirm that multi-value filters use U+FE50 SMALL COMMA (encoded as
 * %EF%B9%90) rather than an ASCII comma (which the API answers with zero
 * products).
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { buildProductsUrl } from "@/lib/arvutitark/client";
import { ARVUTITARK_MULTI_VALUE_SEPARATOR, getScraperConfig } from "@/lib/arvutitark/config";
import { CATEGORY_LIST } from "@/lib/categories";

const config = getScraperConfig();

// Render U+FE50 as an escape sequence so it is unambiguous in a terminal.
const escapeSeparator = (value: string) =>
  value.split(ARVUTITARK_MULTI_VALUE_SEPARATOR).join("\\uFE50");

console.log("Arvutitark request preview (no network request is made)\n");

for (const definition of CATEGORY_LIST) {
  const attributes =
    definition.category === "gpu" ? config.gpuAttributes : definition.attributes;

  const url = buildProductsUrl(config.baseUrl, {
    page: 1,
    category: definition.arvutitarkCategoryId,
    attributes,
  });

  console.log("=".repeat(72));
  console.log(`${definition.title}  [category ${definition.arvutitarkCategoryId}]`);
  console.log("=".repeat(72));

  console.log("\nAttributes filter (decoded, single pass):");
  console.log(`  ${decodeURIComponent(attributes)}`);

  console.log("\nAttributes filter (U+FE50 shown as an escape):");
  console.log(`  ${escapeSeparator(attributes)}`);

  console.log("\nRequest URL:");
  console.log(`  ${url}`);

  console.log("\nEncoding checks:");
  console.log(`  contains %EF%B9%90 (correct U+FE50)   : ${url.includes("%EF%B9%90")}`);
  console.log(`  contains %2C       (wrong ASCII comma): ${url.includes("%2C")}`);
  console.log(`  contains shops= filter                : ${url.includes("shops=")}`);
  console.log("");
}

if (CATEGORY_LIST.some((d) => {
  const attributes = d.category === "gpu" ? config.gpuAttributes : d.attributes;
  return buildProductsUrl(config.baseUrl, {
    page: 1,
    category: d.arvutitarkCategoryId,
    attributes,
  }).includes("%2C");
})) {
  console.error("ERROR: a filter uses an ASCII comma. Arvutitark will return zero products.");
  process.exitCode = 1;
}
