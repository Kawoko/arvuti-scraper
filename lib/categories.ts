import {
  ARVUTITARK_GPU_ATTRIBUTES,
  ARVUTITARK_GPU_CATEGORY_ID,
  ARVUTITARK_GPU_CHIPSETS,
  ARVUTITARK_RAM_ATTRIBUTES,
  ARVUTITARK_RAM_CATEGORY_ID,
} from "./arvutitark/config";
import type { ComponentCategory } from "./arvutitark/types";

/**
 * Category registry.
 *
 * Adding a category means adding one entry here plus a spec extractor and a
 * criteria check in `lib/arvutitark/normalize.ts`. The database, the scraper
 * loop and the UI are all driven by this list.
 */
export interface CategoryDefinition {
  category: ComponentCategory;
  /** Short label for navigation. */
  label: string;
  /** Page heading. */
  title: string;
  subtitle: string;
  /** Route for the listing page. */
  path: string;
  /** Base path for product detail pages, e.g. `/gpu/1527001`. */
  detailBasePath: string;
  /** Hint displayed beneath the "Products tracked" figure. */
  specHint: string;
  arvutitarkCategoryId: number;
  /** Arvutitark attribute filter for this category. */
  attributes: string;
  /** Column header for the capacity field ("Capacity" vs "VRAM"). */
  capacityLabel: string;
  /** Which spec filters make sense for this category. */
  facets: {
    capacity: boolean;
    speed: boolean;
    casLatency: boolean;
    moduleCount: boolean;
  };
}

export const CATEGORY_DEFINITIONS: Record<ComponentCategory, CategoryDefinition> = {
  ram: {
    category: "ram",
    label: "RAM",
    title: "RAM Price Tracker",
    subtitle: "Arvutitark price history · desktop DDR5 UDIMM, 5600 & 6000 MHz",
    path: "/",
    detailBasePath: "/ram",
    specHint: "DDR5 UDIMM 5600 / 6000 MHz",
    arvutitarkCategoryId: ARVUTITARK_RAM_CATEGORY_ID,
    attributes: ARVUTITARK_RAM_ATTRIBUTES,
    capacityLabel: "Capacity",
    facets: { capacity: true, speed: true, casLatency: true, moduleCount: true },
  },
  gpu: {
    category: "gpu",
    label: "GPUs",
    title: "GPU Price Tracker",
    subtitle: "Arvutitark price history · 16 GB current-generation graphics cards",
    path: "/gpu",
    detailBasePath: "/gpu",
    specHint: "16 GB · RTX 50 series, RX 9000, Arc",
    arvutitarkCategoryId: ARVUTITARK_GPU_CATEGORY_ID,
    attributes: ARVUTITARK_GPU_ATTRIBUTES,
    capacityLabel: "VRAM",
    facets: { capacity: true, speed: false, casLatency: false, moduleCount: false },
  },
};

export const CATEGORY_LIST: ReadonlyArray<CategoryDefinition> = [
  CATEGORY_DEFINITIONS.ram,
  CATEGORY_DEFINITIONS.gpu,
];

export function isComponentCategory(value: string): value is ComponentCategory {
  return value === "ram" || value === "gpu";
}

export function getCategoryDefinition(category: ComponentCategory): CategoryDefinition {
  return CATEGORY_DEFINITIONS[category];
}

/**
 * Href for a product detail page within its own category.
 *
 * Takes a plain string because the database column is free text; an unknown
 * value falls back to the RAM path rather than producing a broken link.
 */
export function productDetailHref(category: string, productId: number): string {
  const definition = isComponentCategory(category)
    ? CATEGORY_DEFINITIONS[category]
    : CATEGORY_DEFINITIONS.ram;
  return `${definition.detailBasePath}/${productId}`;
}

export { ARVUTITARK_GPU_CHIPSETS };
