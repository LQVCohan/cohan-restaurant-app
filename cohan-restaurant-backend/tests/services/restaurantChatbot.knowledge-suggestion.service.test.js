import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const suggestionStore = [];
const knowledgeStore = [];

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => permissionSpy(...args) }));
vi.mock("../../models/index.js", () => {
  const AiChatbotKnowledgeSuggestion = {
    async create(payload) { const doc = { _id: new mongoose.Types.ObjectId(), ...payload, toObject() { return { ...this }; } }; suggestionStore.push(doc); return doc; },
    async findOne(q) { return suggestionStore.find((x) => String(x.restaurantId) === String(q.restaurantId) && x.normalizedQuestion === q.normalizedQuestion && x.status === q.status) || null; },
    find(q) { return { sort: () => ({ lean: async () => suggestionStore.filter((x) => String(x.restaurantId) === String(q.restaurantId)).filter((x) => !q.status || x.status === q.status) }) }; },
    async findById(id) { return suggestionStore.find((x) => String(x._id) === String(id)) || null; },
    async deleteOne(q) { const i = suggestionStore.findIndex((x) => String(x._id) === String(q._id)); if (i >= 0) suggestionStore.splice(i, 1); },
  };
  const AiChatbotKnowledgeItem = {};
  return { AiChatbotKnowledgeSuggestion, AiChatbotKnowledgeItem };
});
vi.mock("../../src/services/ai/restaurantChatbotKnowledge.service.js", () => ({
  createRestaurantAiChatbotKnowledgeItem: async ({ input }) => {
    const row = { id: new mongoose.Types.ObjectId().toString(), restaurantId: input.restaurantId, title: input.title };
    knowledgeStore.push(row);
    return row;
  },
}));

import { PERMISSIONS } from "../../src/constants/permissions.js";
import { approveRestaurantAiChatbotKnowledgeSuggestion, listRestaurantAiChatbotKnowledgeSuggestions, recordKnowledgeGapSuggestion } from "../../src/services/ai/restaurantChatbotKnowledgeSuggestion.service.js";

const rid = new mongoose.Types.ObjectId().toString();

beforeEach(() => { suggestionStore.length = 0; knowledgeStore.length = 0; permissionSpy.mockReset(); permissionSpy.mockResolvedValue(true); });

describe("knowledge suggestion service", () => {
  it("record creates pending suggestion", async () => {
    const out = await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "How late are you open?", triggerType: "fallback" });
    expect(out.status).toBe("pending");
    expect(out.occurrenceCount).toBe(1);
  });

  it("duplicate pending increments occurrenceCount", async () => {
    await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "where is parking", triggerType: "fallback" });
    const out = await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "where is parking?", triggerType: "low_confidence" });
    expect(out.occurrenceCount).toBe(2);
  });

  it("record ignores invalid/empty question", async () => {
    const out = await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "  ", triggerType: "fallback" });
    expect(out).toBeNull();
  });

  it("list requires REPORT_READ", async () => {
    await listRestaurantAiChatbotKnowledgeSuggestions({ restaurantId: rid, filter: {}, ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.REPORT_READ);
  });

  it("approve requires RESTAURANT_WRITE and creates knowledge", async () => {
    const s = await recordKnowledgeGapSuggestion({ restaurantId: rid, question: "Do you have vegan?", triggerType: "fallback" });
    const out = await approveRestaurantAiChatbotKnowledgeSuggestion({ id: s.id, input: { title: "Vegan options", content: "Yes" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(out.id).toBeTruthy();
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.RESTAURANT_WRITE);
  });
});
