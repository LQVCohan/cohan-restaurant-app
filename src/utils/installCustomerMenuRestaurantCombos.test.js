import { describe, expect, it } from "vitest";
import {
  filterRestaurantOffers,
  isBundleRestaurantOffer,
  summarizeRestaurantOffers,
} from "./installCustomerMenuRestaurantCombos";

describe("customer menu restaurant offers", () => {
  const offers = [
    {
      id: "combo-1",
      sourceType: "COMBO",
      restaurantId: "restaurant-a",
    },
    {
      id: "promotion-1",
      sourceType: "PROMOTION",
      restaurantId: "restaurant-a",
    },
    {
      id: "promotion-2",
      sourceType: "PROMOTION",
      restaurantId: "restaurant-b",
    },
  ];

  it("keeps both real combos and payment promotions for the selected restaurant", () => {
    expect(
      filterRestaurantOffers(offers, "restaurant-a").map((offer) => offer.id),
    ).toEqual(["combo-1", "promotion-1"]);
  });

  it("does not treat a payment promotion as an add-to-cart combo", () => {
    expect(isBundleRestaurantOffer(offers[0])).toBe(true);
    expect(isBundleRestaurantOffer(offers[1])).toBe(false);
  });

  it("reports combo and promotion counts separately", () => {
    expect(summarizeRestaurantOffers(offers)).toEqual({
      comboCount: 1,
      promotionCount: 2,
      total: 3,
    });
  });
});
