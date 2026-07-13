import { describe, expect, it } from "vitest";
import {
  dedupeRestaurantLocations,
  getPreferredRestaurantLocation,
} from "./FoodDetailRestaurantSelectorMount";

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

const duplicatedLocation = ({
  menuItemId,
  restaurantId,
  name = "Nhà hàng Việt",
  line1 = "Cầu cạn Đường vành đai 3",
  city = "Thành phố Dĩ An",
}) => ({
  menuItemId,
  restaurantId,
  isAvailable: false,
  maxAvailable: 0,
  restaurant: {
    id: restaurantId,
    name,
    canOrder: true,
    address: { line1, city },
  },
});

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

  it("shows one card for duplicated restaurant name and address", () => {
    const result = dedupeRestaurantLocations([
      duplicatedLocation({ menuItemId: "food-1", restaurantId: "restaurant-1" }),
      duplicatedLocation({ menuItemId: "food-2", restaurantId: "restaurant-2" }),
      duplicatedLocation({ menuItemId: "food-3", restaurantId: "restaurant-3" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].menuItemId).toBe("food-1");
  });

  it("keeps the currently viewed item when duplicate records exist", () => {
    const result = dedupeRestaurantLocations(
      [
        duplicatedLocation({ menuItemId: "food-1", restaurantId: "restaurant-1" }),
        duplicatedLocation({ menuItemId: "food-current", restaurantId: "restaurant-2" }),
      ],
      "food-current",
    );

    expect(result).toHaveLength(1);
    expect(result[0].menuItemId).toBe("food-current");
  });

  it("keeps branches with different addresses", () => {
    const result = dedupeRestaurantLocations([
      duplicatedLocation({ menuItemId: "food-1", restaurantId: "restaurant-1" }),
      duplicatedLocation({
        menuItemId: "food-2",
        restaurantId: "restaurant-2",
        line1: "12 Nguyễn Huệ",
        city: "Thành phố Hồ Chí Minh",
      }),
    ]);

    expect(result).toHaveLength(2);
  });
});
