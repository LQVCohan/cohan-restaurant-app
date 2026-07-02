import { describe, expect, it } from "vitest";
import { getAiChatbotFeatureMatches } from "./aiChatbotFeatureMap";

describe("manager personal information chatbot feature", () => {
  it("matches the widget message payload and returns the manager page action", () => {
    const matches = getAiChatbotFeatureMatches({
      pathname: "/manager",
      userRole: "manager",
      message: "Mở giúp tôi trang quản lý thông tin cá nhân",
    });

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "manager-personal-info",
          label: "Mở thông tin cá nhân",
          path: "/manager#restaurant-info-management",
          managerOnly: true,
        }),
      ]),
    );
  });

  it("does not expose the manager action to customers", () => {
    const matches = getAiChatbotFeatureMatches({
      pathname: "/",
      userRole: "customer",
      query: "Mở thông tin cá nhân",
    });

    expect(matches.some((entry) => entry.key === "manager-personal-info")).toBe(false);
  });
});
