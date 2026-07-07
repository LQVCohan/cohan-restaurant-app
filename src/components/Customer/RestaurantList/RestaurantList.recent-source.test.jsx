import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync("src/components/Customer/RestaurantList/RestaurantList.jsx", "utf8");
const detail = fs.readFileSync("src/components/Customer/RestaurantDetail/RestaurantDetail.jsx", "utf8");

describe("customer recent restaurants frontend contract", () => {
  it("RestaurantList reads myRecentRestaurants instead of deriving recent history from orders/reservations", () => {
    expect(source).toContain("GET_RECENT_RESTAURANTS");
    expect(source).not.toMatch(new RegExp(["GET", "REF", "RESTAURANTS"].join("_")));
    expect(source).toContain("myRecentRestaurants(limit: $limit)");
    expect(source).not.toContain("ordersByUser(userId");
    expect(source).not.toContain("myReservations(limit");
  });

  it("RestaurantList uses customer wording and does not pass an undefined recent prop", () => {
    expect(source).toContain("Đã xem gần đây");
    expect(source).toContain("Quay lại nhà hàng bạn vừa xem");
    expect(source).toContain("Mở lại nhanh mà không cần tìm kiếm lại.");
    expect(source).not.toContain("isRecent={restaurant.isRecentRestaurant}");
  });

  it("RestaurantDetail records a recent restaurant once per restaurant id without blocking render", () => {
    expect(detail).toContain("recordRecentRestaurant(restaurantId: $restaurantId)");
    expect(detail).toContain("recordedRestaurantIdRef.current === loadedRestaurantId");
    expect(detail).toContain("recordingRestaurantIdRef.current === loadedRestaurantId");
    expect(detail).toContain("restaurantData?.publicRestaurant?.id");
    expect(detail).toContain("Không thể ghi nhận nhà hàng đã xem gần đây.");
  });
});
