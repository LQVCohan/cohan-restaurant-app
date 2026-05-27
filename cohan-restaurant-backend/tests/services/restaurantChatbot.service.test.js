import { describe, expect, it } from "vitest";
import { __testables } from "../../src/services/ai/restaurantChatbot.service.js";

const {
  extractMenuPreferences,
  isMenuAssistantRequest,
  parseBudgetMax,
  maybeCategoryName,
  serializeMenuItem,
  rankMenuRecommendations,
  menuFallback,
  fallbackActions,
  fallbackAnswer,
  fallbackSources,
} = __testables;

describe("restaurantChatbot menu assistant", () => {
  it("isMenuAssistantRequest false for reservation/order", () => {
    expect(isMenuAssistantRequest("tôi muốn đặt bàn", "reservation", extractMenuPreferences("tôi muốn đặt bàn"))).toBe(false);
    expect(isMenuAssistantRequest("kiểm tra đơn hàng ABCD", "order", extractMenuPreferences("kiểm tra đơn hàng ABCD"))).toBe(false);
  });

  it("isMenuAssistantRequest true for menu recommendation", () => {
    expect(isMenuAssistantRequest("gợi ý món cho 2 người dưới 100k", "menu", extractMenuPreferences("gợi ý món cho 2 người dưới 100k"))).toBe(true);
    expect(isMenuAssistantRequest("có món chay không", "menu", extractMenuPreferences("có món chay không"))).toBe(true);
  });

  it("parseBudgetMax formats", () => {
    expect(parseBudgetMax("dưới 100k")).toBe(100000);
    expect(parseBudgetMax("dưới 100 nghìn")).toBe(100000);
    expect(parseBudgetMax("dưới 100.000đ")).toBe(100000);
    expect(parseBudgetMax("under 200k")).toBe(200000);
    expect(parseBudgetMax("tầm 150k")).toBe(150000);
    expect(parseBudgetMax("khoảng 80,000đ")).toBe(80000);
    expect(parseBudgetMax("giá 100k")).toBeNull();
  });

  it("category serialization safe", () => {
    expect(maybeCategoryName({ category: { name: "Món chính" } })).toBe("Món chính");
    expect(maybeCategoryName({ category: "Đồ uống" })).toBe("Đồ uống");
    const value = maybeCategoryName({ category: { _id: "507f1f77bcf86cd799439011" } });
    expect(value === null || typeof value === "string").toBe(true);
    const serialized = serializeMenuItem({ id: "1", name: "A", category: { _id: "507f1f77bcf86cd799439011" } });
    expect(typeof serialized.category === "string" || serialized.category === null).toBe(true);
    expect(typeof serialized.categoryName === "string" || serialized.categoryName === null).toBe(true);
  });

  it("best seller ranking", () => {
    const ranked = rankMenuRecommendations([
      { id: "a", name: "A", status: "available", isAvailable: true, orderCounter: 500, rate: 4.8 },
      { id: "b", name: "B", status: "available", isAvailable: true, orderCounter: 20, rate: 4.1 },
    ], { intentSubtype: ["bestSeller"] }, 2);
    expect(ranked[0].id).toBe("a");
  });

  it("quick prep ranking", () => {
    const ranked = rankMenuRecommendations([
      { id: "slow", name: "Bò hầm", status: "available", isAvailable: true, avgPrepTimeMin: 30 },
      { id: "fast", name: "Salad", status: "available", isAvailable: true, avgPrepTimeMin: 8 },
    ], { intentSubtype: ["quickPrep"] }, 2);
    expect(ranked[0].id).toBe("fast");
  });

  it("no seafood preference", () => {
    const ranked = rankMenuRecommendations([
      { id: "sea", name: "Mì hải sản", description: "seafood", status: "available", isAvailable: true },
      { id: "non", name: "Cơm gà", description: "chicken", status: "available", isAvailable: true },
    ], { dietary: ["noSeafood"], intentSubtype: ["recommend"] }, 2);
    expect(ranked[0].id).toBe("non");
  });

  it("menu fallback + actions include recommended item with no openai", () => {
    const context = {
      intent: "menu",
      restaurants: [{ id: "r1", name: "R1" }],
      recommendedMenuItems: [{ id: "f1", name: "Phở bò", formattedPrice: "90.000đ", recommendationReason: "Phù hợp ngân sách của bạn" }],
      menuItems: [{ id: "f2", name: "Bún", formattedPrice: "80.000đ" }],
      coupons: [],
      orders: [],
      reservations: [],
    };
    const fallback = fallbackAnswer(context);
    expect(fallback.intent).toBe("menu");
    expect(fallback.answer).toContain("Phở bò");
    expect(fallback.sources.some((s) => s.type === "menuItem")).toBe(true);
    expect(fallbackActions(context).some((a) => a.href === "/food/f1")).toBe(true);
    expect(() => menuFallback(context)).not.toThrow();
  });

  it("fallbackSources include menu metadata and no checkout/payment actions", () => {
    const context = {
      intent: "menu",
      restaurants: [{ id: "r1" }],
      recommendedMenuItems: [{ id: "f1", name: "Phở", formattedPrice: "90.000đ", status: "available", isAvailable: true, options: [], variants: [] }],
      menuItems: [],
      coupons: [],
      orders: [],
      reservations: [],
    };
    const sources = fallbackSources(context);
    expect(sources[0]).toMatchObject({ type: "menuItem", id: "f1", formattedPrice: "90.000đ", status: "available", isAvailable: true, hasOptions: false, hasVariants: false, restaurantId: "r1" });
    const actions = fallbackActions(context);
    expect(actions.some((a) => /checkout|payment|thanh toán/i.test(`${a.type} ${a.label} ${a.href}`))).toBe(false);
  });

});
