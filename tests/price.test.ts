import { describe, expect, it } from "vitest";

import {
  computePriceChangePercent,
  directionFromChange,
  directionFromPercent,
  roundTo,
} from "@/lib/price";

describe("computePriceChangePercent", () => {
  it("computes a decrease against the starting price", () => {
    expect(roundTo(computePriceChangePercent(139.9, 159.9)!, 1)).toBe(-12.5);
    expect(roundTo(computePriceChangePercent(119.9, 139.9)!, 1)).toBe(-14.3);
  });

  it("computes an increase", () => {
    expect(roundTo(computePriceChangePercent(189.9, 159.9)!, 1)).toBe(18.8);
  });

  it("returns 0 when the price is unchanged", () => {
    expect(computePriceChangePercent(159.9, 159.9)).toBe(0);
  });

  it("returns null when it cannot be computed safely", () => {
    expect(computePriceChangePercent(null, 100)).toBeNull();
    expect(computePriceChangePercent(100, null)).toBeNull();
    expect(computePriceChangePercent(100, 0)).toBeNull();
    expect(computePriceChangePercent(undefined, undefined)).toBeNull();
  });
});

describe("direction helpers", () => {
  it("derives a direction from an absolute change", () => {
    expect(directionFromChange(-20)).toBe("down");
    expect(directionFromChange(5)).toBe("up");
    expect(directionFromChange(0)).toBe("same");
    expect(directionFromChange(null)).toBe("same");
  });

  it("derives a direction from a percentage", () => {
    expect(directionFromPercent(-14.3)).toBe("down");
    expect(directionFromPercent(2)).toBe("up");
    expect(directionFromPercent(0)).toBe("same");
    expect(directionFromPercent(null)).toBe("same");
  });
});

describe("roundTo", () => {
  it("rounds to the requested number of decimals", () => {
    expect(roundTo(-12.50781, 2)).toBe(-12.51);
    expect(roundTo(1.006, 2)).toBe(1.01);
    expect(roundTo(42, 0)).toBe(42);
  });
});
