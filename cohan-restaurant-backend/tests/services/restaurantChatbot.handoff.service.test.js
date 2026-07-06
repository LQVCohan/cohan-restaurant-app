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

const mkId = () => new mongoose.Types.ObjectId().toString();

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  hasPermission: vi.fn(async (user) => user?.canHandoff === true),
  requireAnyRestaurantPermission: vi.fn(),
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../src/services/notification/notificationWorkflow.service.js", () => ({
  createNotificationOnce: vi.fn(async (payload) => {
    const row = { _id: mkId(), ...payload };
    notifications.push(row);
    return row;
  }),
}));

vi.mock("../../models/index.js", () => {
  const AiChatConversation = {
    async findById(id) {
      const row = conversations.find((c) => String(c._id) === String(id));
      if (!row) return null;
      return { ...row, save: async function () { Object.assign(row, this); } };
    },
  };
  const AiChatMessage = {
    find(filter) {
      const rows = messages.filter((m) => String(m.conversationId) === String(filter.conversationId));
      return { sort: () => ({ limit: () => ({ lean: async () => rows.slice(-8) }) }) };
    },
  };
  const BrandMembership = {
    async distinct() { return membershipIds; },
  };
  const ChatThread = {
    async findById(id) { return threads.find((t) => String(t._id) === String(id)) || null; },
    async create(payload) {
      const row = { _id: mkId(), ...payload, save: async function () {} };
      threads.push(row);
      return row;
    },
  };
  const User = {
    find(filter) {
      userFindFilters.push(filter);
      return { select: () => ({ populate: () => ({ lean: async () => users }) }) };
    },
  };
  const Restaurant = {
    findById(id) {
      const row = restaurants.find((r) => String(r._id) === String(id)) || null;
      return { select: () => ({ lean: async () => row }) };
    },
  };
  return { AiChatConversation, AiChatMessage, BrandMembership, ChatThread, User, Restaurant };
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
    __resetAiChatbotRateLimitStoreForTests();
  });

  it("guest valid handoff notifies only eligible recipients", async () => {
    const convId = mkId();
    const restaurantId = mkId();
    const staffId = mkId();
    const deniedStaffId = mkId();
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId, status: "open", metadata: null });
    restaurants.push({ _id: restaurantId, aiChatbotSettings: { handoffEnabled: true } });
    messages.push({ conversationId: convId, role: "user", content: "help" });
    users.push(
      { _id: staffId, userType: "STAFF", canHandoff: true },
      { _id: deniedStaffId, userType: "STAFF", canHandoff: false },
    );

    const out = await requestRestaurantChatbotHandoff({
      input: { conversationId: convId, guestId: "guest_1", latestUserMessage: "Tôi cần hỗ trợ" },
    });

    expect(out.ok).toBe(true);
    expect(out.handoffRequested).toBe(true);
    expect(conversations[0].status).toBe("handoff_requested");
    expect(threads).toHaveLength(1);
    expect(threads[0].kind).toBe("ai_chatbot_handoff");
    expect((threads[0].participants || []).map(String)).toEqual([staffId]);
    expect((threads[0].unreadBy || []).map(String)).toEqual([staffId]);
    expect(threads[0].targetRole).toBeNull();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].toUserId).toBe(staffId);
    expect(notifications[0].payload).toMatchObject({
      title: "Khách hàng cần hỗ trợ",
      actionUrl: `/staff/ai-handoff?restaurantId=${restaurantId}&threadId=${threads[0]._id}`,
      conversationId: convId,
    });
    expect(notifications[0].sourceType).toBe("ai_chatbot_conversation");
    expect(String(notifications[0].sourceId)).toBe(convId);
    expect(userFindFilters[0]).toMatchObject({ status: "active", deletedAt: null });
  });

  it("duplicate handoff is idempotent", async () => {
    const threadId = mkId();
    const convId = mkId();
    const restaurantId = mkId();
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId, status: "handoff_requested", chatThreadId: threadId, metadata: {} });
    restaurants.push({ _id: restaurantId, aiChatbotSettings: { handoffEnabled: true } });
    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });
    expect(out.ok).toBe(true);
    expect(out.alreadyRequested).toBe(true);
    expect(out.chatThreadId).toBe(threadId);
    expect(threads.length).toBe(0);
  });

  it("mismatched guest cannot access conversation", async () => {
    const convId = mkId();
    conversations.push({ _id: convId, guestId: "guest_owner", restaurantId: mkId(), status: "open", metadata: null });
    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_other" } });
    expect(out.ok).toBe(false);
  });

  it("reused thread merges eligible recipients into participants and sets unreadBy", async () => {
    const convId = mkId();
    const restaurantId = mkId();
    const existingRecipient = mkId();
    const newRecipient = mkId();
    const threadId = mkId();
    const thread = {
      _id: threadId,
      participants: [new mongoose.Types.ObjectId(existingRecipient)],
      unreadBy: [],
      targetRole: "support",
      save: async function () {},
    };
    threads.push(thread);
    conversations.push({
      _id: convId,
      guestId: "guest_1",
      restaurantId,
      status: "open",
      chatThreadId: threadId,
      metadata: null,
    });
    restaurants.push({ _id: restaurantId, aiChatbotSettings: { handoffEnabled: true } });
    users.push(
      { _id: existingRecipient, userType: "STAFF", canHandoff: true },
      { _id: newRecipient, userType: "MANAGER", canHandoff: true },
    );

    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });

    expect(out.ok).toBe(true);
    expect(thread.kind).toBe("ai_chatbot_handoff");
    expect((thread.participants || []).map(String)).toContain(existingRecipient);
    expect((thread.participants || []).map(String)).toContain(newRecipient);
    expect((thread.unreadBy || []).map(String)).toContain(existingRecipient);
    expect((thread.unreadBy || []).map(String)).toContain(newRecipient);
    expect(thread.targetRole).toBeNull();
  });

  it("includes a permitted manager assigned through BrandMembership", async () => {
    const convId = mkId();
    const restaurantId = mkId();
    const brandId = mkId();
    const managerId = mkId();
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId, status: "open", metadata: null });
    restaurants.push({ _id: restaurantId, brandId, aiChatbotSettings: { handoffEnabled: true } });
    membershipIds.push(managerId);
    users.push({ _id: managerId, userType: "MANAGER", canHandoff: true });

    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });

    expect(out.ok).toBe(true);
    expect((threads[0].participants || []).map(String)).toContain(managerId);
    expect(notifications[0].payload.actionUrl).toBe(
      `/manager?restaurantId=${restaurantId}&threadId=${threads[0]._id}#ai-handoff`,
    );
  });

  it("returns unavailable without creating an orphan thread when no eligible recipient exists", async () => {
    const convId = mkId();
    const restaurantId = mkId();
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId, status: "open", metadata: null });
    restaurants.push({ _id: restaurantId, aiChatbotSettings: { handoffEnabled: true } });
    users.push({ _id: mkId(), userType: "STAFF", canHandoff: false });

    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });

    expect(out.ok).toBe(false);
    expect(out.handoffRequested).toBe(false);
    expect(out.message).toMatch(/chưa có nhân viên được phân quyền/i);
    expect(threads).toHaveLength(0);
    expect(notifications).toHaveLength(0);
  });
});
