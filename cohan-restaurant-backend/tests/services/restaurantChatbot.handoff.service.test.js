import { beforeEach, describe, expect, it, vi } from "vitest";

const conversations = [];
const messages = [];
const threads = [];
const notifications = [];
const users = [];

const mkId = (seed) => `${seed}${Math.random().toString(16).slice(2, 10)}`;

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
      const row = { _id: mkId("thread_"), ...payload, save: async function () {} };
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
  });

  it("guest valid handoff sets status and creates thread", async () => {
    const convId = mkId("conv_");
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId: mkId("rest_"), status: "open", metadata: null });
    messages.push({ conversationId: convId, role: "user", content: "help" });
    users.push({ _id: mkId("u_"), userType: "STAFF" });
    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });
    expect(out.ok).toBe(true);
    expect(out.handoffRequested).toBe(true);
    expect(conversations[0].status).toBe("handoff_requested");
    expect(conversations[0].chatThreadId).toBeTruthy();
    expect(threads.length).toBe(1);
  });

  it("duplicate handoff is idempotent", async () => {
    const threadId = mkId("thread_");
    const convId = mkId("conv_");
    conversations.push({ _id: convId, guestId: "guest_1", restaurantId: mkId("rest_"), status: "handoff_requested", chatThreadId: threadId, metadata: {} });
    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_1" } });
    expect(out.ok).toBe(true);
    expect(out.alreadyRequested).toBe(true);
    expect(out.chatThreadId).toBe(threadId);
  });

  it("mismatched guest cannot access conversation", async () => {
    const convId = mkId("conv_");
    conversations.push({ _id: convId, guestId: "guest_owner", restaurantId: mkId("rest_"), status: "open", metadata: null });
    const out = await requestRestaurantChatbotHandoff({ input: { conversationId: convId, guestId: "guest_other" } });
    expect(out.ok).toBe(false);
  });
});
