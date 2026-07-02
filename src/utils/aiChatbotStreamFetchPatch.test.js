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
  });
});
