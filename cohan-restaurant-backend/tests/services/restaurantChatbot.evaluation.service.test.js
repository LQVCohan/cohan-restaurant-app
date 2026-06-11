import { describe, it, expect, vi, beforeEach } from "vitest";
import { PERMISSIONS } from "../../src/constants/permissions.js";

const handleSpy = vi.fn();
const reqPermSpy = vi.fn();
const reqAnyRestaurantPermSpy = vi.fn();
const caseStore = [];

vi.mock("../../src/services/ai/restaurantChatbot.service.js", () => ({ handleRestaurantChatbotMessage: (...args) => handleSpy(...args) }));
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: (...args) => reqPermSpy(...args),
  requireAnyRestaurantPermission: (...args) => reqAnyRestaurantPermSpy(...args),
}));
vi.mock("../../models/index.js", () => ({
  AiChatbotEvaluationCase: {
    find: vi.fn((filter) => ({ sort: () => ({ lean: async () => caseStore.filter((x) => String(x.restaurantId) === String(filter.restaurantId?.toString ? filter.restaurantId.toString() : filter.restaurantId) && (filter.enabled === undefined || typeof filter.enabled !== "boolean" || x.enabled === filter.enabled)) }) })),
    create: vi.fn(async (payload) => ({ _id: "c1", ...payload })),
    findById: vi.fn(async (id) => caseStore.find((x) => x._id === id) || null),
    deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
  },
}));

import {
  evaluateRestaurantAiChatbotPrompt,
  runRestaurantAiChatbotEvaluationSet,
  listRestaurantAiChatbotEvaluationCases,
  createRestaurantAiChatbotEvaluationCase,
  updateRestaurantAiChatbotEvaluationCase,
} from "../../src/services/ai/restaurantChatbotEvaluation.service.js";

const restaurantId = "665f665f665f665f665f665f";

describe("restaurant chatbot evaluation service", () => {
  beforeEach(() => {
    handleSpy.mockReset();
    reqPermSpy.mockReset();
    reqAnyRestaurantPermSpy.mockReset();
    reqPermSpy.mockResolvedValue(true);
    reqAnyRestaurantPermSpy.mockResolvedValue(true);
    caseStore.length = 0;
  });

  it("requires auth", async () => {
    await expect(evaluateRestaurantAiChatbotPrompt({ input: { restaurantId, message: "hi" }, ctx: {} })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("uses no side effect options for evaluation", async () => {
    handleSpy.mockResolvedValueOnce({ answer: "ok", quickReplies: [], actions: [], sources: [], knowledgeMatches: [], safetyResult: { blocked: false, outOfScope: false, disclaimers: [], handoffSuggested: false, matchedRuleIds: [] } });
    await evaluateRestaurantAiChatbotPrompt({ input: { restaurantId, message: "hello" }, ctx: { user: { id: "u1" } } });
    expect(reqAnyRestaurantPermSpy).toHaveBeenCalledWith(expect.any(Object), restaurantId, [PERMISSIONS.AI_CHATBOT_EVALUATE, PERMISSIONS.AI_CHATBOT_WRITE]);
    expect(handleSpy).toHaveBeenCalledWith(expect.objectContaining({ persist: false, recordSuggestions: false, evaluationMode: true }));
  });

  it("list/create/update cases return dto-safe ids and arrays", async () => {
    caseStore.push({ _id: "1", restaurantId, question: "q1", enabled: true, tags: undefined });
    const listed = await listRestaurantAiChatbotEvaluationCases({ restaurantId, ctx: { user: { id: "u1" } } });
    expect(typeof listed[0].id).toBe("string");
    expect(typeof listed[0].restaurantId).toBe("string");
    expect(listed[0].tags).toEqual([]);

    const created = await createRestaurantAiChatbotEvaluationCase({ input: { restaurantId, question: "  test  ", tags: ["a", "b"] }, ctx: { user: { id: "665f665f665f665f665f6661" } } });
    expect(reqPermSpy).toHaveBeenCalledWith(expect.any(Object), restaurantId, PERMISSIONS.AI_CHATBOT_EVALUATE);
    expect(created.id).toBeTruthy();
    expect(created.restaurantId).toBeTruthy();

    caseStore.push({ _id: "2", restaurantId, question: "q2", enabled: true, tags: ["t"], save: vi.fn(async function(){ return this; }) });
    const updated = await updateRestaurantAiChatbotEvaluationCase({ input: { id: "2", expectedBehavior: "x" }, ctx: { user: { id: "665f665f665f665f665f6662" } } });
    expect(updated.tags).toEqual(["t"]);
    expect(typeof updated.id).toBe("string");
  });

  it("runs one output per enabled case", async () => {
    caseStore.push({ _id: "1", restaurantId, question: "q1", enabled: true, tags: [] });
    caseStore.push({ _id: "2", restaurantId, question: "q2", enabled: true, tags: [] });
    handleSpy.mockResolvedValue({ answer: "ok", quickReplies: [], actions: [], sources: [], knowledgeMatches: [], safetyResult: { blocked: false, outOfScope: false, disclaimers: [], handoffSuggested: false, matchedRuleIds: [] } });
    const out = await runRestaurantAiChatbotEvaluationSet({ input: { restaurantId }, ctx: { user: { id: "u1" } } });
    expect(reqAnyRestaurantPermSpy).toHaveBeenCalledWith(expect.any(Object), restaurantId, [PERMISSIONS.AI_CHATBOT_EVALUATE, PERMISSIONS.AI_CHATBOT_WRITE]);
    expect(out).toHaveLength(2);
  });
});