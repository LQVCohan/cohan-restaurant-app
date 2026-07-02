import { describe, expect, it } from "vitest";
import { getAiChatbotFeatureMatches } from "./aiChatbotFeatureMap";

describe("focused manager chatbot features", () => {
  it("returns only the requested personal information page", () => {
    const matches = getAiChatbotFeatureMatches({
      pathname: "/manager",
      userRole: "manager",
      message: "Mở giúp tôi trang quản lý thông tin cá nhân",
    });

    expect(matches).toEqual([
      expect.objectContaining({
        key: "manager-personal-info",
        label: "Mở thông tin cá nhân",
        path: "/manager#restaurant-info-management",
        managerOnly: true,
      }),
    ]);
  });

  it("returns only the manager coupon page for a coupon request", () => {
    const matches = getAiChatbotFeatureMatches({
      pathname: "/manager",
      userRole: "manager",
      message: "Mở giúp tôi trang quản lý coupon",
    });

    expect(matches).toEqual([
      expect.objectContaining({
        key: "manager-promotions",
        label: "Mở quản lý coupon",
        path: "/manager#promotions",
        managerOnly: true,
      }),
    ]);
  });

  it("does not expose manager actions to customers", () => {
    const matches = getAiChatbotFeatureMatches({
      pathname: "/",
      userRole: "customer",
      query: "Mở thông tin cá nhân",
    });

    expect(matches.some((entry) => entry.managerOnly)).toBe(false);
  });
});
