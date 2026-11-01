/**
 * Prints the exact Arvutitark request URL for every tracked group WITHOUT
 * contacting the API.
 *
 * Use this to compare our requests against the browser's working requests. The
 * key thing to check is that multi-value ATTRIBUTE filters use U+FE50 SMALL
 * COMMA (encoded as %EF%B9%90). An ASCII comma there makes the API return zero
 * products. The `brands` parameter legitimately uses an ASCII comma, so only the
 * attribute filter is checked for that.
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

interface Preview {
  title: string;
  /** Parameter summary, shown with the separator made explicit. */
  detail: string;
  /** The attribute filter only. */
  attributeFilter: string;
  url: string;
}

const previews: Preview[] = CATEGORY_LIST.map((definition) => {
  const attributes =
    definition.category === "gpu" ? config.gpuAttributes : definition.attributes;

  return {
    title: `${definition.title}  [category ${definition.arvutitarkCategoryId}]`,
    detail: definition.brands ? `${attributes}  brands=${definition.brands}` : attributes,
    attributeFilter: attributes,
    url: buildProductsUrl(config.baseUrl, {
      page: 1,
      category: definition.arvutitarkCategoryId,
      attributes,
      brands: definition.brands,
    }),
  };
});

console.log("Arvutitark request preview (no network request is made)\n");

const broken: string[] = [];

for (const preview of previews) {
  console.log("=".repeat(72));
  console.log(preview.title);
  console.log("=".repeat(72));

  console.log("\nFilter (decoded, single pass):");
  console.log(`  ${decodeURIComponent(preview.detail)}`);

  console.log("\nFilter (U+FE50 shown as an escape):");
  console.log(`  ${escapeSeparator(preview.detail)}`);

  console.log("\nRequest URL:");
  console.log(`  ${preview.url}`);

  const hasAsciiCommaInAttributes = preview.attributeFilter.includes(",");
  if (hasAsciiCommaInAttributes) broken.push(preview.title);

  console.log("\nChecks:");
  console.log(
    `  attribute filter uses %EF%B9%90          : ${preview.url.includes("%EF%B9%90")}`,
  );
  console.log(`  attribute filter is free of ASCII commas: ${!hasAsciiCommaInAttributes}`);
  console.log(`  no shops= availability filter           : ${!preview.url.includes("shops=")}`);
  console.log("");
}

if (broken.length > 0) {
  console.error(
    `ERROR: the attribute filter for ${broken.length} group(s) uses an ASCII comma. Arvutitark will return zero products for: ${broken.join(", ")}`,
  );
  process.exitCode = 1;
}
