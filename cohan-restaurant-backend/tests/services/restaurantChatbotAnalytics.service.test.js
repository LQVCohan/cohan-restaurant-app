import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "../../src/constants/permissions.js";

const mocks = vi.hoisted(() => ({
  AiChatConversation: {
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    find: vi.fn(),
  },
  AiChatMessage: {
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    find: vi.fn(),
  },
  AiChatbotKnowledgeItem: { countDocuments: vi.fn() },
  AiChatbotKnowledgeSuggestion: { countDocuments: vi.fn() },
  AiChatbotAnswerFeedback: { countDocuments: vi.fn(), find: vi.fn() },
  AiChatbotSafetyRule: { countDocuments: vi.fn() },
  AiChatbotEvaluationCase: { countDocuments: vi.fn() },
  requireAnyRestaurantPermission: vi.fn(),
  requireAnyPermission: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  AiChatConversation: mocks.AiChatConversation,
  AiChatMessage: mocks.AiChatMessage,
  AiChatbotKnowledgeItem: mocks.AiChatbotKnowledgeItem,
  AiChatbotKnowledgeSuggestion: mocks.AiChatbotKnowledgeSuggestion,
  AiChatbotAnswerFeedback: mocks.AiChatbotAnswerFeedback,
  AiChatbotSafetyRule: mocks.AiChatbotSafetyRule,
  AiChatbotEvaluationCase: mocks.AiChatbotEvaluationCase,
}));

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireAnyRestaurantPermission: mocks.requireAnyRestaurantPermission,
  requireAnyPermission: mocks.requireAnyPermission,
}));

import { getRestaurantChatbotAnalytics } from "../../src/services/ai/restaurantChatbotAnalytics.service.js";

const restaurantId = "507f1f77bcf86cd799439011";

describe("restaurantChatbotAnalytics service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAnyRestaurantPermission.mockResolvedValue(true);
    mocks.requireAnyPermission.mockResolvedValue(true);
    mocks.AiChatConversation.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(4).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    mocks.AiChatMessage.countDocuments.mockResolvedValueOnce(40).mockResolvedValueOnce(5).mockResolvedValueOnce(7);
    mocks.AiChatMessage.countDocuments.mockResolvedValueOnce(2);
    mocks.AiChatConversation.aggregate.mockResolvedValue([{ _id: "menu", count: 6 }]);
    mocks.AiChatMessage.aggregate.mockResolvedValue([{ _id: "assistant", count: 30 }]);
    mocks.AiChatConversation.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([{ metadata: { handoffRequestedAt: new Date(Date.now()-600000).toISOString(), handoffResolvedAt: new Date().toISOString() } }]) });
    mocks.AiChatMessage.find.mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: "m1", content: "fallback", createdAt: new Date().toISOString(), intent: "general" }] }) }) });
    mocks.AiChatbotKnowledgeItem.countDocuments.mockResolvedValue(12);
    mocks.AiChatbotKnowledgeSuggestion.countDocuments.mockResolvedValue(4);
    mocks.AiChatbotKnowledgeSuggestion.find = vi.fn(() => ({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: "s1", question: "Q", triggerType: "fallback", updatedAt: new Date().toISOString() }] }) }) }));
    mocks.AiChatbotAnswerFeedback.countDocuments.mockResolvedValue(3);
    mocks.AiChatbotAnswerFeedback.find.mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: "f1", question: "Q", reason: "R", createdAt: new Date().toISOString() }] }) }) });
    mocks.AiChatbotSafetyRule.countDocuments.mockResolvedValue(5);
    mocks.AiChatbotEvaluationCase.countDocuments.mockResolvedValue(7);
  });

  it("returns aggregated metrics and policy config", async () => {
    const res = await getRestaurantChatbotAnalytics({ input: { restaurantId }, ctx: { user: { id: "u1", roleName: "manager" } } });
    expect(res.totalConversations).toBe(10);
    expect(res.totalMessages).toBe(40);
    expect(res.handoffConversionRate).toBeCloseTo(0.2);
    expect(res.topIntents[0]).toEqual({ intent: "menu", count: 6 });
    expect(res.messagesByRole[0]).toEqual({ role: "assistant", count: 30 });
    expect(Array.isArray(res.rateLimitStatus)).toBe(true);
    expect(res.rateLimitStatus[0]).toHaveProperty("action");
    expect(res.totalKnowledgeItems).toBe(12);
    expect(res.pendingSuggestions).toBe(4);
    expect(res.notHelpfulFeedback).toBe(3);
    expect(res.activeSafetyRules).toBe(5);
    expect(res.evaluationCaseCount).toBe(7);
    expect(Array.isArray(res.riskySignals)).toBe(true);
    expect(res.riskySignals.some((s) => s.code === "SAFETY_BLOCK_SPIKE")).toBe(true);
    expect(Array.isArray(res.recentQualityQueue)).toBe(true);
    expect(res.recentQualityQueue.map((item) => item.label)).not.toContain("Q");
  });

  it("uses global AI analytics permissions when restaurantId is omitted", async () => {
    await getRestaurantChatbotAnalytics({ input: {}, ctx: { user: { id: "u1", roleName: "manager" } } });
    expect(mocks.requireAnyPermission).toHaveBeenCalledWith(expect.any(Object), [
      PERMISSIONS.AI_CHATBOT_ANALYTICS_READ,
      PERMISSIONS.AI_CHATBOT_READ,
    ]);
  });

  it("requires AI analytics permission for restaurant-scoped analytics", async () => {
    await getRestaurantChatbotAnalytics({ input: { restaurantId }, ctx: { user: { id: "u1", roleName: "manager" } } });
    expect(mocks.requireAnyRestaurantPermission).toHaveBeenCalledWith(expect.any(Object), restaurantId, [
      PERMISSIONS.AI_CHATBOT_ANALYTICS_READ,
      PERMISSIONS.AI_CHATBOT_READ,
    ]);
  });

  it("rejects analytics ranges over 180 days", async () => {
    await expect(getRestaurantChatbotAnalytics({
      input: {
        restaurantId,
        from: "2025-01-01T00:00:00.000Z",
        to: "2025-12-31T00:00:00.000Z",
      },
      ctx: { user: { id: "u1", roleName: "manager" } },
    })).rejects.toMatchObject({ code: "BAD_USER_INPUT" });
  });

});