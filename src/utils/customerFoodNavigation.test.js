import { describe, expect, it } from "vitest";
import {
  buildFoodDetailPath,
  buildFoodDetailState,
  resolveMenuTimeSlotAt,
} from "./customerFoodNavigation";

describe("booking food navigation", () => {
  it("keeps service time, menu and booking return context in URL and route state", () => {
    const serviceAt = "2026-07-11T01:00:00.000Z";
    const options = {
      restaurantId: "restaurant-1",
      timeSlot: "breakfast",
      menuId: "menu-vip",
      serviceAt,
    };

    const path = buildFoodDetailPath("food-1", options);
    expect(path).toContain("menuId=menu-vip");
    expect(path).toContain("serviceAt=2026-07-11T01%3A00%3A00.000Z");
    expect(path).toContain("returnTo=booking");
    expect(buildFoodDetailState({ id: "food-1" }, options)).toMatchObject({
      restaurantId: "restaurant-1",
      timeSlot: "breakfast",
      menuId: "menu-vip",
      serviceAt,
      returnTo: "booking",
    });
  });

  it("uses the dish menu when callers omit an explicit menuId", () => {
    expect(
      buildFoodDetailState({ id: "food-1", menuId: "menu-casual" }, {}),
    ).toMatchObject({ menuId: "menu-casual" });
  });

  it("keeps an explicit non-booking return target", () => {
    const options = {
      restaurantId: "restaurant-1",
      serviceAt: "2026-07-11T01:00:00.000Z",
      returnTo: "favorites",
    };

    expect(buildFoodDetailPath("food-1", options)).toContain(
      "returnTo=favorites",
    );
    expect(buildFoodDetailState(null, options).returnTo).toBe("favorites");
  });

  it.each([
    ["2026-07-11T08:00:00+07:00", "breakfast"],
    ["2026-07-11T10:00:00+07:00", "lunch"],
    ["2026-07-11T15:00:00+07:00", "dinner"],
    ["2026-07-11T22:00:00+07:00", "late_night"],
  ])("maps booking time %s to %s", (value, expected) => {
    expect(resolveMenuTimeSlotAt(value)).toBe(expected);
  });
});
