import { describe, expect, it } from "vitest";
import { buildReservationFoodPricingSnapshot } from "../../src/services/customerPromotionPricing.service.js";

describe("customer promotion pricing", () => {
  it("calculates the reservation food deposit from the payable total after promotion", () => {
    const snapshot = buildReservationFoodPricingSnapshot({
      subtotal: 100000,
      promotionDiscount: 20000,
      grandTotal: 80000,
      appliedPromotions: ["promo-1"],
    });

    expect(snapshot).toEqual({
      subtotal: 100000,
      promotionDiscount: 20000,
      total: 80000,
      promotionIds: ["promo-1"],
      deposit: 40000,
    });
  });

  it("deduplicates promotion ids and clamps invalid values", () => {
    const snapshot = buildReservationFoodPricingSnapshot(
      {
        subtotal: 50000,
        promotionDiscount: 90000,
        finalTotal: -10,
        appliedPromotions: ["promo-1", "promo-1", null],
      },
      120,
    );

    expect(snapshot.subtotal).toBe(50000);
    expect(snapshot.promotionDiscount).toBe(50000);
    expect(snapshot.total).toBe(0);
    expect(snapshot.deposit).toBe(0);
    expect(snapshot.promotionIds).toEqual(["promo-1"]);
  });

  it("supports a configured food deposit percentage", () => {
    const snapshot = buildReservationFoodPricingSnapshot(
      { subtotal: 60000, grandTotal: 60000 },
      25,
    );

    expect(snapshot.deposit).toBe(15000);
  });
});
