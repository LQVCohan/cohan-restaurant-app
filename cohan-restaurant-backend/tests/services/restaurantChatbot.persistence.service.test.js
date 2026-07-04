import { __resetAiChatbotRateLimitStoreForTests } from "../../src/services/ai/restaurantChatbotRateLimit.service.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const conversationStore = [];
const messageStore = [];

const makeId = (seed = "") => `${seed}${Math.random().toString(16).slice(2, 10)}`;

vi.mock("../../models/index.js", () => {
  const AiChatConversation = {
    async findById(id) {
      return conversationStore.find((c) => String(c._id) === String(id)) || null;
    },
    findOne(filter) {
      return {
        sort: async () =>
          conversationStore
            .filter((c) =>
              c.status === filter.status &&
              String(c.restaurantId || "") === String(filter.restaurantId || "") &&
              (filter.userId ? String(c.userId || "") === String(filter.userId) : String(c.guestId || "") === String(filter.guestId || ""))
            )
            .slice(-1)[0] || null,
      };
    },
    async create(payload) {
      const item = { _id: makeId("conv_"), status: "open", ...payload, updatedAt: new Date() };
      conversationStore.push(item);
      return item;
    },
    async updateOne(query, update) {
      const found = conversationStore.find((c) => String(c._id) === String(query._id));
      if (!found) return;
      Object.assign(found, update.$set || {});
      found.messageCount = (found.messageCount || 0) + Number(update.$inc?.messageCount || 0);
    },
  };

  const AiChatMessage = {
    async create(payload) {
      messageStore.push({ _id: makeId("msg_"), ...payload });
      return payload;
    },
    find(filter) {
      const rows = messageStore.filter((m) => String(m.conversationId) === String(filter.conversationId));
      return {
        sort: () => ({
          limit: () => ({
            lean: async () => rows,
          }),
        }),
      };
    },
  };

  const noopQuery = () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }), lean: async () => [] }), limit: () => ({ lean: async () => [] }), lean: async () => [] });

  return {
    Coupon: { find: noopQuery },
    MenuItem: { find: noopQuery },
    Order: { find: noopQuery },
    Reservation: { find: noopQuery },
    Restaurant: {
      findById: (id) => ({
        lean: async () => ({
          _id: String(id),
          name: `Restaurant ${String(id).slice(-4)}`,
          businessStatus: "active",
          publicationStatus: "published",
          aiChatbotSettings: { enabled: true },
          defaultCurrency: "VND",
        }),
        select() { return this; },
      }),
      find: noopQuery,
    },
    AiChatConversation,
    AiChatMessage,
    AiChatbotSafetyRule: { find: noopQuery },
    AiChatbotKnowledgeItem: { find: noopQuery },
  };


});

import { handleRestaurantChatbotMessage } from "../../src/services/ai/restaurantChatbot.service.js";

describe("restaurantChatbot persistence", () => {
  beforeEach(() => {
    conversationStore.length = 0;
    messageStore.length = 0;
    __resetAiChatbotRateLimitStoreForTests();
    delete process.env.OPENAI_API_KEY;
  });

  it("creates conversation and stores user/assistant messages for guest", async () => {
    const out = await handleRestaurantChatbotMessage({ message: "Xin chào", guestId: "guest_1" });
    expect(out.conversationId).toBeTruthy();
    expect(messageStore.length).toBe(2);
  });

  it("reuses same conversation for follow-up", async () => {
    const first = await handleRestaurantChatbotMessage({ message: "A", guestId: "guest_2" });
    const second = await handleRestaurantChatbotMessage({ message: "B", guestId: "guest_2", conversationId: first.conversationId });
    expect(second.conversationId).toBe(first.conversationId);
  });

  it("does not leak mismatched conversationId", async () => {
    const first = await handleRestaurantChatbotMessage({ message: "A", guestId: "guest_3" });
    const second = await handleRestaurantChatbotMessage({ message: "B", guestId: "guest_4", conversationId: first.conversationId });
    expect(second.conversationId).not.toBe(first.conversationId);
  });

  it("does not duplicate current user message in OpenAI prompt history", async () => {
    delete process.env.OPENAI_API_KEY;
    const first = await handleRestaurantChatbotMessage({ message: "Lịch sử cũ", guestId: "guest_hist" });

    process.env.OPENAI_API_KEY = "test_key";
    const fetchMock = vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      const userMessages = body.messages.filter((m) => m.role === "user").map((m) => m.content);
      expect(userMessages).toEqual(["Lịch sử cũ", "Tin nhắn mới"]);
      expect(userMessages.filter((message) => message === "Tin nhắn mới")).toHaveLength(1);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ answer: "OK", intent: "general", confidence: 0.8, quickReplies: [], actions: [], sources: [] }) } }],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await handleRestaurantChatbotMessage({
      message: "Tin nhắn mới",
      guestId: "guest_hist",
      conversationId: first.conversationId,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });


  it("rate limits askAiChatbot over limit and avoids persistence side effects", async () => {
    const guestId = "guest_rl";
    for (let i = 0; i < 20; i += 1) {
      const out = await handleRestaurantChatbotMessage({ message: `m_${i}`, guestId, restaurantId: "507f1f77bcf86cd799439011", clientIp: "1.2.3.4" });
      expect(out.answer).toBeTruthy();
    }

    const messageCountBefore = messageStore.length;
    await expect(
      handleRestaurantChatbotMessage({ message: "blocked", guestId, restaurantId: "507f1f77bcf86cd799439011", clientIp: "1.2.3.4" })
    ).rejects.toMatchObject({ code: "RATE_LIMITED", message: "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút." });
    expect(messageStore.length).toBe(messageCountBefore);
  });

  it("isolates askAiChatbot limits by guest/conversation/restaurant/ip key parts", async () => {
    const guestId = "guest_iso";
    for (let i = 0; i < 20; i += 1) {
      await handleRestaurantChatbotMessage({ message: `a_${i}`, guestId, restaurantId: "507f1f77bcf86cd7994390aa", clientIp: "2.2.2.2" });
    }
    await expect(
      handleRestaurantChatbotMessage({ message: "blocked", guestId, restaurantId: "507f1f77bcf86cd7994390aa", clientIp: "2.2.2.2" })
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    await expect(
      handleRestaurantChatbotMessage({ message: "allowed-other-ip", guestId, restaurantId: "507f1f77bcf86cd7994390aa", clientIp: "2.2.2.3" })
    ).resolves.toHaveProperty("answer");

    await expect(
      handleRestaurantChatbotMessage({ message: "allowed-other-restaurant", guestId, restaurantId: "507f1f77bcf86cd7994390bb", clientIp: "2.2.2.2" })
    ).resolves.toHaveProperty("answer");
  });

});
