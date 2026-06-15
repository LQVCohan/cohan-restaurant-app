import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const store = [];
const permissionSpy = vi.fn();
const embeddingSpy = vi.fn();

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => permissionSpy(...args), requireAnyRestaurantPermission: (...args) => permissionSpy(...args), requirePermission: (...args) => permissionSpy(...args), requireAnyPermission: (...args) => permissionSpy(...args) }));
vi.mock("../../src/services/ai/localAiProvider.service.js", () => ({
  isLocalAiEnabled: () => process.env.LOCAL_AI_ENABLED === "true",
  getLocalAiConfig: () => ({ embeddingModel: "bge-m3" }),
  createLocalEmbedding: (...args) => embeddingSpy(...args),
}));
vi.mock("../../models/index.js", () => {
  const applyQuery = (query = {}) => {
    let rows = [...store];
    if (query.restaurantId) rows = rows.filter((x) => String(x.restaurantId) === String(query.restaurantId));
    if (query.enabled != null) rows = rows.filter((x) => x.enabled === query.enabled);
    if (query.embedding?.$exists) rows = rows.filter((x) => Array.isArray(x.embedding) && x.embedding.length);
    if (query.$text) rows = rows.filter((x) => `${x.title} ${x.content} ${(x.tags || []).join(" ")}`.toLowerCase().includes(String(query.$text.$search || "").toLowerCase()));
    return rows;
  };
  const chain = (rows) => ({ sort: () => chain(rows), limit: (n) => ({ lean: async () => rows.slice(0, n) }), lean: async () => rows });
  const AiChatbotKnowledgeItem = {
    find(query) { return chain(applyQuery(query)); },
    async create(payload) {
      const doc = { _id: new mongoose.Types.ObjectId(), ...payload, save: async function save() { return this; }, toObject: function toObject() { const { save, toObject, ...rest } = this; return { ...rest }; } };
      store.push(doc);
      return doc;
    },
    findById(id) { const row = store.find((x) => String(x._id) === String(id)); if (!row) return null; row.lean = async () => ({ ...row }); row.save = async function save() { return this; }; row.toObject = function toObject() { const { save, toObject, lean, ...rest } = this; return { ...rest }; }; return row; },
    findOne() { return { lean: async () => null }; },
  };
  return { AiChatbotKnowledgeItem };
});

import { clearAiChatbotCache } from "../../src/services/ai/restaurantChatbotCache.service.js";
import { createRestaurantAiChatbotKnowledgeItem, findRelevantKnowledgeForChatbot, updateRestaurantAiChatbotKnowledgeItem } from "../../src/services/ai/restaurantChatbotKnowledge.service.js";
import { __testables as chatbotTestables } from "../../src/services/ai/restaurantChatbot.service.js";

const originalEnv = { ...process.env };
const rid = new mongoose.Types.ObjectId().toString();
const otherRid = new mongoose.Types.ObjectId().toString();

beforeEach(() => {
  store.length = 0;
  clearAiChatbotCache();
  process.env = { ...originalEnv, LOCAL_AI_ENABLED: "true", AI_EMBEDDING_PROVIDER: "local", LOCAL_AI_EMBEDDING_MODEL: "bge-m3" };
  permissionSpy.mockReset().mockResolvedValue(true);
  embeddingSpy.mockReset().mockImplementation(async (text) => ({ embedding: /hold|table|deposit|advance/i.test(text) ? [1, 0] : [0, 1], model: "bge-m3" }));
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("restaurantChatbotKnowledge Phase 27 semantic retrieval", () => {
  it("semantic retrieval returns paraphrased match", async () => {
    store.push(
      { _id: new mongoose.Types.ObjectId(), restaurantId: rid, title: "Booking deposit", content: "Guests pay 20% advance to reserve a table.", tags: ["booking"], category: "policy", enabled: true, priority: 10, embedding: [1, 0], updatedAt: new Date() },
      { _id: new mongoose.Types.ObjectId(), restaurantId: rid, title: "Parking", content: "Motorbike parking is free.", tags: [], category: "info", enabled: true, priority: 5, embedding: [0, 1], updatedAt: new Date() },
    );
    const rows = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "how much money to hold a table", limit: 2 });
    expect(rows[0].title).toBe("Booking deposit");
    expect(rows[0]._score).toBeGreaterThan(0.5);
  });

  it("keyword fallback works when local embedding unavailable", async () => {
    process.env.LOCAL_AI_ENABLED = "false";
    store.push({ _id: new mongoose.Types.ObjectId(), restaurantId: rid, title: "Parking", content: "Free parking behind restaurant", tags: ["parking"], enabled: true, priority: 0 });
    const rows = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "parking", limit: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Parking");
  });

  it("disabled and other restaurant knowledge are not returned", async () => {
    store.push(
      { _id: new mongoose.Types.ObjectId(), restaurantId: rid, title: "Disabled", content: "deposit", enabled: false, embedding: [1, 0] },
      { _id: new mongoose.Types.ObjectId(), restaurantId: otherRid, title: "Other", content: "deposit", enabled: true, embedding: [1, 0] },
      { _id: new mongoose.Types.ObjectId(), restaurantId: rid, title: "Allowed", content: "deposit", enabled: true, embedding: [1, 0] },
    );
    const rows = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "deposit", limit: 5 });
    expect(rows.map((x) => x.title)).toEqual(["Allowed"]);
  });

  it("cache is invalidated after knowledge update", async () => {
    const created = await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "Old", content: "deposit", enabled: true }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    let rows = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "deposit", limit: 1 });
    expect(rows[0].title).toBe("Old");
    await updateRestaurantAiChatbotKnowledgeItem({ input: { id: created.id, title: "New" }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    rows = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "deposit", limit: 1 });
    expect(rows[0].title).toBe("New");
  });

  it("raw embeddings are not exposed in public chatbot response", () => {
    const response = chatbotTestables.fallbackAnswer({ intent: "support", restaurants: [], menuItems: [], recommendedMenuItems: [], coupons: [], orders: [], reservations: [] });
    response.knowledgeMatches = [{ id: "k1", title: "T", category: "policy", sourceType: "manual", score: 0.8 }];
    expect(JSON.stringify(response)).not.toContain("embedding");
  });
});
