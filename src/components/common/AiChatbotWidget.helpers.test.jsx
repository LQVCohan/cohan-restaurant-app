import { describe, expect, it } from "vitest";
import { buildMenuSourceCards, buildStarterMessages, extractRestaurantId, getInputPlaceholder } from "./AiChatbotWidget";

describe("AiChatbotWidget helpers", () => {
  it("extractRestaurantId from /restaurant/:id", () => {
    expect(extractRestaurantId({ params: { id: "abc" }, pathname: "/restaurant/abc" })).toBe("abc");
  });
  it("restaurant context starter includes Gợi ý món cho 2 người", () => {
    expect(buildStarterMessages({ restaurantId: "r1", publicSettings: null })).toContain("Gợi ý món cho 2 người");
  });
  it("global starter remains general", () => {
    expect(buildStarterMessages({ restaurantId: null, publicSettings: null }).length).toBeGreaterThan(0);
  });
  it("menu source cards only include unique menuItem sources with limit", () => {
    const cards = buildMenuSourceCards({
      intent: "menu",
      sources: [
        { type: "menuItem", id: "1", label: "A" },
        { type: "menuItem", id: "1", label: "A duplicate" },
        { type: "coupon", id: "2", label: "B" },
        { type: "menuItem", id: "3", label: "C" },
        { type: "menuItem", id: "4", label: "D" },
        { type: "menuItem", id: "5", label: "E" },
      ],
    });
    expect(cards).toHaveLength(4);
    expect(cards.map((x) => x.id)).toEqual(["1", "3", "4", "5"]);
  });
  it("non-menu intent returns []", () => {
    expect(buildMenuSourceCards({ intent: "order", sources: [{ type: "menuItem", id: "1" }] })).toEqual([]);
  });
  it("placeholder changes when restaurantId exists", () => {
    expect(getInputPlaceholder("r1")).toMatch(/combo/);
    expect(getInputPlaceholder(null)).toMatch(/đặt bàn/);
  });
});
