import { describe, expect, it } from "vitest";
import { resolveBookingCartContext } from "./Cart";

describe("Cart booking addon context", () => {
  it("uses booking context from the food-detail URL", () => {
    expect(
      resolveBookingCartContext({
        search: "?restaurantId=restaurant-1&returnTo=booking",
      }),
    ).toEqual({
      bookingAddonMode: true,
      bookingRestaurantId: "restaurant-1",
    });
  });

  it("keeps explicit caller props as the source of truth", () => {
    expect(
      resolveBookingCartContext({
        search: "?restaurantId=restaurant-from-url",
        bookingAddonMode: true,
        bookingRestaurantId: "restaurant-from-props",
      }),
    ).toEqual({
      bookingAddonMode: true,
      bookingRestaurantId: "restaurant-from-props",
    });
  });

  it("does not turn a normal food cart into a booking cart", () => {
    expect(
      resolveBookingCartContext({
        search: "?restaurantId=restaurant-1",
      }),
    ).toEqual({
      bookingAddonMode: false,
      bookingRestaurantId: "restaurant-1",
    });
  });
});
