import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../models/index.js", () => ({
  Coupon: { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }), lean: async () => [] }) },
  MenuItem: { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }), lean: async () => [] }) },
  Order: { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }), lean: async () => [] }) },
  Reservation: { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }), lean: async () => [] }) },
  Restaurant: { findById: async () => null, find: () => ({ lean: async () => [] }) },
  AiChatConversation: { findById: async () => null, findOne: () => ({ sort: async () => null }), create: async () => ({ _id: "c1" }) },
  AiChatMessage: { create: async () => ({ _id: "m1" }), find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) },
}));
vi.mock("../../src/services/ai/restaurantChatbotSafety.service.js", () => ({
  evaluateRestaurantAiChatbotSafety: async () => ({ blocked: true, outOfScope: true, disclaimers: ["d1"], handoffSuggested: true, matchedRules: [{ _id: "r1" }] }),
}));

import { handleRestaurantChatbotMessage } from "../../src/services/ai/restaurantChatbot.service.js";

describe("restaurant chatbot safety-blocked shape", () => {
  beforeEach(() => { delete process.env.OPENAI_API_KEY; vi.restoreAllMocks(); });

  it("returns required arrays and safetyResult in blocked flow", async () => {
    const out = await handleRestaurantChatbotMessage({ message: "blocked", evaluationMode: true, persist: false, recordSuggestions: false });
    expect(out.knowledgeMatches).toEqual([]);
    expect(Array.isArray(out.quickReplies)).toBe(true);
    expect(Array.isArray(out.actions)).toBe(true);
    expect(Array.isArray(out.sources)).toBe(true);
    expect(out.safetyResult?.blocked).toBe(true);
  });

  it("does not call AI provider when safety blocks", async () => {
    process.env.OPENAI_API_KEY = "test_key";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "{}" } }] }) });
    const out = await handleRestaurantChatbotMessage({ message: "blocked", evaluationMode: true, persist: false, recordSuggestions: false });
    expect(out.safetyResult?.blocked).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

});
