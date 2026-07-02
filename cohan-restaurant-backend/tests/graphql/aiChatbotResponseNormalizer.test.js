import { describe, expect, it } from "vitest";
import { sanitizeAiChatbotResponse } from "../../graphql/resolvers/aiChatbot/index.js";

describe("sanitizeAiChatbotResponse", () => {
  it("turns a manager navigation request into one clear manager action", () => {
    const response = sanitizeAiChatbotResponse(
      {
        answer: "Mình có thể hỗ trợ nhiều nội dung quản lý.",
        intent: "menu",
        actions: [
          { type: "link", label: "Mở dashboard quản lý", href: "/manager" },
          { type: "link", label: "Xem món", href: "/food/food-1" },
        ],
        sources: [
          { type: "restaurant", id: "restaurant-1", label: "Cohan" },
          { type: "menuItem", id: "food-1", label: "Hàu sữa" },
        ],
        contextSummary: { restaurantCount: 1, menuItemCount: 8 },
      },
      "mở cho tôi trang quản lý nhà hàng",
    );

    expect(response).toMatchObject({
      answer: 'Mình đã tìm thấy trang quản lý nhà hàng. Chọn "Mở dashboard quản lý" bên dưới để mở.',
      intent: "managerFeatureHelp",
      actions: [{ type: "link", label: "Mở trang quản lý nhà hàng", href: "/manager" }],
      contextSummary: { restaurantCount: 1, menuItemCount: 0 },
    });
    expect(response.sources).toEqual([
      { type: "restaurant", id: "restaurant-1", label: "Cohan" },
    ]);
  });

  it("removes menu cards and food actions from non-menu responses", () => {
    const response = sanitizeAiChatbotResponse({
      answer: "Đơn hàng của bạn đang được xử lý.",
      intent: "orderHelp",
      actions: [
        { type: "link", label: "Đơn hàng", href: "/orders" },
        { type: "link", label: "Xem món", href: "/food/food-1" },
      ],
      sources: [
        { type: "order", id: "order-1", label: "ORD-1" },
        { type: "menuItem", id: "food-1", label: "Hàu sữa" },
      ],
    });

    expect(response.actions).toEqual([
      { type: "link", label: "Đơn hàng", href: "/orders" },
    ]);
    expect(response.sources).toEqual([
      { type: "order", id: "order-1", label: "ORD-1" },
    ]);
  });

  it("keeps real menu responses unchanged", () => {
    const original = {
      answer: "Mình gợi ý món bên dưới.",
      intent: "menu",
      actions: [{ type: "link", label: "Xem món", href: "/food/food-1" }],
      sources: [{ type: "menuItem", id: "food-1", label: "Hàu sữa" }],
    };

    expect(sanitizeAiChatbotResponse(original, "gợi ý món ngon")).toBe(original);
  });
});
