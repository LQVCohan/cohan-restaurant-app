import { describe, expect, it } from "vitest";
import {
  ensureRequestedNavigationAction,
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

  it("adds a primary open button for manager personal information requests", () => {
    const result = ensureRequestedNavigationAction(
      {
        answer: "Bạn có thể mở trang thông tin cá nhân.",
        actions: [
          { type: "link", label: "Mở dashboard quản lý", href: "/manager" },
        ],
      },
      {
        message: "Mở giúp tôi trang quản lý thông tin cá nhân",
        pageContext: { pathname: "/manager", userRole: "manager" },
      },
    );

    expect(result.actions[0]).toMatchObject({
      type: "link",
      label: "Mở thông tin cá nhân",
      href: "/manager#restaurant-info-management",
    });
    expect(result.actions).toHaveLength(2);
  });

  it("does not expose the manager personal information action to customers", () => {
    const result = { answer: "Test", actions: [] };
    expect(
      ensureRequestedNavigationAction(result, {
        message: "Mở thông tin cá nhân",
        pageContext: { pathname: "/manager", userRole: "customer" },
      }),
    ).toBe(result);
  });
});
