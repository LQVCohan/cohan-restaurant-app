import { describe, expect, it } from "vitest";
import resolvers from "../../graphql/resolvers/index.js";

describe("resolver index ai chatbot query wiring", () => {
  it("exposes Query.aiChatbotAnalytics", () => {
    expect(typeof resolvers.Query.aiChatbotAnalytics).toBe("function");
  });
});
