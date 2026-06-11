import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const anyRestaurantPermissionSpy = vi.fn();
const recordSuggestionSpy = vi.fn();
const feedbackStore = [];
const conversationStore = [];
const messageStore = [];

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: (...args) => permissionSpy(...args),
  requireAnyRestaurantPermission: (...args) => anyRestaurantPermissionSpy(...args),
}));
vi.mock("../../src/services/ai/restaurantChatbotKnowledgeSuggestion.service.js", () => ({ recordKnowledgeGapSuggestion: (...args) => recordSuggestionSpy(...args) }));
vi.mock("../../models/index.js", () => {
  const toLean = (row) => ({ lean: async () => (row ? { ...row } : null) });
  const enhance = (row) => ({ ...row, save: async function save() { return this; }, toObject: function toObject() { return { ...this }; } });
  return {
    AiChatConversation: {
      findOne: (q) => toLean(conversationStore.find((x) => String(x._id) === String(q._id) && String(x.restaurantId) === String(q.restaurantId) && (q.userId ? String(x.userId) === String(q.userId) : String(x.guestId || "") === String(q.guestId || ""))) || null),
      findById: (id) => toLean(conversationStore.find((x) => String(x._id) === String(id)) || null),
    },
    AiChatMessage: {
      findById: (id) => toLean(messageStore.find((x) => String(x._id) === String(id)) || null),
    },
    AiChatbotAnswerFeedback: {
      async create(payload) { const row = enhance({ _id: new mongoose.Types.ObjectId(), status: "new", ...payload }); feedbackStore.push(row); return row; },
      find(q) { return { sort: () => ({ limit: () => ({ lean: async () => feedbackStore.filter((x) => String(x.restaurantId) === String(q.restaurantId)) }) }) }; },
      async findById(id) { const row = feedbackStore.find((x) => String(x._id) === String(id)); return row ? row : null; },
    },
  };
});

import { PERMISSIONS } from "../../src/constants/permissions.js";
import {
  submitAiChatbotAnswerFeedback,
  listRestaurantAiChatbotAnswerFeedback,
  markAiChatbotAnswerFeedbackReviewed,
  ignoreAiChatbotAnswerFeedback,
  convertAiChatbotFeedbackToSuggestion,
} from "../../src/services/ai/restaurantChatbotFeedback.service.js";

const rid = new mongoose.Types.ObjectId().toString();
const rid2 = new mongoose.Types.ObjectId().toString();
const uid = new mongoose.Types.ObjectId().toString();
const cid = new mongoose.Types.ObjectId().toString();
const mid = new mongoose.Types.ObjectId().toString();

beforeEach(() => {
  permissionSpy.mockReset(); permissionSpy.mockResolvedValue(true);
  anyRestaurantPermissionSpy.mockReset(); anyRestaurantPermissionSpy.mockResolvedValue(true);
  recordSuggestionSpy.mockReset(); recordSuggestionSpy.mockResolvedValue({ id: "s1" });
  feedbackStore.length = 0; conversationStore.length = 0; messageStore.length = 0;
  conversationStore.push({ _id: cid, restaurantId: rid, guestId: "g1", userId: uid });
  messageStore.push({ _id: mid, role: "assistant", restaurantId: rid, conversationId: cid });
});

describe("restaurantChatbotFeedback service", () => {
  it("submit helpful feedback works", async () => {
    const out = await submitAiChatbotAnswerFeedback({ input: { restaurantId: rid, conversationId: cid, messageId: mid, guestId: "g1", question: "Q", answer: "A", rating: "helpful" }, ctx: {} });
    expect(out.rating).toBe("helpful"); expect(out.restaurantId).toBe(rid); expect(out.messageId).toBe(mid);
  });

  it("submit not_helpful with reason works", async () => {
    const out = await submitAiChatbotAnswerFeedback({ input: { restaurantId: rid, conversationId: cid, messageId: mid, guestId: "g1", question: "Q", answer: "A", rating: "not_helpful", reason: "Sai" }, ctx: {} });
    expect(out.reason).toBe("Sai");
  });

  it("invalid rating rejected", async () => {
    await expect(submitAiChatbotAnswerFeedback({ input: { restaurantId: rid, rating: "bad" }, ctx: {} })).rejects.toMatchObject({ code: "BAD_USER_INPUT" });
  });

  it("submit rejects messageId from wrong restaurant", async () => {
    await expect(submitAiChatbotAnswerFeedback({ input: { restaurantId: rid2, conversationId: cid, messageId: mid, guestId: "g1", rating: "helpful" }, ctx: {} })).rejects.toMatchObject({ code: "BAD_USER_INPUT" });
  });

  it("list requires AI chatbot read or moderate permission", async () => {
    await listRestaurantAiChatbotAnswerFeedback({ restaurantId: rid, filter: { search: "[abc" }, ctx: { user: { id: uid } } });
    expect(anyRestaurantPermissionSpy).toHaveBeenCalledWith(expect.anything(), rid, [PERMISSIONS.AI_CHATBOT_MODERATE, PERMISSIONS.AI_CHATBOT_READ]);
  });

  it("review/ignore/convert require AI moderate permission", async () => {
    const row = await submitAiChatbotAnswerFeedback({ input: { restaurantId: rid, guestId: "g1", rating: "helpful" }, ctx: {} });
    await markAiChatbotAnswerFeedbackReviewed({ id: row.id, ctx: { user: { id: uid } } });
    await ignoreAiChatbotAnswerFeedback({ id: row.id, ctx: { user: { id: uid } } });
    await convertAiChatbotFeedbackToSuggestion({ id: row.id, ctx: { user: { id: uid } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.anything(), expect.anything(), PERMISSIONS.AI_CHATBOT_MODERATE);
  });

  it("convert calls recordKnowledgeGapSuggestion and marks converted", async () => {
    const row = await submitAiChatbotAnswerFeedback({ input: { restaurantId: rid, conversationId: cid, messageId: mid, guestId: "g1", question: "abc", rating: "not_helpful" }, ctx: {} });
    await convertAiChatbotFeedbackToSuggestion({ id: row.id, ctx: { user: { id: uid } } });
    expect(recordSuggestionSpy).toHaveBeenCalled();
    const saved = feedbackStore.find((x) => String(x._id) === row.id);
    expect(saved.status).toBe("converted_to_suggestion");
  });

  it("DTO includes string ids", async () => {
    const out = await submitAiChatbotAnswerFeedback({ input: { restaurantId: rid, conversationId: cid, messageId: mid, guestId: "g1", rating: "helpful" }, ctx: {} });
    expect(typeof out.id).toBe("string"); expect(typeof out.restaurantId).toBe("string"); expect(typeof out.messageId).toBe("string");
  });
});