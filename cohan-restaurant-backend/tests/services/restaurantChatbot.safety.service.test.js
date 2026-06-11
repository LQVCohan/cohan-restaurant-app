import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionSpy = vi.fn();
const anyRestaurantPermissionSpy = vi.fn();
const store = [];
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: (...args) => permissionSpy(...args),
  requireAnyRestaurantPermission: (...args) => anyRestaurantPermissionSpy(...args),
}));
vi.mock("../../models/index.js", () => {
  const wrap = (b) => ({ ...b, async save() { return this; }, toObject() { return { ...this }; } });
  return {
    AiChatbotSafetyRule: {
      async create(payload) { const d = wrap({ _id: new mongoose.Types.ObjectId(), ...payload }); store.push(d); return d; },
      find(query) {
        let rows = store.filter((x) => String(x.restaurantId) === String(query.restaurantId));
        if (query.enabled != null) rows = rows.filter((x) => x.enabled === query.enabled);
        if (query.ruleType) rows = rows.filter((x) => x.ruleType === query.ruleType);
        return { sort: () => ({ lean: async () => rows }) };
      },
      findById(id) { const row = store.find((x) => String(x._id) === String(id)); if (!row) return null; return { ...row, lean: async () => ({ ...row }), async save() { return this; }, toObject() { return { ...this }; } }; },
      async deleteOne(q) { const i = store.findIndex((x) => String(x._id) === String(q._id)); if (i>=0) store.splice(i,1); },
    },
  };
});

import { PERMISSIONS } from "../../src/constants/permissions.js";
import { createRestaurantAiChatbotSafetyRule, listRestaurantAiChatbotSafetyRules, evaluateRestaurantAiChatbotSafety, deleteRestaurantAiChatbotSafetyRule } from "../../src/services/ai/restaurantChatbotSafety.service.js";

const rid = new mongoose.Types.ObjectId().toString();
beforeEach(() => {
  store.length = 0;
  permissionSpy.mockReset(); permissionSpy.mockResolvedValue(true);
  anyRestaurantPermissionSpy.mockReset(); anyRestaurantPermissionSpy.mockResolvedValue(true);
});

describe("restaurantChatbotSafety service", () => {
  it("create/list dto id strings + permission", async () => {
    const row = await createRestaurantAiChatbotSafetyRule({ input: { restaurantId: rid, ruleType: "blocked_topic", pattern: "abc", priority: 150 }, ctx: { user: { _id: new mongoose.Types.ObjectId().toString() } } });
    expect(row.restaurantId).toBe(rid); expect(typeof row.id).toBe("string"); expect(row.priority).toBe(100);
    expect(permissionSpy).toHaveBeenCalledWith(expect.anything(), rid, PERMISSIONS.AI_CHATBOT_MODERATE);
    await listRestaurantAiChatbotSafetyRules({ restaurantId: rid, filter: {}, ctx: { user: { _id: "u" } } });
    expect(anyRestaurantPermissionSpy).toHaveBeenCalledWith(expect.anything(), rid, [PERMISSIONS.AI_CHATBOT_MODERATE, PERMISSIONS.AI_CHATBOT_WRITE]);
  });
  it("reject write without permission", async () => {
    permissionSpy.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(createRestaurantAiChatbotSafetyRule({ input: { restaurantId: rid, ruleType: "blocked_topic", pattern: "abc" }, ctx: { user: { _id: "u" } } })).rejects.toThrow("FORBIDDEN");
  });
  it("evaluate blocked/handoff/disabled/safe regex", async () => {
    const u = { user: { _id: new mongoose.Types.ObjectId().toString() } };
    const b = await createRestaurantAiChatbotSafetyRule({ input: { restaurantId: rid, ruleType: "blocked_topic", pattern: "C++", responseMessage: "no" }, ctx: u });
    await createRestaurantAiChatbotSafetyRule({ input: { restaurantId: rid, ruleType: "handoff_topic", pattern: "khiếu nại", responseMessage: "handoff", enabled: true }, ctx: u });
    await createRestaurantAiChatbotSafetyRule({ input: { restaurantId: rid, ruleType: "handoff_topic", pattern: "ignore", enabled: false }, ctx: u });
    const e1 = await evaluateRestaurantAiChatbotSafety({ restaurantId: rid, message: "toi hoi C++" });
    expect(e1.blocked).toBe(true);
    const e2 = await evaluateRestaurantAiChatbotSafety({ restaurantId: rid, message: "toi muốn khiếu nại" });
    expect(e2.handoffSuggested).toBe(true);
    await createRestaurantAiChatbotSafetyRule({ input: { restaurantId: rid, ruleType: "blocked_topic", pattern: "zzz-disabled", enabled: false }, ctx: u });
    const e3 = await evaluateRestaurantAiChatbotSafety({ restaurantId: rid, message: "zzz-disabled" });
    expect(e3.blocked).toBe(false);
    await expect(deleteRestaurantAiChatbotSafetyRule({ id: b.id, ctx: u })).resolves.toBe(true);
  });
});