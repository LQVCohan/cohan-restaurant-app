import { describe, expect, it } from "vitest";
import {
  AI_CHATBOT_RATE_LIMIT_POLICIES,
  AI_CHATBOT_RATE_LIMIT_MESSAGE,
  __getAiChatbotRateLimitBucketCountForTests,
  __resetAiChatbotRateLimitStoreForTests,
  consumeAiChatbotRateLimit,
} from "../../src/services/ai/restaurantChatbotRateLimit.service.js";

describe("restaurantChatbotRateLimit service", () => {
  it("allows under limit then blocks over limit", () => {
    __resetAiChatbotRateLimitStoreForTests();
    const policy = { action: "t", max: 2, windowMs: 5000 };
    expect(consumeAiChatbotRateLimit({ policy, keyParts: { guestId: "g1" }, nowMs: 1000 }).allowed).toBe(true);
    expect(consumeAiChatbotRateLimit({ policy, keyParts: { guestId: "g1" }, nowMs: 1100 }).allowed).toBe(true);
    const blocked = consumeAiChatbotRateLimit({ policy, keyParts: { guestId: "g1" }, nowMs: 1200 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("RATE_LIMITED");
    expect(blocked.safeMessage).toBe(AI_CHATBOT_RATE_LIMIT_MESSAGE);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates counters by key parts", () => {
    __resetAiChatbotRateLimitStoreForTests();
    const policy = AI_CHATBOT_RATE_LIMIT_POLICIES.askAiChatbot;
    for (let i = 0; i < 20; i += 1) {
      expect(consumeAiChatbotRateLimit({ policy, keyParts: { guestId: "g1", conversationId: "c1" } }).allowed).toBe(true);
    }
    expect(consumeAiChatbotRateLimit({ policy, keyParts: { guestId: "g1", conversationId: "c1" } }).allowed).toBe(false);
    expect(consumeAiChatbotRateLimit({ policy, keyParts: { guestId: "g1", conversationId: "c2" } }).allowed).toBe(true);
  });

  it("cleans expired buckets on next access", () => {
    __resetAiChatbotRateLimitStoreForTests();
    const policy = { action: "cleanup", max: 1, windowMs: 1000 };
    consumeAiChatbotRateLimit({ policy, keyParts: { guestId: "x" }, nowMs: 0 });
    expect(__getAiChatbotRateLimitBucketCountForTests()).toBeGreaterThan(0);
    consumeAiChatbotRateLimit({ policy, keyParts: { guestId: "y" }, nowMs: 61_000 });
    expect(__getAiChatbotRateLimitBucketCountForTests()).toBe(1);
  });
});
