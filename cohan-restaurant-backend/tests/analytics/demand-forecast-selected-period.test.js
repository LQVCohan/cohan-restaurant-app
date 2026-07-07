import { describe, expect, it, vi } from "vitest";
import { computeDemandForecastFromData } from "../../src/services/ai/demandForecast.service.js";

describe("demand forecast selected period", () => {
  it("starts forecast rows from the requested business date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));

    const forecast = computeDemandForecastFromData({
      orders: [],
      reservations: [],
      recipes: [],
      stockItems: [],
      horizonDays: 2,
      timezone: "Asia/Ho_Chi_Minh",
      forecastStart: "2026-04-06T00:00:00+07:00",
    });

    expect(forecast.dailyForecast.map((row) => row.date)).toEqual([
      "2026-04-06",
      "2026-04-07",
    ]);
    expect(new Set(forecast.hourlyForecast.map((row) => row.date))).toEqual(
      new Set(["2026-04-06", "2026-04-07"]),
    );
    expect(forecast.summary.notes).toContain("Ngày tham chiếu: 2026-04-06");

    vi.useRealTimers();
  });

  it("keeps current-date behavior when no anchor is supplied", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));

    const forecast = computeDemandForecastFromData({
      orders: [],
      reservations: [],
      recipes: [],
      stockItems: [],
      horizonDays: 1,
      timezone: "UTC",
    });

    expect(forecast.dailyForecast[0].date).toBe("2026-03-28");

    vi.useRealTimers();
  });
});
