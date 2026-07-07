import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync("src/components/Customer/RestaurantList/RestaurantList.jsx", "utf8");
const detail = fs.readFileSync("src/components/Customer/RestaurantDetail/RestaurantDetail.jsx", "utf8");

describe("customer recent restaurants frontend contract", () => {
  it("RestaurantList reads myRecentRestaurants instead of deriving recent history from orders/reservations", () => {
    expect(source).toContain("myRecentRestaurants(limit: $limit)");
    expect(source).not.toContain("ordersByUser(userId");
    expect(source).not.toContain("myReservations(limit");
  });

  it("RestaurantDetail records a recent restaurant once per restaurant id without blocking render", () => {
    expect(detail).toContain("recordRecentRestaurant(restaurantId: $restaurantId)");
    expect(detail).toContain("recordedRestaurantIdRef.current === id");
    expect(detail).toContain(".catch(() => {})");
  });
});
