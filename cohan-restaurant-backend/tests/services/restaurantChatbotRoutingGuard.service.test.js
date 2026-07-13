import { describe, expect, it } from "vitest";
import { __testables } from "../../src/services/ai/restaurantChatbotRoutingGuard.service.js";

const {
  isStrongMenuRecommendationQuestion,
  isRestaurantOrderAvailabilityQuestion,
  buildRestaurantAvailabilityAnswer,
} = __testables;

describe("restaurantChatbotRoutingGuard", () => {
  it("routes football-watching food requests to menu recommendations", () => {
    expect(
      isStrongMenuRecommendationQuestion("đang xem đá banh thì có món nào oke"),
    ).toBe(true);
    expect(
      isRestaurantOrderAvailabilityQuestion("đang xem đá banh thì có món nào oke"),
    ).toBe(false);
  });

  it("routes restaurant order availability separately from personal order lookup", () => {
    expect(
      isRestaurantOrderAvailabilityQuestion("nhà hàng nào đang nhận order món"),
    ).toBe(true);
    expect(
      isRestaurantOrderAvailabilityQuestion("đơn hàng của tôi đang ở đâu"),
    ).toBe(false);
  });

  it("builds a deterministic list of restaurants that can accept orders now", () => {
    const answer = buildRestaurantAvailabilityAnswer({
      rows: [
        {
          name: "Nhà hàng Việt",
          address: { city: "Dĩ An" },
          availability: { canOrder: true, openingStatus: "open" },
        },
      ],
    });

    expect(answer).toContain("Các nhà hàng đang nhận đơn lúc này");
    expect(answer).toContain("Nhà hàng Việt");
    expect(answer).not.toContain("đơn hàng phù hợp trong dữ liệu của bạn");
  });
});
