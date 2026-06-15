import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const suggestions = [];
const feedbacks = [];
const safetyRules = [];

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => permissionSpy(...args), requireAnyRestaurantPermission: (...args) => permissionSpy(...args), requirePermission: (...args) => permissionSpy(...args), requireAnyPermission: (...args) => permissionSpy(...args) }));
vi.mock("../../models/index.js", () => ({
  AiChatbotKnowledgeSuggestion: {
    findById(id) {
      const row = suggestions.find((x) => String(x._id) === String(id));
      return row ? { ...row, lean: async () => ({ ...row }), save: async function save() { return this; } } : null;
    },
    async deleteOne(q) { const i = suggestions.findIndex((x) => String(x._id) === String(q._id)); if (i >= 0) suggestions.splice(i, 1); },
  },
  AiChatbotAnswerFeedback: {
    findById(id) {
      const row = feedbacks.find((x) => String(x._id) === String(id));
      return row ? { ...row, save: async function save() { return this; } } : null;
    },
  },
  AiChatConversation: {}, AiChatMessage: {},
  AiChatbotSafetyRule: {
    findById(id) {
      const row = safetyRules.find((x) => String(x._id) === String(id));
      return row ? { ...row, lean: async () => ({ ...row }), save: async function save() { return this; } } : null;
    },
    async deleteOne(q) { const i = safetyRules.findIndex((x) => String(x._id) === String(q._id)); if (i >= 0) safetyRules.splice(i, 1); },
  },
}));
vi.mock("../../src/services/ai/restaurantChatbotKnowledge.service.js", () => ({ createRestaurantAiChatbotKnowledgeItem: vi.fn(async () => ({ id: new mongoose.Types.ObjectId().toString() })) }));

import { bulkDismissRestaurantAiChatbotKnowledgeSuggestions, bulkDeleteRestaurantAiChatbotKnowledgeSuggestions } from "../../src/services/ai/restaurantChatbotKnowledgeSuggestion.service.js";
import { bulkMarkAiChatbotAnswerFeedbackReviewed, bulkIgnoreAiChatbotAnswerFeedback } from "../../src/services/ai/restaurantChatbotFeedback.service.js";
import { bulkUpdateRestaurantAiChatbotSafetyRuleEnabled, bulkDeleteRestaurantAiChatbotSafetyRules } from "../../src/services/ai/restaurantChatbotSafety.service.js";
import { PERMISSIONS } from "../../src/constants/permissions.js";

const rid = new mongoose.Types.ObjectId().toString();

beforeEach(() => {
  permissionSpy.mockReset(); permissionSpy.mockResolvedValue(true);
  suggestions.length = 0; feedbacks.length = 0; safetyRules.length = 0;
  suggestions.push({ _id: new mongoose.Types.ObjectId(), restaurantId: rid, status: "pending" });
  feedbacks.push({ _id: new mongoose.Types.ObjectId(), restaurantId: rid, status: "new" });
  safetyRules.push({ _id: new mongoose.Types.ObjectId(), restaurantId: rid, enabled: true });
});

describe("chatbot bulk ops", () => {
  it("knowledge suggestion bulk ops enforce permissions", async () => {
    await bulkDismissRestaurantAiChatbotKnowledgeSuggestions({ ids: [String(suggestions[0]._id)], ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_MODERATE);
    permissionSpy.mockClear();
    await bulkDeleteRestaurantAiChatbotKnowledgeSuggestions({ ids: [String(suggestions[0]._id)], ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_MODERATE);
  });

  it("feedback bulk ops enforce permissions", async () => {
    await bulkMarkAiChatbotAnswerFeedbackReviewed({ ids: [String(feedbacks[0]._id)], ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_MODERATE);
    permissionSpy.mockClear();
    await bulkIgnoreAiChatbotAnswerFeedback({ ids: [String(feedbacks[0]._id)], ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_MODERATE);
  });

  it("safety bulk ops enforce permissions", async () => {
    await bulkUpdateRestaurantAiChatbotSafetyRuleEnabled({ ids: [String(safetyRules[0]._id)], enabled: false, ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_MODERATE);
    permissionSpy.mockClear();
    await bulkDeleteRestaurantAiChatbotSafetyRules({ ids: [String(safetyRules[0]._id)], ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_MODERATE);
  });
});
