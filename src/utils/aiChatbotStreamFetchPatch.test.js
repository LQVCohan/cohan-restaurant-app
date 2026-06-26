import { describe, expect, it } from "vitest";
import { isAskAiChatbotOperation, parseSseEvents } from "./aiChatbotStreamFetchPatch";

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
});
