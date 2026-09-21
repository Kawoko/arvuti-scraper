import { describe, expect, it } from "vitest";

import {
  DEFAULT_DIRECTION,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  buildProductHref,
  buildProductQuery,
  buildSortHref,
  countActiveFilters,
  describeSort,
  hasActiveFilters,
  nextSortDirection,
  parseProductFilters,
  sortOptionValue,
  withoutFilters,
  type ProductFilters,
} from "@/lib/filters";

describe("parseProductFilters", () => {
  it("defaults to the biggest price drop", () => {
    const filters = parseProductFilters({});

    expect(filters.sort).toBe(DEFAULT_SORT);
    expect(filters.dir).toBe(DEFAULT_DIRECTION);
    expect(filters.sort).toBe("change");
    expect(filters.dir).toBe("asc");
    expect(filters.page).toBe(1);
  });

  it("reads a sort column and direction from the URL", () => {
    const filters = parseProductFilters({ sort: "price", dir: "desc" });

    expect(filters.sort).toBe("price");
    expect(filters.dir).toBe("desc");
  });

  it("accepts a direction without an explicit column", () => {
    const filters = parseProductFilters({ dir: "desc" });

    expect(filters.sort).toBe(DEFAULT_SORT);
    expect(filters.dir).toBe("desc");
  });

  it("falls back safely for unknown values", () => {
    const filters = parseProductFilters({
      sort: "drop table products",
      dir: "sideways",
      page: "abc",
    });

    expect(filters.sort).toBe(DEFAULT_SORT);
    expect(filters.dir).toBe(DEFAULT_DIRECTION);
    expect(filters.page).toBe(1);
  });

  it("still parses the filter set", () => {
    const filters = parseProductFilters({
      q: "g.skill",
      brand: "G.Skill",
      capacity: "32",
      speed: "6000",
      cl: "30",
      modules: "2",
      availability: "in_stock",
      price: "below_start",
      discount: "10",
      sort: "lowest",
      dir: "desc",
      page: "3",
    });

    expect(filters).toMatchObject({
      q: "g.skill",
      brand: "G.Skill",
      capacityGb: "32",
      speedMhz: "6000",
      casLatency: "30",
      moduleCount: "2",
      availability: "in_stock",
      priceStatus: "below_start",
      minDiscount: "10",
      sort: "lowest",
      dir: "desc",
      page: 3,
    });
  });
});

describe("buildProductQuery", () => {
  it("omits defaults", () => {
    expect(buildProductQuery(DEFAULT_FILTERS)).toBe("");
  });

  it("round-trips a non-default sort", () => {
    const filters: ProductFilters = { ...DEFAULT_FILTERS, sort: "price", dir: "desc" };
    const query = buildProductQuery(filters);

    expect(query).toBe("?sort=price&dir=desc");
    expect(parseProductFilters(Object.fromEntries(new URLSearchParams(query.slice(1))))).toMatchObject(
      { sort: "price", dir: "desc" },
    );
  });

  it("keeps a non-default direction on the default column", () => {
    const filters: ProductFilters = { ...DEFAULT_FILTERS, dir: "desc" };

    expect(buildProductQuery(filters)).toBe("?dir=desc");
    expect(parseProductFilters({ dir: "desc" })).toMatchObject({ sort: "change", dir: "desc" });
  });
});

describe("nextSortDirection", () => {
  it("uses the column's natural direction on first click", () => {
    const current = { sort: "change" as const, dir: "asc" as const };

    // Cheapest first, and most recent first.
    expect(nextSortDirection("price", current)).toBe("asc");
    expect(nextSortDirection("updated", current)).toBe("desc");
    // Fastest first.
    expect(nextSortDirection("speed", current)).toBe("desc");
  });

  it("flips the direction when the column already owns the sort", () => {
    expect(nextSortDirection("price", { sort: "price", dir: "asc" })).toBe("desc");
    expect(nextSortDirection("price", { sort: "price", dir: "desc" })).toBe("asc");
  });
});

describe("buildSortHref", () => {
  it("sorts by a new column and resets pagination", () => {
    const filters: ProductFilters = { ...DEFAULT_FILTERS, page: 4 };

    expect(buildSortHref("/", filters, "price")).toBe("/?sort=price");
  });

  it("flips direction on a second click of the same column", () => {
    const first = parseProductFilters({ sort: "price" });

    expect(buildSortHref("/", first, "price")).toBe("/?sort=price&dir=desc");
    expect(buildSortHref("/", { ...first, dir: "desc" }, "price")).toBe("/?sort=price");
  });

  it("preserves active filters while changing the sort", () => {
    const filters = parseProductFilters({ brand: "Kingston", price: "below_start" });

    expect(buildSortHref("/", filters, "lowest")).toBe(
      "/?brand=Kingston&price=below_start&sort=lowest",
    );
  });

  it("drops the page parameter", () => {
    const filters = parseProductFilters({ sort: "price", page: "3" });

    expect(buildSortHref("/", filters, "lowest")).not.toContain("page=");
  });
});

describe("sort presets and labels", () => {
  it("builds a stable composite value", () => {
    expect(sortOptionValue("price", "desc")).toBe("price:desc");
  });

  it("describes a preset ordering by its label", () => {
    expect(describeSort("change", "asc")).toBe("Biggest price drop");
    expect(describeSort("price", "desc")).toBe("Highest current price");
  });

  it("describes a non-preset ordering explicitly", () => {
    expect(describeSort("lowest", "desc")).toBe("Lowest price · descending");
  });
});

describe("filter helpers", () => {
  it("does not count sorting as a filter", () => {
    const sorted: ProductFilters = { ...DEFAULT_FILTERS, sort: "price", dir: "desc" };

    expect(countActiveFilters(sorted)).toBe(0);
    expect(hasActiveFilters(sorted)).toBe(false);
  });

  it("clears filters but preserves the sort order", () => {
    const filters = parseProductFilters({
      q: "g.skill",
      brand: "G.Skill",
      price: "below_start",
      sort: "lowest",
      dir: "desc",
    });

    const cleared = withoutFilters(filters);

    expect(hasActiveFilters(cleared)).toBe(false);
    expect(cleared.sort).toBe("lowest");
    expect(cleared.dir).toBe("desc");
    expect(buildProductHref("/", cleared)).toBe("/?sort=lowest&dir=desc");
  });
});
