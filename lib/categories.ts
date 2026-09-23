import {
  ARVUTITARK_CPU_ATTRIBUTES,
  ARVUTITARK_CPU_BRANDS,
  ARVUTITARK_CPU_CATEGORY_ID,
  ARVUTITARK_GPU_ATTRIBUTES,
  ARVUTITARK_GPU_CATEGORY_ID,
  ARVUTITARK_GPU_CHIPSETS,
  ARVUTITARK_HDD_ATTRIBUTES,
  ARVUTITARK_HDD_CATEGORY_ID,
  ARVUTITARK_RAM_ATTRIBUTES,
  ARVUTITARK_RAM_CATEGORY_ID,
  ARVUTITARK_SSD_ATTRIBUTES,
  ARVUTITARK_SSD_CATEGORY_ID,
} from "./arvutitark/config";
import type { ComponentCategory } from "./arvutitark/types";

/**
 * Category and group registry.
 *
 * Adding a group is one entry here plus a spec extractor in
 * `lib/arvutitark/normalize.ts`. The scraper loop, the query layer, the routes
 * and the UI all read from this list.
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
  /** Arvutitark category id, or null when the group is pinned by product id. */
  arvutitarkCategoryId: number | null;
  /** Attribute filter, or null for id-pinned groups. */
  attributes: string | null;
  /** Brands filter, for the one category whose URL uses one. */
  brands?: string;
  /** Column header for the capacity field. */
  capacityLabel: string;
  /** Which spec filters make sense for this group. */
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
  cpu: {
    category: "cpu",
    label: "CPUs",
    title: "CPU Price Tracker",
    subtitle: "Arvutitark price history · Ryzen 5/7/9 and Core Ultra 5/7/9",
    path: "/cpu",
    detailBasePath: "/cpu",
    specHint: "AMD Ryzen 5/7/9 · Intel Core Ultra 5/7/9",
    arvutitarkCategoryId: ARVUTITARK_CPU_CATEGORY_ID,
    attributes: ARVUTITARK_CPU_ATTRIBUTES,
    brands: ARVUTITARK_CPU_BRANDS,
    capacityLabel: "Capacity",
    facets: { capacity: false, speed: false, casLatency: false, moduleCount: false },
  },
  hdd: {
    category: "hdd",
    label: "HDDs",
    title: "HDD Price Tracker",
    subtitle: "Arvutitark price history · mechanical drives from 1 TB to 5 TB",
    path: "/hdd",
    detailBasePath: "/hdd",
    specHint: "1 TB – 5 TB mechanical drives",
    arvutitarkCategoryId: ARVUTITARK_HDD_CATEGORY_ID,
    attributes: ARVUTITARK_HDD_ATTRIBUTES,
    capacityLabel: "Capacity",
    facets: { capacity: true, speed: false, casLatency: false, moduleCount: false },
  },
  ssd: {
    category: "ssd",
    label: "SSDs",
    title: "SSD Price Tracker",
    subtitle:
      "Arvutitark price history · NVMe and SATA drives, 3500+ MB/s read and write",
    path: "/ssd",
    detailBasePath: "/ssd",
    specHint: "3500+ MB/s read & write",
    arvutitarkCategoryId: ARVUTITARK_SSD_CATEGORY_ID,
    attributes: ARVUTITARK_SSD_ATTRIBUTES,
    capacityLabel: "Capacity",
    facets: { capacity: true, speed: false, casLatency: false, moduleCount: false },
  },
  custom: {
    category: "custom",
    label: "Custom",
    title: "Custom Tracked Items",
    subtitle: "Individually pinned products, tracked outside every category filter",
    path: "/custom",
    detailBasePath: "/custom",
    specHint: "Pinned by product id, independent of category filters",
    arvutitarkCategoryId: null,
    attributes: null,
    capacityLabel: "Capacity",
    facets: { capacity: false, speed: false, casLatency: false, moduleCount: false },
  },
};

/** Order used by navigation and by the scraper. */
export const CATEGORY_LIST: ReadonlyArray<CategoryDefinition> = [
  CATEGORY_DEFINITIONS.ram,
  CATEGORY_DEFINITIONS.gpu,
  CATEGORY_DEFINITIONS.cpu,
  CATEGORY_DEFINITIONS.hdd,
  CATEGORY_DEFINITIONS.ssd,
  CATEGORY_DEFINITIONS.custom,
];

export const COMPONENT_CATEGORIES: ReadonlyArray<ComponentCategory> = [
  "ram",
  "gpu",
  "cpu",
  "hdd",
  "ssd",
  "custom",
];

export function isComponentCategory(value: string): value is ComponentCategory {
  return (COMPONENT_CATEGORIES as ReadonlyArray<string>).includes(value);
}

export function getCategoryDefinition(category: ComponentCategory): CategoryDefinition {
  return CATEGORY_DEFINITIONS[category];
}

/**
 * Href for a product detail page within its own group.
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
