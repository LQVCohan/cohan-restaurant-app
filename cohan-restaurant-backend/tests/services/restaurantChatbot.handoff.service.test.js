import { __resetAiChatbotRateLimitStoreForTests } from "../../src/services/ai/restaurantChatbotRateLimit.service.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const conversations = [];
const messages = [];
const threads = [];
const notifications = [];
const users = [];

const mkId = () => new mongoose.Types.ObjectId().toString();

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
  const ChatThread = {
    async findById(id) { return threads.find((t) => String(t._id) === String(id)) || null; },
    async create(payload) {
      const row = { _id: mkId(), ...payload, save: async function () {} };
      threads.push(row);
      return row;
    },
  };
  const Notification = {
    async insertMany(rows) { notifications.push(...rows); return rows; },
  };
  const User = {
    find() { return { select: () => ({ lean: async () => users }) }; },
  };
  return { AiChatConversation, AiChatMessage, ChatThread, Notification, User };
});

import { requestRestaurantChatbotHandoff } from "../../src/services/ai/restaurantChatbotHandoff.service.js";

describe("restaurantChatbot handoff service", () => {
  beforeEach(() => {
    conversations.length = 0; messages.length = 0; threads.length = 0; notifications.length = 0; users.length = 0;
    __resetAiChatbotRateLimitStoreForTests();
  });

  it("guest valid handoff sets status and creates thread", async () => {
    const convId = mkId();
    const restaurantId = mkId();
    const staffId = mkId();
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId, status: "open", metadata: null });
    messages.push({ conversationId: convId, role: "user", content: "help" });
    users.push({ _id: staffId, userType: "STAFF" });
    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });
    expect(out.ok).toBe(true);
    expect(out.handoffRequested).toBe(true);
    expect(conversations[0].status).toBe("handoff_requested");
    expect(conversations[0].chatThreadId).toBeTruthy();
    expect(threads.length).toBe(1);
    expect((threads[0].participants || []).map(String)).toContain(staffId);
    expect((threads[0].unreadBy || []).map(String)).toContain(staffId);
    expect(threads[0].targetRole).toBe("support");
  });

  it("duplicate handoff is idempotent", async () => {
    const threadId = mkId();
    const convId = mkId();
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId: mkId(), status: "handoff_requested", chatThreadId: threadId, metadata: {} });
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

  it("reused thread merges recipients into participants and sets unreadBy", async () => {
    const convId = mkId();
    const restaurantId = mkId();
    const existingRecipient = mkId();
    const newRecipient = mkId();
    const threadId = mkId();
    const thread = {
      _id: threadId,
      participants: [new mongoose.Types.ObjectId(existingRecipient)],
      unreadBy: [],
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
    users.push({ _id: existingRecipient, userType: "STAFF" }, { _id: newRecipient, userType: "MANAGER" });
    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });
    expect(out.ok).toBe(true);
    expect((thread.participants || []).map(String)).toContain(existingRecipient);
    expect((thread.participants || []).map(String)).toContain(newRecipient);
    expect((thread.unreadBy || []).map(String)).toContain(existingRecipient);
    expect((thread.unreadBy || []).map(String)).toContain(newRecipient);
    expect(thread.targetRole || "support").toBe("support");
  });

  it("fallback with no direct recipients sets manager role and keeps participants empty", async () => {
    const convId = mkId();
    const restaurantId = mkId();
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId, status: "open", metadata: null });
    messages.push({ conversationId: convId, role: "user", content: "need help" });

    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });
    expect(out.ok).toBe(true);
    expect(threads).toHaveLength(1);
    expect(threads[0].targetRole).toBe("manager");
    expect((threads[0].participants || []).map(String)).toEqual([]);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].toRole).toBe("manager");
  });
});
