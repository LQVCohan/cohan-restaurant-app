import { describe, expect, it, vi } from "vitest";
import { computeDemandForecastFromData } from "../../src/services/ai/demandForecast.service.js";

const order = (qty = 2, date = "2026-03-27T11:15:00.000Z") => ({
  createdAt: date,
  currentStatus: "completed",
  guestCount: 3,
  items: [{ dishId: "dish-a", name: "Lẩu", quantity: qty, status: "served" }],
});

describe("analytics demand forecast", () => {
  it("creates deterministic hourly/daily/risingDishes/prepPlan and does not mark AI fallback when data is enough", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));
    const orders = Array.from({ length: 24 }, (_, i) => order(2 + (i % 3), `2026-03-${String(1 + i).padStart(2, "0")}T11:00:00.000Z`));
    const forecast = computeDemandForecastFromData({ orders, reservations: [], recipes: [], stockItems: [], horizonDays: 2, timezone: "UTC" });
    expect(forecast.hourlyForecast.length).toBeGreaterThan(0);
    expect(forecast.dailyForecast.length).toBe(2);
    expect(forecast.risingDishes.length).toBeGreaterThan(0);
    expect(forecast.prepPlan.length).toBeGreaterThan(0);
    expect(forecast.meta.fallbackUsed).toBe(false);
    expect(forecast.meta.aiEnhanced).toBe(false);
    vi.useRealTimers();
  });

  it("marks low data fallback and computes stock risk levels", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T10:00:00.000Z"));
    const base = { orders: [order(10)], reservations: [], horizonDays: 1, timezone: "UTC" };
    const recipe = { menuItemId: "dish-a", servingVariants: [{ isDefault: true, ingredients: [{ ingredientId: "ing", qty: 1, unit: "portion" }] }] };
    expect(computeDemandForecastFromData({ ...base, recipes: [recipe], stockItems: [{ ingredientId: "ing", onHand: 1, reserved: 0 }] }).risingDishes[0].stockRisk).toBe("high");
    expect(computeDemandForecastFromData({ ...base, recipes: [recipe], stockItems: [{ ingredientId: "ing", onHand: 8, reserved: 0 }] }).risingDishes[0].stockRisk).toMatch(/medium|low/);
    const sparse = computeDemandForecastFromData({ orders: [], reservations: [], recipes: [], stockItems: [], horizonDays: 1, timezone: "UTC" });
    expect(sparse.meta.fallbackUsed).toBe(true);
    expect(sparse.meta.lowDataFallbackUsed).toBe(true);
    vi.useRealTimers();
  });
});
