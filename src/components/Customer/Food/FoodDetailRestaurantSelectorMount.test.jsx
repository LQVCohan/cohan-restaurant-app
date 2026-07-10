import { describe, expect, it } from "vitest";
import { getPreferredRestaurantLocation } from "./FoodDetailRestaurantSelectorMount";

const closedLocation = {
  menuItemId: "dish-a",
  restaurantId: "restaurant-a",
  isAvailable: false,
  maxAvailable: 0,
  inventoryStatus: "OUT_OF_STOCK",
  restaurant: { canOrder: false },
};

const stockedLocation = {
  menuItemId: "dish-b",
  restaurantId: "restaurant-b",
  isAvailable: true,
  maxAvailable: 20,
  inventoryStatus: "IN_STOCK",
  restaurant: { canOrder: true },
};

describe("food detail restaurant selection", () => {
  it("switches from an unavailable location to an open restaurant with stock", () => {
    expect(
      getPreferredRestaurantLocation(
        [closedLocation, stockedLocation],
        closedLocation.menuItemId,
      ),
    ).toBe(stockedLocation);
  });

  it("keeps the current restaurant when it is already orderable", () => {
    expect(
      getPreferredRestaurantLocation(
        [stockedLocation, closedLocation],
        stockedLocation.menuItemId,
      ),
    ).toBe(stockedLocation);
  });
});
