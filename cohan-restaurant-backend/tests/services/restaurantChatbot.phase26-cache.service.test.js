import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: (...args) => permissionSpy(...args),
}));

import { Restaurant, AiChatbotKnowledgeItem } from "../../models/index.js";
import {
  getPublicAiChatbotSettings,
  getRestaurantAiChatbotSettings,
  updateRestaurantAiChatbotSettings,
} from "../../src/services/ai/restaurantChatbotSettings.service.js";
import {
  bulkDeleteRestaurantAiChatbotKnowledge,
  bulkUpdateRestaurantAiChatbotKnowledgeEnabled,
  createRestaurantAiChatbotKnowledgeItem,
  deleteRestaurantAiChatbotKnowledgeItem,
  findRelevantKnowledgeForChatbot,
  importRestaurantAiChatbotKnowledge,
  updateRestaurantAiChatbotKnowledgeItem,
} from "../../src/services/ai/restaurantChatbotKnowledge.service.js";
import {
  clearAiChatbotCache,
  getAiChatbotCache,
  getAiChatbotCacheStats,
  setAiChatbotCache,
} from "../../src/services/ai/restaurantChatbotCache.service.js";
import { __testables } from "../../src/services/ai/restaurantChatbot.service.js";

const rid = new mongoose.Types.ObjectId().toString();
const uid = new mongoose.Types.ObjectId().toString();
const ctx = { user: { _id: uid, roleName: "manager" } };

const query = (value) => ({
  sort: vi.fn(() => query(value)),
  limit: vi.fn(() => query(value)),
  lean: vi.fn(async () => value),
});

const findByIdSelect = (value) => ({
  select: vi.fn(() => ({ lean: vi.fn(async () => value) })),
});

const knowledgeDoc = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  restaurantId: new mongoose.Types.ObjectId(rid),
  title: "Giờ mở cửa",
  content: "Nhà hàng mở cửa 8h-22h",
  tags: ["hours"],
  enabled: true,
  priority: 10,
  sourceType: "manual",
  ...overrides,
});

describe("restaurant chatbot Phase 26 settings and knowledge cache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAiChatbotCache();
    permissionSpy.mockReset();
    permissionSpy.mockResolvedValue(true);
  });

  it("getPublicAiChatbotSettings uses cache on repeated call", async () => {
    const findByIdSpy = vi.spyOn(Restaurant, "findById").mockReturnValue(findByIdSelect({ businessStatus: "active", publicationStatus: "published", aiChatbotSettings: { welcomeMessage: "cached hello" } }));

    const first = await getPublicAiChatbotSettings({ restaurantId: rid });
    const second = await getPublicAiChatbotSettings({ restaurantId: rid });

    expect(first.welcomeMessage).toBe("cached hello");
    expect(second.welcomeMessage).toBe("cached hello");
    expect(findByIdSpy).toHaveBeenCalledTimes(1);
  });

  it("updateRestaurantAiChatbotSettings invalidates public and private settings cache after a successful save", async () => {
    setAiChatbotCache(`ai:settings:public:${rid}`, { welcomeMessage: "old public" }, 60_000);
    setAiChatbotCache(`ai:settings:private:${rid}`, { welcomeMessage: "old private" }, 60_000);
    const restaurantDoc = { aiChatbotSettings: { welcomeMessage: "new" }, save: vi.fn().mockResolvedValue(true) };
    vi.spyOn(Restaurant, "findById").mockReturnValue({ select: () => Promise.resolve(restaurantDoc) });

    await updateRestaurantAiChatbotSettings({ input: { restaurantId: rid, welcomeMessage: "new" }, ctx });

    expect(getAiChatbotCache(`ai:settings:public:${rid}`)).toBeUndefined();
    expect(getAiChatbotCache(`ai:settings:private:${rid}`)).toBeUndefined();
  });

  it("findRelevantKnowledgeForChatbot uses cache for same restaurant/message/limit", async () => {
    const row = knowledgeDoc({ content: "Có buffet chay vào cuối tuần" });
    const findSpy = vi.spyOn(AiChatbotKnowledgeItem, "find")
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([row]));

    const first = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "buffet chay", limit: 4 });
    const second = await findRelevantKnowledgeForChatbot({ restaurantId: rid, message: "  BUFFET CHAY  ", limit: 4 });

    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(findSpy).toHaveBeenCalledTimes(2);
  });

  it("create/update/delete knowledge invalidates relevant knowledge cache", async () => {
    const key = `ai:knowledge:relevant:${rid}:4:test`;
    setAiChatbotCache(key, [knowledgeDoc()], 300_000);
    vi.spyOn(AiChatbotKnowledgeItem, "create").mockResolvedValue({ toObject: () => knowledgeDoc() });
    await createRestaurantAiChatbotKnowledgeItem({ input: { restaurantId: rid, title: "A", content: "B" }, ctx });
    expect(getAiChatbotCache(key)).toBeUndefined();

    setAiChatbotCache(key, [knowledgeDoc()], 300_000);
    const updatable = { ...knowledgeDoc(), save: vi.fn().mockResolvedValue(true), toObject() { return this; } };
    vi.spyOn(AiChatbotKnowledgeItem, "findById").mockResolvedValue(updatable);
    await updateRestaurantAiChatbotKnowledgeItem({ input: { id: String(updatable._id), title: "Updated" }, ctx });
    expect(getAiChatbotCache(key)).toBeUndefined();

    setAiChatbotCache(key, [knowledgeDoc()], 300_000);
    vi.spyOn(AiChatbotKnowledgeItem, "findById").mockReturnValue({ lean: vi.fn(async () => knowledgeDoc({ _id: updatable._id })) });
    vi.spyOn(AiChatbotKnowledgeItem, "deleteOne").mockResolvedValue({ deletedCount: 1 });
    await deleteRestaurantAiChatbotKnowledgeItem({ id: String(updatable._id), ctx });
    expect(getAiChatbotCache(key)).toBeUndefined();
  });

  it("import/bulk update/bulk delete invalidates relevant knowledge cache", async () => {
    const key = `ai:knowledge:relevant:${rid}:4:test`;
    const row = knowledgeDoc();

    setAiChatbotCache(key, [row], 300_000);
    vi.spyOn(AiChatbotKnowledgeItem, "findOne").mockReturnValue({ lean: vi.fn(async () => null) });
    vi.spyOn(AiChatbotKnowledgeItem, "create").mockResolvedValue({ toObject: () => row });
    await importRestaurantAiChatbotKnowledge({ input: { restaurantId: rid, format: "json", payload: JSON.stringify([{ title: "A", content: "B" }]) }, ctx });
    expect(getAiChatbotCache(key)).toBeUndefined();

    setAiChatbotCache(key, [row], 300_000);
    vi.spyOn(AiChatbotKnowledgeItem, "find").mockReturnValue({ lean: vi.fn(async () => [row]) });
    vi.spyOn(AiChatbotKnowledgeItem, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    await bulkUpdateRestaurantAiChatbotKnowledgeEnabled({ ids: [String(row._id)], enabled: false, ctx });
    expect(getAiChatbotCache(key)).toBeUndefined();

    setAiChatbotCache(key, [row], 300_000);
    vi.spyOn(AiChatbotKnowledgeItem, "find").mockReturnValue({ lean: vi.fn(async () => [row]) });
    vi.spyOn(AiChatbotKnowledgeItem, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    await bulkDeleteRestaurantAiChatbotKnowledge({ ids: [String(row._id)], ctx });
    expect(getAiChatbotCache(key)).toBeUndefined();
  });

  it("does not cache user-specific context", () => {
    const source = readUserSpecificSource();
    expect(source).toContain("deliberately does not cache order/cart/reservation/profile context");
    expect(source).toContain("AiChatConversation/AiChatMessage data includes guest/user identifiers");
    expect(__testables.buildUserSafeProfile({ id: uid, email: "a@example.com", token: "secret" })).not.toHaveProperty("token");
    expect(getAiChatbotCacheStats().entries).toBe(0);
  });
});

function readUserSpecificSource() {
  return readFileSync(new URL("../../src/services/ai/restaurantChatbot.service.js", import.meta.url), "utf8");
}
