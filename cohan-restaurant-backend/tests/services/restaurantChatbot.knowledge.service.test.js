import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const store = [];

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => permissionSpy(...args) }));
vi.mock("../../models/index.js", () => {
  const AiChatbotKnowledgeItem = {
    async create(payload) { const doc = { _id: new mongoose.Types.ObjectId(), ...payload, toObject(){return this;} }; store.push(doc); return doc; },
    find(query) {
      let rows = store.filter((x) => String(x.restaurantId) === String(query.restaurantId));
      if (query.enabled != null) rows = rows.filter((x) => x.enabled === query.enabled);
      return { sort: () => ({ limit: () => ({ lean: async () => rows }), lean: async () => rows }), lean: async () => rows, limit: () => ({ lean: async () => rows }) };
    },
    async findById(id) { return store.find((x) => String(x._id) === String(id)) || null; },
    async deleteOne(q) { const i = store.findIndex((x) => String(x._id) === String(q._id)); if (i>=0) store.splice(i,1); },
  };
  return { AiChatbotKnowledgeItem };
});

import { createRestaurantAiChatbotKnowledgeItem, findRelevantKnowledgeForChatbot, listRestaurantAiChatbotKnowledge } from "../../src/services/ai/restaurantChatbotKnowledge.service.js";
import { PERMISSIONS } from "../../src/constants/permissions.js";

const rid = new mongoose.Types.ObjectId().toString();
const rid2 = new mongoose.Types.ObjectId().toString();

beforeEach(() => { store.length = 0; permissionSpy.mockReset(); permissionSpy.mockResolvedValue(true); });

describe("restaurantChatbotKnowledge service", () => {
  it("create with permission", async () => {
    const out = await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "  T ", content: " C ", tags: [" a "] }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(out.title).toBe("T");
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.RESTAURANT_WRITE);
  });
  it("reject create without permission", async () => {
    permissionSpy.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "t", content: "c" }, ctx: { user: { _id: "u" } } })).rejects.toThrow("FORBIDDEN");
  });
  it("list scoped by restaurant", async () => {
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "a", content: "x", enabled: true }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid2, title: "b", content: "x", enabled: true }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    const rows = await listRestaurantAiChatbotKnowledge({ restaurantId: rid, filter: {}, ctx: { user: { _id: "u" } } });
    expect(rows).toHaveLength(1);
  });
  it("runtime retrieval returns only enabled", async () => {
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "Delivery", content: "Open until 22h", enabled: true }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "Hidden", content: "x", enabled: false }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    const rows = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "delivery", limit: 5 });
    expect(rows.every((r) => r.enabled)).toBe(true);
  });
});
