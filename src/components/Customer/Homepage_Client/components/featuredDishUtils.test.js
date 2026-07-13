import { describe, expect, it } from "vitest";
import {
  buildFeaturedMenuPath,
  buildRestaurantNameMap,
  getFeaturedDishCandidateLimit,
  normalizeFeaturedDishName,
  resolveFeaturedDishRating,
  selectFeaturedDishes,
} from "./featuredDishUtils";

const makeDish = (overrides = {}) => ({
  id: overrides.id || "dish-1",
  restaurantId: overrides.restaurantId || "restaurant-1",
  name: overrides.name || "Bún thịt nướng",
  basePrice: overrides.basePrice ?? 62000,
  status: overrides.status || "available",
  inventoryStatus: overrides.inventoryStatus || "IN_STOCK",
  servingVariants: overrides.servingVariants || [],
  rate: overrides.rate,
  point: overrides.point,
  ...overrides,
});

describe("featured dish selection", () => {
  it("keeps only orderable dishes with a sellable price", () => {
    const result = selectFeaturedDishes(
      [
        makeDish({ id: "available" }),
        makeDish({ id: "out", name: "Cơm gà", inventoryStatus: "OUT_OF_STOCK" }),
        makeDish({ id: "error", name: "Phở bò", inventoryStatus: "ERROR" }),
        makeDish({ id: "hidden", name: "Bánh mì", status: "hidden" }),
        makeDish({ id: "no-price", name: "Món chưa có giá", basePrice: 0 }),
      ],
      { limit: 8 },
    );

    expect(result.map((dish) => dish.id)).toEqual(["available"]);
  });

  it("removes repeated dish names and attaches the real restaurant name", () => {
    const restaurantNameById = buildRestaurantNameMap({
      edges: [
        { node: { id: "restaurant-1", name: "Nhà hàng Việt" } },
        { node: { id: "restaurant-2", name: "Bếp Cohan" } },
      ],
    });

    const result = selectFeaturedDishes(
      [
        makeDish({ id: "bun-1", restaurantId: "restaurant-1", name: "Bún thịt nướng" }),
        makeDish({ id: "bun-2", restaurantId: "restaurant-2", name: "bun thit nuong" }),
        makeDish({ id: "com", restaurantId: "restaurant-2", name: "Cơm gà" }),
      ],
      { limit: 8, restaurantNameById },
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "bun-1",
      restaurantName: "Nhà hàng Việt",
    });
    expect(result[1]).toMatchObject({
      id: "com",
      restaurantName: "Bếp Cohan",
    });
  });

  it("balances the first pass across restaurants", () => {
    const result = selectFeaturedDishes(
      [
        makeDish({ id: "a1", name: "Món A1", restaurantId: "restaurant-a" }),
        makeDish({ id: "a2", name: "Món A2", restaurantId: "restaurant-a" }),
        makeDish({ id: "a3", name: "Món A3", restaurantId: "restaurant-a" }),
        makeDish({ id: "b1", name: "Món B1", restaurantId: "restaurant-b" }),
      ],
      { limit: 3, maxPerRestaurant: 2 },
    );

    expect(result.map((dish) => dish.id)).toEqual(["a1", "a2", "b1"]);
  });
});

describe("featured dish metadata and navigation", () => {
  it("normalizes Vietnamese dish names for duplicate detection", () => {
    expect(normalizeFeaturedDishName("  Bún Thịt Nướng  ")).toBe("bun thit nuong");
  });

  it("never invents a rating when the backend has none", () => {
    expect(resolveFeaturedDishRating({ rate: 4.6, point: 5 })).toBe(4.6);
    expect(resolveFeaturedDishRating({ rate: 0, point: 4 })).toBe(4);
    expect(resolveFeaturedDishRating({ rate: null, point: null })).toBeNull();
  });

  it("builds the all-dishes route with a valid time slot", () => {
    expect(buildFeaturedMenuPath("lunch")).toBe("/cus-menu?timeSlot=lunch");
    expect(buildFeaturedMenuPath("invalid")).toBe("/cus-menu");
    expect(getFeaturedDishCandidateLimit(8)).toBe(32);
    expect(getFeaturedDishCandidateLimit(12)).toBe(48);
  });
});
