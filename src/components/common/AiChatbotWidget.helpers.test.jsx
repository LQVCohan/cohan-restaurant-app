import { describe, expect, it } from "vitest";
import {
  buildMenuSourceCards,
  buildStarterMessages,
  extractRestaurantId,
  getInputPlaceholder,
} from "./AiChatbotWidget";

describe("AiChatbotWidget helpers", () => {
  it("extractRestaurantId from /restaurant/:id", () => {
    expect(extractRestaurantId({ params: { id: "abc" }, pathname: "/restaurant/abc" })).toBe("abc");
  });

  it("starter messages", () => {
    expect(buildStarterMessages({ restaurantId: "r1", publicSettings: null })).toContain("Gợi ý món cho 2 người");
    expect(buildStarterMessages({ restaurantId: null, publicSettings: null }).length).toBeGreaterThan(0);
  });

  it("buildMenuSourceCards unique + preserves metadata", () => {
    const cards = buildMenuSourceCards({
      intent: "menu",
      sources: [
        { type: "menuItem", id: "food-1", label: "Phở", formattedPrice: "90.000đ", status: "available", basePrice: 80000, currentPrice: 90000 },
        { type: "menuItem", id: "food-1", label: "dup" },
        { type: "menuItem", id: "food-2", label: "Bún" },
      ],
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ formattedPrice: "90.000đ", status: "available", basePrice: 80000, currentPrice: 90000 });
  });

  it("placeholder changes", () => {
    expect(getInputPlaceholder("r1")).toMatch(/combo/);
    expect(getInputPlaceholder(null)).toMatch(/đặt bàn/);
  });
});
