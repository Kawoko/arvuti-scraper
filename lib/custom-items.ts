/**
 * Individually pinned products, tracked by product id instead of by a category
 * filter.
 *
 * These form their own group. Pinning exists precisely so that a product stays
 * tracked even if it falls outside a category's filters (a GPU that drops below
 * the tracked chipset list, a drive outside the speed band), so it must never be
 * merged into a category or be able to overwrite one.
 */
export interface CustomTrackedItem {
  productId: number;
  /** Human label used in logs. */
  label: string;
  /** The retailer page this item was pinned from. */
  url: string;
}

export const CUSTOM_TRACKED_ITEMS: ReadonlyArray<CustomTrackedItem> = [
  {
    productId: 1436318,
    label: "ASRock Radeon RX 9070 Challenger 16GB",
    url: "https://arvutitark.ee/arvutikomponendid/graafikakaardid-vga/asrock-rx-9070-16gb-radeon-challenger-3-ventilaatoriga-graaf-1436318",
  },
  {
    productId: 1183913,
    label: "G.Skill Ripjaws S5 32GB DDR5-6000 CL30",
    url: "https://arvutitark.ee/arvutikomponendid/malud-ram/gskill-ripjaws-s5-32-kit-16gbx2-gb-ddr5-6000-mhz-pcse-1183913",
  },
  {
    productId: 1392056,
    label: "Lexar NQ790 2TB NVMe SSD",
    url: "https://arvutitark.ee/arvutikomponendid/andmekandjad/pooljuhtkettad-ssd/lexar-ssd-nq790-2tb-nvme-4x4-2280-70006000mbs-1392056",
  },
];

export const CUSTOM_ITEM_IDS: ReadonlyArray<number> = CUSTOM_TRACKED_ITEMS.map(
  (item) => item.productId,
);

/**
 * `1436318,1183913,1392056`
 *
 * The products endpoint accepts a comma-separated `ids` parameter, so every
 * pinned item is collected in a single request rather than one request each.
 * (Verified against the live API: `ids=a,b,c` returns exactly those products.)
 */
export function customItemsIdFilter(items: ReadonlyArray<CustomTrackedItem> = CUSTOM_TRACKED_ITEMS): string {
  return items.map((item) => String(item.productId)).join(",");
}

export function findCustomItem(productId: number): CustomTrackedItem | null {
  return CUSTOM_TRACKED_ITEMS.find((item) => item.productId === productId) ?? null;
}
