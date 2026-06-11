import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const suggestionStore = [];
const knowledgeStore = [];

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => permissionSpy(...args) }));
vi.mock("../../models/index.js", () => {
  const enhance = (row) => {
    if (!row.save) row.save = async function save() { return this; };
    if (!row.toObject) row.toObject = function toObject() { return { ...this }; };
    if (!row.lean) row.lean = async function lean() { return { ...this }; };
    return row;
  };

  const AiChatbotKnowledgeSuggestion = {
    async create(payload) { const doc = enhance({ _id: new mongoose.Types.ObjectId(), status: "pending", occurrenceCount: 1, ...payload }); suggestionStore.push(doc); return doc; },
    async findOne(q) { return suggestionStore.find((x) => String(x.restaurantId) === String(q.restaurantId) && x.normalizedQuestion === q.normalizedQuestion && x.status === q.status) || null; },
    find(q) { return { sort: () => ({ lean: async () => suggestionStore.filter((x) => String(x.restaurantId) === String(q.restaurantId)).filter((x) => !q.status || x.status === q.status) }) }; },
    findById(id) {
      const row = suggestionStore.find((x) => String(x._id) === String(id)) || null;
      if (!row) return null;
      return enhance(row);
    },
    async deleteOne(q) { const i = suggestionStore.findIndex((x) => String(x._id) === String(q._id)); if (i >= 0) suggestionStore.splice(i, 1); },
  };
  return { AiChatbotKnowledgeSuggestion, AiChatbotKnowledgeItem: {} };
});

vi.mock("../../src/services/ai/restaurantChatbotKnowledge.service.js", () => ({
  createRestaurantAiChatbotKnowledgeItem: async ({ input, skipPermissionCheck }) => {
    const row = { id: new mongoose.Types.ObjectId().toString(), restaurantId: input.restaurantId, title: input.title, sourceType: input.sourceType, skipPermissionCheck };
    knowledgeStore.push(row);
    return row;
  },
}));

import { PERMISSIONS } from "../../src/constants/permissions.js";
import {
  approveRestaurantAiChatbotKnowledgeSuggestion,
  dismissRestaurantAiChatbotKnowledgeSuggestion,
  recordKnowledgeGapSuggestion,
} from "../../src/services/ai/restaurantChatbotKnowledgeSuggestion.service.js";

const rid = new mongoose.Types.ObjectId().toString();

beforeEach(() => { suggestionStore.length = 0; knowledgeStore.length = 0; permissionSpy.mockReset(); permissionSpy.mockResolvedValue(true); });

describe("knowledge suggestion service", () => {
  it("approve pending suggestion creates one Knowledge Item and marks approved", async () => {
    const s = await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "Do you have vegan options?", triggerType: "fallback" });
    await approveRestaurantAiChatbotKnowledgeSuggestion({ id: s.id, input: { title: "Vegan", content: "Yes" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(knowledgeStore).toHaveLength(1);
    expect(knowledgeStore[0].sourceType).toBe("suggestion");
    expect(knowledgeStore[0].skipPermissionCheck).toBe(true);
    const saved = suggestionStore.find((x) => String(x._id) === s.id);
    expect(saved.status).toBe("approved");
    expect(String(permissionSpy.mock.calls[0][1])).toBe(rid);
    expect(permissionSpy.mock.calls[0][2]).toBe(PERMISSIONS.AI_CHATBOT_MODERATE);
  });

  it("approve already approved suggestion is rejected and does not create duplicate", async () => {
    const s = await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "Do you have gluten free?", triggerType: "fallback" });
    await approveRestaurantAiChatbotKnowledgeSuggestion({ id: s.id, input: { title: "GF", content: "Yes" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    await expect(approveRestaurantAiChatbotKnowledgeSuggestion({ id: s.id, input: { title: "GF2", content: "No" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } })).rejects.toMatchObject({ code: "BAD_USER_INPUT" });
    expect(knowledgeStore).toHaveLength(1);
  });

  it("approved suggestion cannot be dismissed", async () => {
    const s = await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "Do you have parking?", triggerType: "fallback" });
    await approveRestaurantAiChatbotKnowledgeSuggestion({ id: s.id, input: { title: "Parking", content: "Street parking" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    await expect(dismissRestaurantAiChatbotKnowledgeSuggestion({ id: s.id, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } })).rejects.toMatchObject({ code: "BAD_USER_INPUT" });
  });

  it("duplicate pending question increments occurrenceCount", async () => {
    await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "where is parking", triggerType: "fallback" });
    const out = await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "where is parking?", triggerType: "low_confidence" });
    expect(out.occurrenceCount).toBe(2);
  });
});