import { __resetAiChatbotRateLimitStoreForTests } from "../../src/services/ai/restaurantChatbotRateLimit.service.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiChatConversation,
  ChatThread,
  User,
  Notification,
  Restaurant,
  BrandMembership,
} from "../../models/index.js";

const {
  toGuestStaffReplies,
  getRestaurantChatbotGuestReplies,
  sendRestaurantChatbotGuestMessage,
} = await import(
  "../../src/services/ai/restaurantChatbotGuestReplies.service.js"
);

const CONVERSATION_ID = "507f1f77bcf86cd799439011";
const THREAD_ID = "507f1f77bcf86cd799439012";
const RESTAURANT_ID = "507f1f77bcf86cd799439013";
const baseDate = new Date("2026-05-20T10:00:00.000Z");

const makeConversation = (patch = {}) => ({
  _id: CONVERSATION_ID,
  guestId: "guest_abc",
  restaurantId: RESTAURANT_ID,
  status: "handoff_requested",
  chatThreadId: THREAD_ID,
  ...patch,
});
const makeThread = (patch = {}) => ({
  _id: THREAD_ID,
  restaurantId: RESTAURANT_ID,
  channel: "support",
  kind: "ai_chatbot_handoff",
  subject: "AI handoff - Khách cần hỗ trợ",
  status: "open",
  targetRole: null,
  participants: ["507f1f77bcf86cd799439099"],
  unreadBy: [],
  messages: [{ senderRole: "system", content: "[AI HANDOFF]" }],
  ...patch,
});

const leanQuery = (value) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

describe("toGuestStaffReplies", () => {
  it("maps only guest-safe staff replies", () => {
    const rows = toGuestStaffReplies({
      messages: [
        {
          _id: "staff",
          senderRole: "server",
          senderId: "u1",
          content: "Xin chào",
          createdAt: baseDate,
        },
        {
          _id: "system",
          senderRole: "system",
          senderName: "AI",
          content: "[AI HANDOFF] summary",
          createdAt: baseDate,
        },
        {
          _id: "guest",
          senderRole: "guest",
          content: "Ẩn",
          createdAt: baseDate,
        },
      ],
    });

    expect(rows).toEqual([
      {
        id: "staff",
        role: "staff",
        senderLabel: "Nhân viên",
        content: "Xin chào",
        createdAt: baseDate.toISOString(),
      },
    ]);
  });

  it("filters by cursor and clamps the result limit", () => {
    const messages = Array.from({ length: 70 }, (_, index) => ({
      _id: `id_${index}`,
      senderRole: "staff",
      senderId: "u1",
      content: `m_${index}`,
      createdAt: new Date(baseDate.getTime() + index * 1000),
    }));

    const rows = toGuestStaffReplies({
      messages,
      after: new Date(baseDate.getTime() + 10_000).toISOString(),
      limit: 500,
    });

    expect(rows).toHaveLength(50);
    expect(rows[0].id).toBe("id_20");
    expect(rows.at(-1).id).toBe("id_69");
  });
});

describe("getRestaurantChatbotGuestReplies", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetAiChatbotRateLimitStoreForTests();
  });

  it("returns staff replies for a valid open linked thread", async () => {
    vi.spyOn(AiChatConversation, "findById").mockReturnValue(
      leanQuery(makeConversation()),
    );
    vi.spyOn(ChatThread, "findById").mockReturnValue(
      leanQuery(
        makeThread({
          messages: [
            {
              _id: "m1",
              senderRole: "server",
              senderId: "u1",
              content: "Xin chào",
              createdAt: baseDate,
            },
          ],
        }),
      ),
    );

    const result = await getRestaurantChatbotGuestReplies({
      input: {
        conversationId: CONVERSATION_ID,
        guestId: "guest_abc",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      handoffRequested: true,
      handoffClosed: false,
      conversationStatus: "handoff_requested",
    });
    expect(result.replies).toHaveLength(1);
  });

  it("reports the handoff closed when either persisted side is closed", async () => {
    vi.spyOn(AiChatConversation, "findById").mockReturnValue(
      leanQuery(makeConversation()),
    );
    vi.spyOn(ChatThread, "findById").mockReturnValue(
      leanQuery(makeThread({ status: "closed" })),
    );

    const result = await getRestaurantChatbotGuestReplies({
      input: {
        conversationId: CONVERSATION_ID,
        guestId: "guest_abc",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      handoffRequested: false,
      handoffClosed: true,
      conversationStatus: "closed",
    });
  });

  it("returns a safe empty response for invalid ownership", async () => {
    vi.spyOn(AiChatConversation, "findById").mockReturnValue(
      leanQuery(makeConversation({ guestId: "guest_real" })),
    );

    const result = await getRestaurantChatbotGuestReplies({
      input: {
        conversationId: CONVERSATION_ID,
        guestId: "guest_other",
      },
    });

    expect(result).toEqual({
      ok: false,
      handoffRequested: false,
      conversationStatus: null,
      handoffClosed: false,
      conversationId: CONVERSATION_ID,
      replies: [],
    });
  });
});

describe("sendRestaurantChatbotGuestMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetAiChatbotRateLimitStoreForTests();
    vi.spyOn(Restaurant, "findById").mockReturnValue(
      leanQuery(null),
    );
    vi.spyOn(BrandMembership, "find").mockReturnValue(
      leanQuery([]),
    );
    vi.spyOn(User, "find").mockReturnValue(leanQuery([]));
    vi.spyOn(Notification, "insertMany").mockResolvedValue([]);
  });

  const setupValidSend = (threadPatch = {}, conversationPatch = {}) => {
    const conversation = makeConversation(conversationPatch);
    const thread = makeThread(threadPatch);
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue(conversation);
    vi.spyOn(ChatThread, "findById").mockResolvedValue(thread);
    vi.spyOn(ChatThread, "findOneAndUpdate").mockImplementation(
      async (_filter, update) => {
        if (thread.status !== "open") return null;
        thread.messages.push(update.$push.messages);
        thread.lastMessageAt = update.$set.lastMessageAt;
        thread.lastMessagePreview = update.$set.lastMessagePreview;
        const current = new Set((thread.unreadBy || []).map(String));
        const incoming = update.$addToSet.unreadBy.$each || [];
        thread.unreadBy = [
          ...(thread.unreadBy || []),
          ...incoming.filter((id) => !current.has(String(id))),
        ];
        return thread;
      },
    );
    return { conversation, thread };
  };

  it("atomically appends a guest message to an open handoff thread", async () => {
    const { thread } = setupValidSend();

    const result = await sendRestaurantChatbotGuestMessage({
      input: {
        conversationId: CONVERSATION_ID,
        guestId: "guest_abc",
        content: "Xin chào nhân viên",
      },
    });

    expect(result.ok).toBe(true);
    expect(ChatThread.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: THREAD_ID,
        restaurantId: RESTAURANT_ID,
        status: "open",
      }),
      expect.objectContaining({
        $push: {
          messages: expect.objectContaining({
            senderRole: "guest",
            content: "Xin chào nhân viên",
          }),
        },
      }),
      { new: true },
    );
    expect(thread.messages.at(-1).content).toBe("Xin chào nhân viên");
  });

  it.each([
    ["closed thread", { status: "closed" }, {}, false],
    [
      "wrong restaurant",
      { restaurantId: "507f1f77bcf86cd799439077" },
      {},
      false,
    ],
    ["wrong kind", { kind: "standard", subject: "Other", messages: [] }, {}, false],
    ["closed conversation", {}, { status: "closed" }, false],
  ])("rejects %s", async (_label, threadPatch, conversationPatch) => {
    setupValidSend(threadPatch, conversationPatch);

    const result = await sendRestaurantChatbotGuestMessage({
      input: {
        conversationId: CONVERSATION_ID,
        guestId: "guest_abc",
        content: "Tin mới",
      },
    });

    expect(result.ok).toBe(false);
    expect(ChatThread.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects a write conflict when the thread closes before append", async () => {
    setupValidSend();
    ChatThread.findOneAndUpdate.mockResolvedValueOnce(null);

    const result = await sendRestaurantChatbotGuestMessage({
      input: {
        conversationId: CONVERSATION_ID,
        guestId: "guest_abc",
        content: "Tin mới",
      },
    });

    expect(result.ok).toBe(false);
  });

  it("keeps the saved message successful when notification or socket delivery fails", async () => {
    setupValidSend();
    vi.spyOn(Notification, "insertMany").mockRejectedValue(new Error("db down"));

    const result = await sendRestaurantChatbotGuestMessage({
      input: {
        conversationId: CONVERSATION_ID,
        guestId: "guest_abc",
        content: "Xin chào nhân viên",
      },
      io: {
        to: () => ({
          emit: () => {
            throw new Error("socket issue");
          },
        }),
      },
    });

    expect(result.ok).toBe(true);
  });
});

describe("resolveChatRecipientIdsByRole", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes direct staff by restaurantForStaff", async () => {
    const { resolveChatRecipientIdsByRole } = await import(
      "../../src/services/communication/chatRecipientScope.service.js"
    );
    vi.spyOn(User, "find").mockReturnValue(
      leanQuery([{ _id: "staff-r1" }]),
    );

    const ids = await resolveChatRecipientIdsByRole({
      targetRole: "staff",
      restaurantId: "r1",
      senderId: "guest:g1",
    });

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        userType: "STAFF",
        restaurantForStaff: "r1",
        status: "active",
        deletedAt: null,
      }),
    );
    expect(ids).toEqual(["staff-r1"]);
  });

  it("routes management handoff through active BrandMembership", async () => {
    const { resolveChatRecipientIdsByRole } = await import(
      "../../src/services/communication/chatRecipientScope.service.js"
    );
    vi.spyOn(Restaurant, "findById").mockReturnValue(
      leanQuery({ _id: "r1", brandId: "b1" }),
    );
    vi.spyOn(BrandMembership, "find").mockReturnValue(
      leanQuery([{ userId: "manager-1" }, { userId: "owner-1" }]),
    );
    vi.spyOn(User, "find").mockReturnValue(
      leanQuery([{ _id: "manager-1" }, { _id: "owner-1" }]),
    );

    const ids = await resolveChatRecipientIdsByRole({
      targetRole: "management",
      restaurantId: "r1",
      senderId: "guest:g1",
    });

    expect(ids).toEqual(["manager-1", "owner-1"]);
  });
});
