import { describe, expect, it } from "vitest";
import { sanitizeAiChatbotResponse } from "../../graphql/resolvers/aiChatbot/index.js";

describe("chatbot response sanitizer", () => {
  it("hides menu items outside menu intent", () => {
    const result = sanitizeAiChatbotResponse({
      answer: "old",
      intent: "managerFeatureHelp",
      actions: [
        { type: "link", label: "Dashboard", href: "/manager" },
        { type: "link", label: "Food", href: "/food/f1" },
      ],
      sources: [
        { type: "menuItem", id: "f1", label: "Food" },
        { type: "restaurant", id: "r1", label: "Restaurant" },
      ],
    }, "mở trang quản lý");

    expect(result.answer).toContain("trang quản lý nhà hàng");
    expect(result.actions).toEqual([
      expect.objectContaining({
        href: "/manager",
        label: "Mở trang quản lý nhà hàng",
      }),
    ]);
    expect(result.sources).toEqual([expect.objectContaining({ type: "restaurant" })]);
  });

  it("keeps menu data for menu intent", () => {
    const response = {
      answer: "menu",
      intent: "menu",
      actions: [{ type: "link", label: "Food", href: "/food/f1" }],
      sources: [{ type: "menuItem", id: "f1", label: "Food" }],
    };

    expect(sanitizeAiChatbotResponse(response, "menu")).toBe(response);
  });
});
