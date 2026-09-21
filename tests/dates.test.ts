import { describe, expect, it } from "vitest";

import { daysBetween, getTallinnDate, isIsoDate } from "@/lib/dates";

describe("getTallinnDate", () => {
  it("uses Tallinn summer time (UTC+3) at the end of the day", () => {
    expect(getTallinnDate(new Date("2026-09-21T20:59:00Z"))).toBe("2026-09-21");
  });

  it("rolls over to the next day once Tallinn passes midnight", () => {
    expect(getTallinnDate(new Date("2026-09-21T21:00:00Z"))).toBe("2026-09-22");
    expect(getTallinnDate(new Date("2026-09-21T23:30:00Z"))).toBe("2026-09-22");
  });

  it("uses Tallinn winter time (UTC+2)", () => {
    expect(getTallinnDate(new Date("2026-01-15T21:30:00Z"))).toBe("2026-01-15");
    expect(getTallinnDate(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-16");
  });

  it("is not affected by the UTC date boundary", () => {
    const justBeforeUtcMidnight = new Date("2026-03-31T23:59:00Z");
    // 23:59 UTC is already 02:59 on the 1st in Tallinn.
    expect(getTallinnDate(justBeforeUtcMidnight)).toBe("2026-04-01");
  });

  it("always returns an ISO date string", () => {
    expect(isIsoDate(getTallinnDate())).toBe(true);
  });
});

describe("daysBetween", () => {
  it("counts whole days between ISO dates", () => {
    expect(daysBetween("2026-09-19", "2026-09-21")).toBe(2);
    expect(daysBetween("2026-09-21", "2026-09-21")).toBe(0);
    expect(daysBetween("2026-09-21", "2026-09-19")).toBe(-2);
  });

  it("returns 0 for unparseable input", () => {
    expect(daysBetween("nonsense", "2026-09-21")).toBe(0);
  });
});
