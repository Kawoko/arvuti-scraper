/**
 * Prints the exact Arvutitark request URL for every tracked group WITHOUT
 * contacting the API.
 *
 * Use this to compare our requests against the browser's working requests. The
 * key thing to check is that multi-value ATTRIBUTE filters use U+FE50 SMALL
 * COMMA (encoded as %EF%B9%90). An ASCII comma there makes the API return zero
 * products.
 *
 * Note that `brands` and `ids` are different: those parameters legitimately use
 * an ASCII comma, so only the attribute filter is checked for that.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { buildProductsUrl } from "@/lib/arvutitark/client";
import { ARVUTITARK_MULTI_VALUE_SEPARATOR, getScraperConfig } from "@/lib/arvutitark/config";
import { CATEGORY_LIST } from "@/lib/categories";
import { CUSTOM_TRACKED_ITEMS, customItemsIdFilter } from "@/lib/custom-items";

const config = getScraperConfig();

// Render U+FE50 as an escape sequence so it is unambiguous in a terminal.
const escapeSeparator = (value: string) =>
  value.split(ARVUTITARK_MULTI_VALUE_SEPARATOR).join("\\uFE50");

interface Preview {
  title: string;
  /** Parameter summary, shown with the separator made explicit. */
  detail: string;
  /** The attribute filter only. Null for the id-pinned group. */
  attributeFilter: string | null;
  url: string;
}

const previews: Preview[] = CATEGORY_LIST.map((definition) => {
  if (definition.category === "custom") {
    const ids = customItemsIdFilter();
    return {
      title: `${definition.title}  [pinned by product id]`,
      detail: `ids=${ids}`,
      attributeFilter: null,
      url: buildProductsUrl(config.baseUrl, { page: 1, perPage: 50, ids }),
    };
  }

  const attributes =
    definition.category === "gpu" ? config.gpuAttributes : (definition.attributes ?? "");

  return {
    title: `${definition.title}  [category ${definition.arvutitarkCategoryId}]`,
    detail: definition.brands ? `${attributes}  brands=${definition.brands}` : attributes,
    attributeFilter: attributes,
    url: buildProductsUrl(config.baseUrl, {
      page: 1,
      category: definition.arvutitarkCategoryId ?? undefined,
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

  const hasAsciiCommaInAttributes = preview.attributeFilter?.includes(",") ?? false;
  if (hasAsciiCommaInAttributes) broken.push(preview.title);

  console.log("\nChecks:");
  if (preview.attributeFilter !== null) {
    console.log(
      `  attribute filter uses %EF%B9%90          : ${preview.url.includes("%EF%B9%90")}`,
    );
    console.log(`  attribute filter is free of ASCII commas: ${!hasAsciiCommaInAttributes}`);
  } else {
    console.log("  id-pinned request: no attribute filter is sent at all");
  }
  console.log(`  no shops= availability filter           : ${!preview.url.includes("shops=")}`);
  console.log("");
}

if (broken.length > 0) {
  console.error(
    `ERROR: the attribute filter for ${broken.length} group(s) uses an ASCII comma. Arvutitark will return zero products for: ${broken.join(", ")}`,
  );
  process.exitCode = 1;
}

console.log(`Pinned custom items: ${CUSTOM_TRACKED_ITEMS.length}`);
for (const item of CUSTOM_TRACKED_ITEMS) {
  console.log(`  ${item.productId}  ${item.label}`);
}
