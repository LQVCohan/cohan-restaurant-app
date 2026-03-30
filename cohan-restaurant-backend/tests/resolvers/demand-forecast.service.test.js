import { computeDemandForecastFromData } from "../../src/services/ai/demandForecast.service.js";

describe("demand forecast service", () => {
  it("returns deterministic forecast blocks for hourly, rising dishes and prep plan", () => {
    const now = new Date("2026-03-28T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const orders = [
      {
        createdAt: "2026-03-27T11:15:00.000Z",
        currentStatus: "completed",
        guestCount: 4,
        items: [{ dishId: "dish-a", name: "Lẩu hải sản", quantity: 4, status: "served" }],
      },
      {
        createdAt: "2026-03-26T11:40:00.000Z",
        currentStatus: "completed",
        guestCount: 3,
        items: [{ dishId: "dish-a", name: "Lẩu hải sản", quantity: 3, status: "served" }],
      },
      {
        createdAt: "2026-03-25T18:10:00.000Z",
        currentStatus: "completed",
        guestCount: 5,
        items: [{ dishId: "dish-b", name: "Trà đào", quantity: 6, status: "served" }],
      },
      {
        createdAt: "2026-03-11T18:10:00.000Z",
        currentStatus: "completed",
        guestCount: 2,
        items: [{ dishId: "dish-b", name: "Trà đào", quantity: 2, status: "served" }],
      },
    ];

    const reservations = [
      {
        timeTo: "2026-03-29T11:00:00.000Z",
        partySize: 8,
        status: "confirmed",
      },
    ];

    const recipes = [
      {
        menuItemId: "dish-a",
        servingVariants: [
          {
            isDefault: true,
            ingredients: [{ ingredientId: "ing-a", qty: 1, unit: "portion" }],
          },
        ],
      },
    ];

    const stockItems = [
      { ingredientId: "ing-a", onHand: 100, reserved: 10 },
    ];

    const forecast = computeDemandForecastFromData({
      orders,
      reservations,
      recipes,
      stockItems,
      horizonDays: 2,
      timezone: "UTC",
    });

    expect(forecast.summary).toBeTruthy();
    expect(Array.isArray(forecast.hourlyForecast)).toBe(true);
    expect(forecast.hourlyForecast.length).toBeGreaterThan(0);
    expect(forecast.summary.busiestPeriods.length).toBeGreaterThan(0);

    expect(Array.isArray(forecast.risingDishes)).toBe(true);
    expect(forecast.risingDishes[0]).toHaveProperty("dishName");
    expect(forecast.risingDishes[0]).toHaveProperty("upliftPct");

    expect(Array.isArray(forecast.prepPlan)).toBe(true);
    expect(forecast.prepPlan.length).toBeGreaterThan(0);
    expect(forecast.meta.method).toBe("time_series_v1");

    vi.useRealTimers();
  });

  it("keeps fallback signal when data is sparse", () => {
    const forecast = computeDemandForecastFromData({
      orders: [],
      reservations: [],
      recipes: [],
      stockItems: [],
      horizonDays: 1,
      timezone: "UTC",
    });

    expect(forecast.meta.fallbackUsed).toBe(true);
    expect(forecast.hourlyForecast.length).toBeGreaterThan(0);
    expect(forecast.summary.notes.length).toBeGreaterThan(0);
  });
});
