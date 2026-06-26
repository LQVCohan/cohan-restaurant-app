import { describe, expect, it } from "vitest";
import {
  buildMenuSourceCards,
  buildStarterMessages,
  extractRestaurantId,
  getInputPlaceholder,
  getSafeVisibleAiActions,
} from "./AiChatbotWidget";
import { buildMenuItemServingOptions } from "@/utils/customerCartPayload";
import { AI_CHATBOT_FEATURE_MAP, getAiChatbotFeatureMatches } from "@/utils/aiChatbotFeatureMap";

describe("AiChatbotWidget helpers", () => {
  it("extractRestaurantId from /restaurant/:id", () => {
    expect(
      extractRestaurantId({
        params: { id: "abc" },
        pathname: "/restaurant/abc",
      }),
    ).toBe("abc");
  });

  it("starter messages", () => {
    expect(
      buildStarterMessages({ restaurantId: "r1", publicSettings: null }),
    ).toContain("Gợi ý món cho 2 người");
    expect(
      buildStarterMessages({ restaurantId: null, publicSettings: null }).length,
    ).toBeGreaterThan(0);
  });

  it("buildMenuSourceCards unique + preserves metadata", () => {
    const cards = buildMenuSourceCards({
      intent: "menu",
      sources: [
        {
          type: "menuItem",
          id: "food-1",
          label: "Phở",
          formattedPrice: "90.000đ",
          status: "available",
          basePrice: 80000,
          currentPrice: 90000,
        },
        { type: "menuItem", id: "food-1", label: "dup" },
        { type: "menuItem", id: "food-2", label: "Bún" },
      ],
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      formattedPrice: "90.000đ",
      status: "available",
      basePrice: 80000,
      currentPrice: 90000,
    });
  });

  it("serving options preserve sell unit metadata", () => {
    expect(
      buildMenuItemServingOptions({
        basePrice: 10000,
        servingVariants: [
          {
            key: "100g",
            mode: "weight",
            sellQty: 100,
            sellUnit: "g",
            name: "Gói 100g",
            price: 10000,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        key: "100g",
        mode: "weight",
        sellQty: 100,
        sellUnit: "g",
        name: "Gói 100g",
        price: 10000,
      }),
    ]);
  });

  it("placeholder changes", () => {
    expect(getInputPlaceholder("r1")).toMatch(/combo/);
    expect(getInputPlaceholder(null)).toMatch(/đặt bàn/);
  });
  it("feature map uses real routes, cart event action, and role filtering", () => {
    const customerManagerMatches = getAiChatbotFeatureMatches({ pathname: "/manager", userRole: "customer" });
    expect(customerManagerMatches.some((entry) => entry.managerOnly)).toBe(false);

    const managerMatches = getAiChatbotFeatureMatches({ pathname: "/manager", userRole: "manager" });
    expect(managerMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "manager-dashboard", path: "/manager", managerOnly: true }),
        expect.objectContaining({ key: "storage-inventory", path: "/manager#inventory", managerOnly: true }),
        expect.objectContaining({ key: "ai-chatbot-manager", path: "/manager#ai-chatbot-knowledge", managerOnly: true }),
      ]),
    );

    const staffMatches = getAiChatbotFeatureMatches({ pathname: "/staff/schedule", userRole: { roleName: "server" } });
    expect(staffMatches).toEqual(expect.arrayContaining([expect.objectContaining({ key: "staff-schedule", path: "/staff/schedule" })]));

    const foodMatches = getAiChatbotFeatureMatches({ pathname: "/food/food-1", restaurantId: "resto-1", selectedMenuItem: { id: "food-1" }, userRole: "customer" });
    expect(foodMatches).toEqual(expect.arrayContaining([expect.objectContaining({ key: "food-detail", path: "/food/food-1" })]));

    const cartEntry = AI_CHATBOT_FEATURE_MAP.find((entry) => entry.key === "cart");
    expect(cartEntry).toMatchObject({ actionType: "openCart", path: "" });
  });

  it("feature map matches natural-language query aliases by role", () => {
    expect(getAiChatbotFeatureMatches({ pathname: "/", restaurantId: "resto-1", userRole: "customer", query: "đặt bàn ở đâu" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "reservations", path: "/restaurant/resto-1/layout" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", restaurantId: "resto-1", userRole: "customer", query: "xem đánh giá nhà hàng" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "restaurant-reviews", path: "/restaurant/resto-1#reviews" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "xem đánh giá nhà hàng" }).some((entry) => entry.key === "restaurant-reviews"))
      .toBe(false);
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "giỏ hàng đâu" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "cart", actionType: "openCart" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "xem đơn hàng ở đâu" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "orders", path: "/orders" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "mã giảm giá ở đâu" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "coupons", path: "/coupons" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "ví của tôi ở đâu" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "wallet", path: "/wallet" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "thông báo của tôi ở đâu" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "notifications", path: "/notifications" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "liên hệ hỗ trợ ở đâu" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "contact", path: "/contact" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "combo tiết kiệm cho 2 người" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "combos", path: "/combos" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "gợi ý món hợp với tôi" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "for-you", path: "/for-you" })]));
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "customer", query: "quản lý chatbot ở đâu" }).some((entry) => entry.key === "ai-chatbot-manager"))
      .toBe(false);
    expect(getAiChatbotFeatureMatches({ pathname: "/", userRole: "manager", query: "quản lý chatbot ở đâu" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: "ai-chatbot-manager", managerOnly: true })]));
  });


  it("Phase 25 action helper caps, deduplicates, preserves primary action, and drops unsafe provider payloads", () => {
    const actions = [
      { type: "link", label: "Xem menu", href: "/cus-menu", priority: 1 },
      { type: "link", label: "Trùng menu", href: "/cus-menu", priority: 2 },
      { type: "openCart", label: "Mở giỏ hàng", href: "" },
      { type: "handoff", label: "Gặp nhân viên", href: "/contact" },
      { type: "search", label: "Tìm món chay", href: "món chay không cay" },
      { type: "link", label: "Đơn hàng", href: "/orders" },
      { type: "link", label: "Hồ sơ", href: "/profile" },
      { type: "link", label: "Quá giới hạn", href: "/restaurants" },
      { type: "link", label: "javascript", href: "javascript:alert(1)" },
      { type: "link", label: "data", href: "data:text/html,bad" },
      { type: "link", label: "mailto", href: "mailto:test@example.com" },
      { type: "link", label: "tel", href: "tel:123" },
      { type: "link", label: "protocol", href: "//evil.test" },
      { type: "add_to_cart_candidate", label: "Thêm thẳng", href: "/food/food-1" },
      { type: "delete", label: "Xóa", href: "/orders/1" },
    ];

    const visible = getSafeVisibleAiActions({ actions, handoffEnabled: true });

    expect(visible).toHaveLength(6);
    expect(visible[0]).toMatchObject({ label: "Xem menu", href: "/cus-menu" });
    expect(visible.filter((action) => action.href === "/cus-menu")).toHaveLength(1);
    expect(visible.map((action) => action.label)).toEqual([
      "Xem menu",
      "Mở giỏ hàng",
      "Gặp nhân viên",
      "Tìm món chay",
      "Đơn hàng",
      "Hồ sơ",
    ]);
    expect(JSON.stringify(visible)).not.toMatch(/javascript:|data:|mailto:|tel:|evil|add_to_cart_candidate|delete/);

    expect(getSafeVisibleAiActions({ actions, handoffEnabled: false }).some((action) => action.type === "handoff")).toBe(false);
  });

});
