import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const store = [];

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => permissionSpy(...args), requireAnyRestaurantPermission: (...args) => permissionSpy(...args), requirePermission: (...args) => permissionSpy(...args), requireAnyPermission: (...args) => permissionSpy(...args) }));
vi.mock("../../models/index.js", () => {
  const chain = (rows) => ({ sort: () => ({ limit: () => ({ lean: async () => rows }), lean: async () => rows }), limit: () => ({ lean: async () => rows }), lean: async () => rows });
  const AiChatbotKnowledgeItem = {
    async create(payload) {
      const doc = { _id: new mongoose.Types.ObjectId(), ...payload, save: async function save() { return this; }, toObject: function toObject() { return { ...this }; } };
      store.push(doc);
      return doc;
    },
    find(query) {
      let rows = [...store];
      if (query?.restaurantId) rows = rows.filter((x) => String(x.restaurantId) === String(query.restaurantId));
      if (query?.enabled != null) rows = rows.filter((x) => x.enabled === query.enabled);
      if (query?._id?.$in) {
        const ids = query._id.$in.map(String);
        rows = rows.filter((x) => ids.includes(String(x._id)));
      }
      if (query?.$text) rows = rows.filter((x) => `${x.title} ${x.content}`.toLowerCase().includes(String(query.$text.$search || "").toLowerCase()));
      return chain(rows);
    },
    findById(id) {
      const row = store.find((x) => String(x._id) === String(id));
      if (!row) return null;
      return { ...row, lean: async () => ({ ...row }), save: async function save() { return this; }, toObject: function toObject() { return { ...this }; } };
    },
    findOne(query) {
      const row = store.find((x) => String(x.restaurantId) === String(query.restaurantId) && x.title === query.title && x.content === query.content) || null;
      return { lean: async () => row };
    },
    async updateMany(query, update) {
      const ids = new Set((query?._id?.$in || []).map(String));
      for (const row of store) if (ids.has(String(row._id))) Object.assign(row, update?.$set || {});
    },
    async deleteMany(query) {
      const ids = new Set((query?._id?.$in || []).map(String));
      for (let i = store.length - 1; i >= 0; i -= 1) if (ids.has(String(store[i]._id))) store.splice(i, 1);
    },
    async deleteOne(q) { const i = store.findIndex((x) => String(x._id) === String(q._id)); if (i >= 0) store.splice(i, 1); },
  };
  return { AiChatbotKnowledgeItem };
});

import {
  createRestaurantAiChatbotKnowledgeItem,
  importRestaurantAiChatbotKnowledge,
  exportRestaurantAiChatbotKnowledge,
  bulkUpdateRestaurantAiChatbotKnowledgeEnabled,
  bulkDeleteRestaurantAiChatbotKnowledge,
} from "../../src/services/ai/restaurantChatbotKnowledge.service.js";
import { PERMISSIONS } from "../../src/constants/permissions.js";

const rid = new mongoose.Types.ObjectId().toString();

beforeEach(() => { store.length = 0; permissionSpy.mockReset(); permissionSpy.mockResolvedValue(true); });

describe("restaurantChatbotKnowledge Phase 18", () => {
  it("import JSON defaults sourceType to manual", async () => {
    const payload = JSON.stringify([{ title: "T", content: "C" }]);
    const out = await importRestaurantAiChatbotKnowledge({ input: { restaurantId: rid, format: "json", payload }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(out.imported).toBe(1);
    expect(store[0].sourceType).toBe("manual");
  });

  it("import rejects invalid payload", async () => {
    await expect(importRestaurantAiChatbotKnowledge({ input: { restaurantId: rid, format: "json", payload: "{" }, ctx: { user: { _id: "u" } } })).rejects.toThrow("Import payload không hợp lệ");
  });

  it("import skips duplicate title/content", async () => {
    const payload = JSON.stringify([{ title: "A", content: "B" }, { title: "A", content: "B" }]);
    const out = await importRestaurantAiChatbotKnowledge({ input: { restaurantId: rid, format: "json", payload }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(out.imported).toBe(1);
    expect(out.skipped).toBe(1);
  });

  it("export returns JSON", async () => {
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "X", content: "Y" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    const out = await exportRestaurantAiChatbotKnowledge({ restaurantId: rid, format: "json", ctx: { user: { _id: "u" } } });
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it("export returns CSV", async () => {
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "X", content: "Y" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    const out = await exportRestaurantAiChatbotKnowledge({ restaurantId: rid, format: "csv", ctx: { user: { _id: "u" } } });
    expect(out).toContain("title,content,category,tags,enabled,priority,sourceType");
  });

  it("bulk update/delete enforce AI chatbot write", async () => {
    const created = await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "A", content: "B" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    permissionSpy.mockClear();
    await bulkUpdateRestaurantAiChatbotKnowledgeEnabled({ ids: [created.id], enabled: false, ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_WRITE);
    permissionSpy.mockClear();
    await bulkDeleteRestaurantAiChatbotKnowledge({ ids: [created.id], ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_WRITE);
  });

  it("import/export enforce expected permissions", async () => {
    const payload = JSON.stringify([{ title: "P", content: "Q" }]);
    await importRestaurantAiChatbotKnowledge({ input: { restaurantId: rid, format: "json", payload }, ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, PERMISSIONS.AI_CHATBOT_WRITE);

    permissionSpy.mockClear();
    await exportRestaurantAiChatbotKnowledge({ restaurantId: rid, format: "json", ctx: { user: { _id: "u" } } });
    expect(permissionSpy).toHaveBeenCalledWith(expect.any(Object), rid, expect.arrayContaining([PERMISSIONS.AI_CHATBOT_READ]));
  });

});
