import { __resetAiChatbotRateLimitStoreForTests } from "../../src/services/ai/restaurantChatbotRateLimit.service.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const conversations = [];
const messages = [];
const threads = [];
const notifications = [];
const users = [];
const restaurants = [];
const userFindFilters = [];
const membershipIds = [];
const membershipFilters = [];

const mkId = () => new mongoose.Types.ObjectId().toString();
const sameId = (left, right) => String(left || "") === String(right || "");
const matchesStatus = (status, expected) => {
  if (expected && typeof expected === "object") {
    if (Array.isArray(expected.$in)) return expected.$in.includes(status);
  }
  return status === expected;
};
const queryDoc = (row) => {
  if (!row) return null;
  const doc = {
    ...row,
    lean: async () => ({ ...row }),
    save: async function save() {
      Object.assign(row, this);
      return this;
    },
  };
  return doc;
};
const applyUpdate = (row, update = {}) => {
  if (update.$setOnInsert && !row.__existing) Object.assign(row, update.$setOnInsert);
  if (update.$set) Object.assign(row, update.$set);
  for (const [field, operation] of Object.entries(update.$addToSet || {})) {
    const current = Array.isArray(row[field]) ? row[field] : [];
    const values = Array.isArray(operation?.$each) ? operation.$each : [operation];
    const ids = new Set(current.map(String));
    row[field] = [...current, ...values.filter((value) => !ids.has(String(value)))];
  }
  row.__existing = true;
  return row;
};

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  hasPermission: vi.fn(async (user) => user?.canHandoff === true),
  requireAnyRestaurantPermission: vi.fn(),
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../src/services/notification/notificationWorkflow.service.js", () => ({
  createNotificationOnce: vi.fn(async (payload) => {
    const duplicate = notifications.find(
      (row) =>
        sameId(row.toUserId, payload.toUserId) &&
        sameId(row.sourceId, payload.sourceId) &&
        row.type === payload.type,
    );
    if (duplicate) return duplicate;
    const row = { _id: mkId(), ...payload };
    notifications.push(row);
    return row;
  }),
}));

vi.mock("../../models/index.js", () => {
  const AiChatConversation = {
    async findById(id) {
      return queryDoc(
        conversations.find((conversation) => sameId(conversation._id, id)),
      );
    },
    async findOneAndUpdate(filter, update) {
      const row = conversations.find(
        (conversation) =>
          sameId(conversation._id, filter._id) &&
          matchesStatus(conversation.status, filter.status),
      );
      if (!row) return null;
      applyUpdate(row, update);
      return queryDoc(row);
    },
    async updateOne(filter, update) {
      const row = conversations.find(
        (conversation) =>
          sameId(conversation._id, filter._id) &&
          (!filter.status || matchesStatus(conversation.status, filter.status)),
      );
      if (!row) return { modifiedCount: 0 };
      applyUpdate(row, update);
      return { modifiedCount: 1 };
    },
  };
  const AiChatMessage = {
    find(filter) {
      const rows = messages.filter((message) =>
        sameId(message.conversationId, filter.conversationId),
      );
      return {
        sort: () => ({ limit: () => ({ lean: async () => rows.slice(-8) }) }),
      };
    },
  };
  const BrandMembership = {
    async distinct(_field, filter) {
      membershipFilters.push(filter);
      return membershipIds;
    },
  };
  const ChatThread = {
    async findById(id) {
      return threads.find((thread) => sameId(thread._id, id)) || null;
    },
    async findOne(filter) {
      return (
        threads.find((thread) =>
          sameId(thread.sourceConversationId, filter.sourceConversationId),
        ) || null
      );
    },
    async findOneAndUpdate(filter, update, options = {}) {
      let row = threads.find((thread) => {
        if (filter._id && !sameId(thread._id, filter._id)) return false;
        if (
          filter.sourceConversationId &&
          !sameId(thread.sourceConversationId, filter.sourceConversationId)
        ) {
          return false;
        }
        if (filter.restaurantId && !sameId(thread.restaurantId, filter.restaurantId)) {
          return false;
        }
        if (filter.status && thread.status !== filter.status) return false;
        return true;
      });
      if (!row && options.upsert) {
        row = { _id: mkId(), ...(update.$setOnInsert || {}) };
        threads.push(row);
      }
      if (!row) return null;
      applyUpdate(row, update);
      return row;
    },
  };
  const User = {
    find(filter) {
      userFindFilters.push(filter);
      return {
        select: () => ({ populate: () => ({ lean: async () => users }) }),
      };
    },
  };
  const Restaurant = {
    findById(id) {
      const row = restaurants.find((restaurant) => sameId(restaurant._id, id));
      return { select: () => ({ lean: async () => row || null }) };
    },
  };
  return {
    AiChatConversation,
    AiChatMessage,
    BrandMembership,
    ChatThread,
    User,
    Restaurant,
  };
});

import { requestRestaurantChatbotHandoff } from "../../src/services/ai/restaurantChatbotHandoff.service.js";

describe("restaurantChatbot handoff service", () => {
  beforeEach(() => {
    conversations.length = 0;
    messages.length = 0;
    threads.length = 0;
    notifications.length = 0;
    users.length = 0;
    restaurants.length = 0;
    userFindFilters.length = 0;
    membershipIds.length = 0;
    membershipFilters.length = 0;
    __resetAiChatbotRateLimitStoreForTests();
  });

  const setupRecipient = ({ userType = "STAFF" } = {}) => {
    const restaurantId = mkId();
    const brandId = mkId();
    const recipientId = mkId();
    restaurants.push({
      _id: restaurantId,
      brandId,
      aiChatbotSettings: { handoffEnabled: true },
    });
    membershipIds.push(recipientId);
    users.push({
      _id: recipientId,
      userType,
      canHandoff: true,
    });
    return { restaurantId, brandId, recipientId };
  };

  it("creates one linked handoff thread and notifies eligible members", async () => {
    const { restaurantId, brandId, recipientId } = setupRecipient();
    const conversationId = mkId();
    conversations.push({
      _id: conversationId,
      guestId: "guest_1",
      restaurantId,
      status: "open",
      metadata: null,
    });
    messages.push({
      conversationId,
      role: "user",
      content: "help",
    });

    const result = await requestRestaurantChatbotHandoff({
      input: {
        conversationId,
        guestId: "guest_1",
        latestUserMessage: "Tôi cần hỗ trợ",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      handoffRequested: true,
      alreadyRequested: false,
    });
    expect(conversations[0]).toMatchObject({
      status: "handoff_requested",
      chatThreadId: threads[0]._id,
    });
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      sourceConversationId: conversationId,
      restaurantId,
      kind: "ai_chatbot_handoff",
      status: "open",
      targetRole: null,
    });
    expect((threads[0].participants || []).map(String)).toEqual([recipientId]);
    expect((threads[0].unreadBy || []).map(String)).toEqual([recipientId]);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].payload).toMatchObject({
      actionUrl: `/staff/ai-handoff?restaurantId=${restaurantId}&threadId=${threads[0]._id}`,
      conversationId,
    });
    expect(membershipFilters[0]).toMatchObject({ brandId, status: "active" });
  });

  it("converges repeated requests on the same active thread", async () => {
    const { restaurantId } = setupRecipient();
    const conversationId = mkId();
    conversations.push({
      _id: conversationId,
      guestId: "guest_1",
      restaurantId,
      status: "open",
      metadata: {},
    });

    const first = await requestRestaurantChatbotHandoff({
      input: { conversationId, guestId: "guest_1" },
    });
    const second = await requestRestaurantChatbotHandoff({
      input: { conversationId, guestId: "guest_1" },
    });

    expect(first.ok).toBe(true);
    expect(second).toMatchObject({
      ok: true,
      alreadyRequested: true,
      chatThreadId: first.chatThreadId,
    });
    expect(threads).toHaveLength(1);
    expect(notifications).toHaveLength(1);
  });

  it("rejects a resolved conversation instead of reopening its thread", async () => {
    const { restaurantId } = setupRecipient();
    const conversationId = mkId();
    const threadId = mkId();
    conversations.push({
      _id: conversationId,
      guestId: "guest_1",
      restaurantId,
      status: "closed",
      chatThreadId: threadId,
    });
    threads.push({
      _id: threadId,
      sourceConversationId: conversationId,
      restaurantId,
      kind: "ai_chatbot_handoff",
      status: "closed",
    });

    const result = await requestRestaurantChatbotHandoff({
      input: { conversationId, guestId: "guest_1" },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/đã kết thúc/i);
    expect(threads).toHaveLength(1);
    expect(threads[0].status).toBe("closed");
    expect(notifications).toHaveLength(0);
  });

  it("repairs a missing legacy link before creating one active thread", async () => {
    const { restaurantId } = setupRecipient();
    const conversationId = mkId();
    conversations.push({
      _id: conversationId,
      guestId: "guest_1",
      restaurantId,
      status: "handoff_requested",
      chatThreadId: mkId(),
      metadata: {},
    });

    const result = await requestRestaurantChatbotHandoff({
      input: { conversationId, guestId: "guest_1" },
    });

    expect(result.ok).toBe(true);
    expect(threads).toHaveLength(1);
    expect(conversations[0].status).toBe("handoff_requested");
    expect(String(conversations[0].chatThreadId)).toBe(String(threads[0]._id));
  });

  it("closes a stale handoff conversation when its linked thread is closed", async () => {
    const { restaurantId } = setupRecipient();
    const conversationId = mkId();
    const threadId = mkId();
    conversations.push({
      _id: conversationId,
      guestId: "guest_1",
      restaurantId,
      status: "handoff_requested",
      chatThreadId: threadId,
      metadata: {},
    });
    threads.push({
      _id: threadId,
      sourceConversationId: conversationId,
      restaurantId,
      kind: "ai_chatbot_handoff",
      status: "closed",
      messages: [{ content: "[AI HANDOFF]" }],
    });

    const result = await requestRestaurantChatbotHandoff({
      input: { conversationId, guestId: "guest_1" },
    });

    expect(result.ok).toBe(false);
    expect(conversations[0].status).toBe("closed");
    expect(notifications).toHaveLength(0);
  });

  it("rejects mismatched guest ownership", async () => {
    const conversationId = mkId();
    conversations.push({
      _id: conversationId,
      guestId: "guest_owner",
      restaurantId: mkId(),
      status: "open",
    });

    const result = await requestRestaurantChatbotHandoff({
      input: { conversationId, guestId: "guest_other" },
    });

    expect(result.ok).toBe(false);
  });

  it("returns unavailable without creating an orphan thread when no recipient exists", async () => {
    const restaurantId = mkId();
    const brandId = mkId();
    const conversationId = mkId();
    conversations.push({
      _id: conversationId,
      guestId: "guest_1",
      restaurantId,
      status: "open",
    });
    restaurants.push({
      _id: restaurantId,
      brandId,
      aiChatbotSettings: { handoffEnabled: true },
    });

    const result = await requestRestaurantChatbotHandoff({
      input: { conversationId, guestId: "guest_1" },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/chưa có nhân viên được phân quyền/i);
    expect(threads).toHaveLength(0);
    expect(notifications).toHaveLength(0);
  });
});
