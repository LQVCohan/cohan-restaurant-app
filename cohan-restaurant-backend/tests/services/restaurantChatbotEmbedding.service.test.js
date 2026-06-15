import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const store = [];
const permissionSpy = vi.fn();
const embeddingSpy = vi.fn();

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireRestaurantPermission: (...args) => permissionSpy(...args), requireAnyRestaurantPermission: (...args) => permissionSpy(...args), requirePermission: (...args) => permissionSpy(...args), requireAnyPermission: (...args) => permissionSpy(...args) }));
vi.mock("../../src/services/ai/localAiProvider.service.js", () => ({
  isLocalAiEnabled: () => process.env.LOCAL_AI_ENABLED === "true",
  getLocalAiConfig: () => ({ embeddingModel: process.env.LOCAL_AI_EMBEDDING_MODEL || "bge-m3" }),
  createLocalEmbedding: (...args) => embeddingSpy(...args),
}));
vi.mock("../../models/index.js", () => {
  const chain = (rows) => ({ sort: () => rows, lean: async () => rows, limit: () => ({ lean: async () => rows }) });
  const AiChatbotKnowledgeItem = {
    async create(payload) {
      const doc = { _id: new mongoose.Types.ObjectId(), ...payload, save: async function save() { return this; }, toObject: function toObject() { const { save, toObject, ...rest } = this; return { ...rest }; } };
      store.push(doc);
      return doc;
    },
    find(query = {}) {
      let rows = [...store];
      if (query.restaurantId) rows = rows.filter((x) => String(x.restaurantId) === String(query.restaurantId));
      if (query.enabled != null) rows = rows.filter((x) => x.enabled === query.enabled);
      return chain(rows);
    },
  };
  return { AiChatbotKnowledgeItem };
});

import {
  __testables,
  createEmbedding,
  createEmbeddingForKnowledgeItem,
  hashEmbeddingContent,
  rebuildKnowledgeItemEmbedding,
  rebuildRestaurantKnowledgeEmbeddings,
  shouldRefreshEmbedding,
} from "../../src/services/ai/restaurantChatbotEmbedding.service.js";
import { createRestaurantAiChatbotKnowledgeItem } from "../../src/services/ai/restaurantChatbotKnowledge.service.js";
import { clearAiChatbotCache } from "../../src/services/ai/restaurantChatbotCache.service.js";

const originalEnv = { ...process.env };
const rid = new mongoose.Types.ObjectId().toString();

beforeEach(() => {
  store.length = 0;
  clearAiChatbotCache();
  process.env = { ...originalEnv, LOCAL_AI_ENABLED: "true", AI_EMBEDDING_PROVIDER: "local", LOCAL_AI_EMBEDDING_MODEL: "bge-m3" };
  permissionSpy.mockReset().mockResolvedValue(true);
  embeddingSpy.mockReset().mockResolvedValue({ embedding: [0.1, 0.2], model: "bge-m3" });
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("restaurantChatbotEmbedding Phase 27", () => {
  it("knowledge embedding text is stable", () => {
    const item = { title: " Deposit ", content: "Pay 20%", category: "policy", tags: ["booking", "vip"], sourceType: "manual" };
    expect(__testables.embeddingTextForKnowledgeItem(item)).toBe(__testables.embeddingTextForKnowledgeItem({ ...item }));
  });

  it("content hash changes when title/content/tags change", () => {
    const base = { title: "A", content: "B", tags: ["x"] };
    expect(hashEmbeddingContent(base)).not.toBe(hashEmbeddingContent({ ...base, title: "C" }));
    expect(hashEmbeddingContent(base)).not.toBe(hashEmbeddingContent({ ...base, content: "D" }));
    expect(hashEmbeddingContent(base)).not.toBe(hashEmbeddingContent({ ...base, tags: ["y"] }));
  });

  it("shouldRefreshEmbedding works", () => {
    const item = { title: "A", content: "B", tags: [], enabled: true };
    expect(shouldRefreshEmbedding(item)).toBe(true);
    item.embedding = [1, 2];
    item.embeddingModel = "bge-m3";
    item.embeddingContentHash = hashEmbeddingContent(item);
    expect(shouldRefreshEmbedding(item)).toBe(false);
    item.title = "A2";
    expect(shouldRefreshEmbedding(item)).toBe(true);
    expect(shouldRefreshEmbedding({ ...item, enabled: false })).toBe(false);
  });

  it("rebuildKnowledgeItemEmbedding saves metadata", async () => {
    const item = { title: "A", content: "B", tags: [], enabled: true, save: vi.fn(async function save() { return this; }) };
    const out = await rebuildKnowledgeItemEmbedding(item);
    expect(out.updated).toBe(true);
    expect(item.embedding).toEqual([0.1, 0.2]);
    expect(item.embeddingModel).toBe("bge-m3");
    expect(item.embeddingContentHash).toBe(hashEmbeddingContent(item));
    expect(item.save).toHaveBeenCalled();
  });

  it("failed embedding does not break knowledge create/update", async () => {
    embeddingSpy.mockResolvedValueOnce(null);
    const out = await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "X", content: "Y", enabled: true }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(out.title).toBe("X");
    expect(out.embedding).toBeUndefined();
  });

  it("rebuildRestaurantKnowledgeEmbeddings returns summary", async () => {
    const item = { _id: new mongoose.Types.ObjectId(), restaurantId: rid, title: "A", content: "B", tags: [], enabled: true, save: vi.fn(async function save() { return this; }) };
    store.push(item);
    const out = await rebuildRestaurantKnowledgeEmbeddings({ restaurantId: rid, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(out).toMatchObject({ total: 1, updated: 1, skipped: 0, failed: 0 });
  });

  it("createEmbedding caches successful embedding result", async () => {
    const first = await createEmbedding("deposit policy");
    const second = await createEmbedding("deposit policy");
    expect(first).toEqual({ embedding: [0.1, 0.2], model: "bge-m3", provider: "local" });
    expect(second).toEqual(first);
    expect(embeddingSpy).toHaveBeenCalledTimes(1);
  });

  it("createEmbedding does not cache null result and retries successfully", async () => {
    embeddingSpy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ embedding: [0.3, 0.4], model: "bge-m3" });
    await expect(createEmbedding("temporary outage")).resolves.toBeNull();
    await expect(createEmbedding("temporary outage")).resolves.toEqual({ embedding: [0.3, 0.4], model: "bge-m3", provider: "local" });
    expect(embeddingSpy).toHaveBeenCalledTimes(2);
  });

  it("createEmbedding does not cache provider failure", async () => {
    embeddingSpy
      .mockRejectedValueOnce(Object.assign(new Error("ollama down"), { code: "LOCAL_AI_PROVIDER_ERROR" }))
      .mockResolvedValueOnce({ embedding: [0.5, 0.6], model: "bge-m3" });
    await expect(createEmbedding("provider failure")).resolves.toBeNull();
    await expect(createEmbedding("provider failure")).resolves.toEqual({ embedding: [0.5, 0.6], model: "bge-m3", provider: "local" });
    expect(embeddingSpy).toHaveBeenCalledTimes(2);
  });

  it("createEmbedding does not cache empty embedding result", async () => {
    embeddingSpy
      .mockResolvedValueOnce({ embedding: [], model: "bge-m3" })
      .mockResolvedValueOnce({ embedding: [0.7, 0.8], model: "bge-m3" });
    await expect(createEmbedding("empty vector")).resolves.toBeNull();
    await expect(createEmbedding("empty vector")).resolves.toEqual({ embedding: [0.7, 0.8], model: "bge-m3", provider: "local" });
    expect(embeddingSpy).toHaveBeenCalledTimes(2);
  });

  it("successful cached embedding should avoid second provider call", async () => {
    await expect(createEmbedding("cached success")).resolves.toEqual({ embedding: [0.1, 0.2], model: "bge-m3", provider: "local" });
    embeddingSpy.mockResolvedValueOnce({ embedding: [9, 9], model: "bge-m3" });
    await expect(createEmbedding("cached success")).resolves.toEqual({ embedding: [0.1, 0.2], model: "bge-m3", provider: "local" });
    expect(embeddingSpy).toHaveBeenCalledTimes(1);
  });

  it("createEmbeddingForKnowledgeItem returns null when provider unavailable", async () => {
    process.env.LOCAL_AI_ENABLED = "false";
    await expect(createEmbeddingForKnowledgeItem({ title: "A", content: "B" })).resolves.toBeNull();
  });
});
