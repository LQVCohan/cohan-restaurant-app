import { describe, expect, it } from "vitest";
import { getAiChatbotFeatureMatches } from "@/utils/aiChatbotFeatureMap";

describe("aiChatbotFeatureMap page context", () => {
  it("accepts the widget message field and defers manager authorization to backend", () => {
    const matches = getAiChatbotFeatureMatches({
      pathname: "/",
      message: "mở cho tôi trang quản lý nhà hàng",
    });

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "manager-dashboard",
          path: "/manager",
          managerOnly: true,
        }),
      ]),
    );
  });

  it("still removes manager features when the caller supplies a customer role", () => {
    const matches = getAiChatbotFeatureMatches({
      pathname: "/",
      userRole: "customer",
      message: "mở cho tôi trang quản lý nhà hàng",
    });

    expect(matches.some((entry) => entry.managerOnly)).toBe(false);
  });

  it("derives restaurant context from the current restaurant URL", () => {
    const matches = getAiChatbotFeatureMatches({
      pathname: "/restaurant/resto-1",
      message: "xem thực đơn nhà hàng",
    });

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "restaurant-menu",
          path: "/restaurant/resto-1#menu",
        }),
      ]),
    );
  });
});
