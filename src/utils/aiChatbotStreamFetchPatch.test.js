import { describe, expect, it } from "vitest";
import {
  focusAiChatbotResponseActions,
  isAskAiChatbotOperation,
  parseSseEvents,
} from "./aiChatbotStreamFetchPatch";

describe("aiChatbotStreamFetchPatch", () => {
  it("parses complete SSE frames and keeps the partial tail", () => {
    const input = [
      "event: delta",
      'data: {"text":"Xin"}',
      "",
      "event: done",
      'data: {"answer":"Xin chào"}',
      "",
      "event: delta",
      'data: {"text":" unfinished"}',
    ].join("\n");

    const parsed = parseSseEvents(input);

    expect(parsed.events).toEqual([
      { event: "delta", data: { text: "Xin" } },
      { event: "done", data: { answer: "Xin chào" } },
    ]);
    expect(parsed.rest).toBe('event: delta\ndata: {"text":" unfinished"}');
  });

  it("parses status frames before answer deltas", () => {
    const parsed = parseSseEvents([
      "event: status",
      'data: {"message":"AI đang kiểm tra ngữ cảnh"}',
      "",
      "event: delta",
      'data: {"text":"Mình gợi ý"}',
      "",
      "",
    ].join("\n"));

    expect(parsed.events).toEqual([
      { event: "status", data: { message: "AI đang kiểm tra ngữ cảnh" } },
      { event: "delta", data: { text: "Mình gợi ý" } },
    ]);
  });

  it("detects the AskAiChatbot GraphQL operation", () => {
    expect(isAskAiChatbotOperation({ operationName: "AskAiChatbot" })).toBe(true);
    expect(isAskAiChatbotOperation({ query: "mutation { askAiChatbot(input: $input) { answer } }" })).toBe(true);
    expect(isAskAiChatbotOperation({ operationName: "OtherMutation" })).toBe(false);
  });

  it("keeps only the manager action requested by the user", () => {
    const focused = focusAiChatbotResponseActions(
      {
        answer: "Bạn có thể quản lý coupon tại Dashboard quản lý.",
        actions: [
          { type: "link", label: "Mở dashboard quản lý", href: "/manager" },
          { type: "link", label: "Đơn hàng quản lý", href: "/manager#orders" },
          { type: "link", label: "Mở quản lý coupon", href: "/manager#promotions" },
        ],
        quickReplies: ["Quản lý kho", "Thông tin cá nhân"],
      },
      {
        message: "Mở giúp tôi trang quản lý coupon",
        pageContext: {
          pathname: "/",
          userRole: "manager",
          featureMatches: [
            {
              key: "manager-promotions",
              label: "Mở quản lý coupon",
              path: "/manager#promotions",
              intent: "managerFeatureHelp",
              description: "Mở khu vực quản lý chương trình khuyến mãi và coupon.",
            },
          ],
        },
      },
    );

    expect(focused.actions).toEqual([
      expect.objectContaining({
        label: "Mở quản lý coupon",
        href: "/manager#promotions",
      }),
    ]);
    expect(focused.quickReplies).toEqual([]);
    expect(focused.intent).toBe("managerFeatureHelp");
    expect(focused.answer).toContain("Mở quản lý coupon");
  });

  it("keeps only the customer action and corrects explicit navigation text", () => {
    const focused = focusAiChatbotResponseActions(
      {
        answer: "Mình chưa tìm thấy đơn hàng phù hợp trong dữ liệu của bạn.",
        intent: "orderHelp",
        isFallback: true,
        actions: [
          { type: "link", label: "Đơn hàng của tôi", href: "/orders" },
          { type: "link", label: "Xem thực đơn", href: "/cus-menu" },
          { type: "openCart", label: "Giỏ hàng của tôi", href: "" },
          { type: "link", label: "Thông báo", href: "/notifications" },
        ],
        quickReplies: ["Gợi ý cho tôi", "Mã giảm giá"],
      },
      {
        message: "Tôi muốn xem thực đơn",
        pageContext: {
          pathname: "/",
          userRole: "manager",
          featureMatches: [
            {
              key: "menu",
              label: "Xem thực đơn",
              path: "/cus-menu",
              intent: "menu",
              description: "Xem món ăn, giá và các lựa chọn đang bán.",
            },
          ],
        },
      },
    );

    expect(focused.actions).toEqual([
      expect.objectContaining({
        label: "Xem thực đơn",
        href: "/cus-menu",
      }),
    ]);
    expect(focused.quickReplies).toEqual([]);
    expect(focused.intent).toBe("menu");
    expect(focused.isFallback).toBe(false);
    expect(focused.answer).toBe("Bạn có thể mở mục “Xem thực đơn” bằng nút bên dưới.");
  });

  it("keeps advisory answers when the user is not explicitly navigating", () => {
    const focused = focusAiChatbotResponseActions(
      {
        answer: "Bạn thích món cay, món nước hay món nhẹ?",
        intent: "menu",
        actions: [{ type: "link", label: "Xem thực đơn", href: "/cus-menu" }],
        quickReplies: ["Món cay", "Món nước"],
      },
      {
        message: "Tôi chưa biết ăn gì",
        pageContext: {
          featureMatches: [
            {
              key: "menu",
              label: "Xem thực đơn",
              path: "/cus-menu",
              intent: "menu",
            },
          ],
        },
      },
    );

    expect(focused.answer).toBe("Bạn thích món cay, món nước hay món nhẹ?");
    expect(focused.actions).toHaveLength(1);
    expect(focused.quickReplies).toEqual([]);
  });

  it("supports focused cart actions without an href", () => {
    const focused = focusAiChatbotResponseActions(
      {
        actions: [
          { type: "link", label: "Xem thực đơn", href: "/cus-menu" },
          { type: "openCart", label: "Giỏ hàng của tôi", href: "" },
        ],
        quickReplies: ["Xem đơn hàng"],
      },
      {
        message: "Mở giỏ hàng của tôi",
        pageContext: {
          featureMatches: [
            {
              key: "cart",
              label: "Giỏ hàng của tôi",
              path: "",
              actionType: "openCart",
              intent: "cart",
              description: "Mở giỏ hàng hiện tại.",
            },
          ],
        },
      },
    );

    expect(focused.actions).toEqual([
      expect.objectContaining({
        type: "openCart",
        label: "Giỏ hàng của tôi",
      }),
    ]);
    expect(focused.quickReplies).toEqual([]);
    expect(focused.intent).toBe("cart");
    expect(focused.answer).toBe("Bạn có thể mở giỏ hàng bằng nút bên dưới.");
  });
});
