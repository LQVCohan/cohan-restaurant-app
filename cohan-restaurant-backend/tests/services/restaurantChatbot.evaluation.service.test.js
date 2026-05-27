import { describe, it, expect, vi, beforeEach } from "vitest";

const handleSpy = vi.fn();
const reqPermSpy = vi.fn();
const caseStore = [];

vi.mock("../../src/services/ai/restaurantChatbot.service.js", () => ({ handleRestaurantChatbotMessage: (...args) => handleSpy(...args) }));
vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => reqPermSpy(...args) }));
vi.mock("../../models/index.js", () => ({
  AiChatbotEvaluationCase: {
    find: vi.fn((filter) => ({ sort: () => ({ lean: async () => caseStore.filter((x) => String(x.restaurantId) === String(filter.restaurantId) && (filter.enabled === undefined || x.enabled === filter.enabled)) }) })),
    create: vi.fn(async (payload) => ({ _id: "c1", ...payload })),
    findById: vi.fn(async (id) => caseStore.find((x) => x._id === id) || null),
    deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
  },
}));

import { evaluateRestaurantAiChatbotPrompt, runRestaurantAiChatbotEvaluationSet } from "../../src/services/ai/restaurantChatbotEvaluation.service.js";

describe("restaurant chatbot evaluation service", () => {
  beforeEach(() => { handleSpy.mockReset(); reqPermSpy.mockReset(); caseStore.length = 0; });

  it("requires auth", async () => {
    await expect(evaluateRestaurantAiChatbotPrompt({ input: { restaurantId: "665f665f665f665f665f665f", message: "hi" }, ctx: {} })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("uses no side effect options for evaluation", async () => {
    reqPermSpy.mockResolvedValueOnce(true);
    handleSpy.mockResolvedValueOnce({ answer: "ok", quickReplies: [], actions: [], sources: [], knowledgeMatches: [], safetyResult: { blocked: false, outOfScope: false, disclaimers: [], handoffSuggested: false, matchedRuleIds: [] } });
    await evaluateRestaurantAiChatbotPrompt({ input: { restaurantId: "665f665f665f665f665f665f", message: "hello" }, ctx: { user: { id: "u1" } } });
    expect(handleSpy).toHaveBeenCalledWith(expect.objectContaining({ persist: false, recordSuggestions: false, evaluationMode: true }));
  });

  it("runs one output per enabled case", async () => {
    reqPermSpy.mockResolvedValue(true);
    caseStore.push({ _id: "1", restaurantId: "665f665f665f665f665f665f", question: "q1", enabled: true, tags: [] });
    caseStore.push({ _id: "2", restaurantId: "665f665f665f665f665f665f", question: "q2", enabled: true, tags: [] });
    handleSpy.mockResolvedValue({ answer: "ok", quickReplies: [], actions: [], sources: [], knowledgeMatches: [], safetyResult: { blocked: false, outOfScope: false, disclaimers: [], handoffSuggested: false, matchedRuleIds: [] } });
    const out = await runRestaurantAiChatbotEvaluationSet({ input: { restaurantId: "665f665f665f665f665f665f" }, ctx: { user: { id: "u1" } } });
    expect(out).toHaveLength(2);
  });
});
