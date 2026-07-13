import { describe, expect, it } from "vitest";
import { formatChartDate } from "./RevenueChart";

describe("RevenueChart Vietnamese labels", () => {
  it("formats ISO dates using the Vietnamese day-month-year order", () => {
    expect(formatChartDate("2026-07-14")).toBe("14/07/2026");
  });

  it("keeps an unknown chart label readable", () => {
    expect(formatChartDate("Tuần 1")).toBe("Tuần 1");
  });
});
