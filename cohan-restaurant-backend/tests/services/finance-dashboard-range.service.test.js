import { describe, expect, it } from "vitest";
import {
  normalizeFinanceDashboardResult,
  prepareFinanceDashboardRequest,
} from "../../src/services/finance/financeDashboardRange.service.js";

describe("finance dashboard range service", () => {
  it("uses Monday through Sunday for a weekly dashboard", () => {
    const request = prepareFinanceDashboardRequest(
      { restaurantId: "restaurant-1", range: "WEEK" },
      new Date("2026-07-10T10:00:00+07:00"),
    );

    expect(request.input).toEqual(
      expect.objectContaining({
        range: "CUSTOM",
        dateFrom: "2026-07-06",
        dateTo: "2026-07-12",
      }),
    );
  });

  it("rejects incomplete and reversed custom ranges", () => {
    expect(() =>
      prepareFinanceDashboardRequest({ range: "CUSTOM", dateFrom: "2026-07-10" }),
    ).toThrow("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");

    expect(() =>
      prepareFinanceDashboardRequest({
        range: "CUSTOM",
        dateFrom: "2026-07-11",
        dateTo: "2026-07-10",
      }),
    ).toThrow("Ngày bắt đầu không được sau ngày kết thúc.");
  });

  it("aggregates a quarter into three monthly trend points", () => {
    const request = prepareFinanceDashboardRequest(
      { restaurantId: "restaurant-1", range: "QUARTER" },
      new Date("2026-07-10T10:00:00+07:00"),
    );
    const result = normalizeFinanceDashboardResult(
      {
        summary: { revenue: 300, expense: 80 },
        trend: [
          { key: "03/07", revenue: 100, expense: 20, profit: 80 },
          { key: "08/08", revenue: 120, expense: 30, profit: 90 },
          { key: "15/09", revenue: 80, expense: 30, profit: 50 },
        ],
      },
      request,
    );

    expect(request.input).toEqual(
      expect.objectContaining({
        range: "CUSTOM",
        dateFrom: "2026-07-01",
        dateTo: "2026-09-30",
      }),
    );
    expect(result.trend).toEqual([
      { key: "07/2026", revenue: 100, expense: 20, profit: 80 },
      { key: "08/2026", revenue: 120, expense: 30, profit: 90 },
      { key: "09/2026", revenue: 80, expense: 30, profit: 50 },
    ]);
  });
});
