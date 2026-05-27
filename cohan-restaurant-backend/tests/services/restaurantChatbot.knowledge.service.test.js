import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const store = [];

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => permissionSpy(...args) }));
vi.mock("../../models/index.js", () => {
  const wrapDoc = (base) => ({
    ...base,
    async save() { return this; },
    toObject() { return { ...this }; },
  });

  const AiChatbotKnowledgeItem = {
    async create(payload) {
      const doc = wrapDoc({ _id: new mongoose.Types.ObjectId(), ...payload });
      store.push(doc);
      return doc;
    },
    find(query) {
      let rows = store.filter((x) => String(x.restaurantId) === String(query.restaurantId));
      if (query.enabled != null) rows = rows.filter((x) => x.enabled === query.enabled);
      return { sort: () => ({ limit: () => ({ lean: async () => rows }), lean: async () => rows }), lean: async () => rows, limit: () => ({ lean: async () => rows }) };
    },
    findById(id) {
      const row = store.find((x) => String(x._id) === String(id)) || null;
      if (!row) return null;
      return {
        ...row,
        lean: async () => ({ ...row }),
        async save() { return this; },
        toObject() { return { ...row, ...this }; },
      };
    },
    async deleteOne(q) { const i = store.findIndex((x) => String(x._id) === String(q._id)); if (i >= 0) store.splice(i, 1); },
  };
  return { AiChatbotKnowledgeItem };
});

import {
  createRestaurantAiChatbotKnowledgeItem,
  findRelevantKnowledgeForChatbot,
  listRestaurantAiChatbotKnowledge,
  updateRestaurantAiChatbotKnowledgeItem,
} from "../../src/services/ai/restaurantChatbotKnowledge.service.js";
import { PERMISSIONS } from "../../src/constants/permissions.js";

const rid = new mongoose.Types.ObjectId().toString();
const rid2 = new mongoose.Types.ObjectId().toString();

beforeEach(() => { store.length = 0; permissionSpy.mockReset(); permissionSpy.mockResolvedValue(true); });

describe("restaurantChatbotKnowledge service", () => {
  it("create with permission returns graphql-safe id/restaurantId strings", async () => {
    const out = await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "  T ", content: " C ", tags: [" a "] }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(out.title).toBe("T");
    expect(typeof out.id).toBe("string");
    expect(out.restaurantId).toBe(String(rid));
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.RESTAURANT_WRITE);
  });

  it("reject create without permission", async () => {
    permissionSpy.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "t", content: "c" }, ctx: { user: { _id: "u" } } })).rejects.toThrow("FORBIDDEN");
  });

  it("list scoped by restaurant and includes graphql-safe id", async () => {
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "a", content: "x", enabled: true }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid2, title: "b", content: "x", enabled: true }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    const rows = await listRestaurantAiChatbotKnowledge({ restaurantId: rid, filter: {}, ctx: { user: { _id: "u" } } });
    expect(rows).toHaveLength(1);
    expect(typeof rows[0].id).toBe("string");
    expect(rows[0].restaurantId).toBe(String(rid));
  });

  it("update returns graphql-safe id/restaurantId strings", async () => {
    const created = await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "Old", content: "Body" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    const updated = await updateRestaurantAiChatbotKnowledgeItem({ input: { id: created.id, title: "New" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(updated.title).toBe("New");
    expect(typeof updated.id).toBe("string");
    expect(updated.restaurantId).toBe(String(rid));
  });

  it("runtime retrieval returns only enabled", async () => {
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "Delivery", content: "Open until 22h", enabled: true }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "Hidden", content: "x", enabled: false }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    const rows = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "delivery", limit: 5 });
    expect(rows.every((r) => r.enabled)).toBe(true);
  });
});
