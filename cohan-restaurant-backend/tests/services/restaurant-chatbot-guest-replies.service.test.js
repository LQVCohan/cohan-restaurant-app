import { __resetAiChatbotRateLimitStoreForTests } from "../../src/services/ai/restaurantChatbotRateLimit.service.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatConversation, ChatThread, User, Notification, Restaurant, BrandMembership } from "../../models/index.js";

const {
  toGuestStaffReplies,
  getRestaurantChatbotGuestReplies,
  sendRestaurantChatbotGuestMessage,
} = await import("../../src/services/ai/restaurantChatbotGuestReplies.service.js");

describe("toGuestStaffReplies", () => {
  const baseDate = new Date("2026-05-20T10:00:00.000Z");

  it("maps valid staff replies to guest-safe payload", () => {
    const rows = toGuestStaffReplies({
      messages: [{ _id: "m1", senderRole: "STAFF", senderId: "u1", content: "Xin chào", createdAt: baseDate }],
    });

    expect(rows).toEqual([
      {
        id: "m1",
        role: "staff",
        senderLabel: "Nhân viên",
        content: "Xin chào",
        createdAt: baseDate.toISOString(),
      },
    ]);
  });

  it("includes operational roles", () => {
    const rows = toGuestStaffReplies({
      messages: [
        { _id: "server", senderRole: "server", senderId: "u1", content: "server", createdAt: baseDate },
        { _id: "cashier", senderRole: "cashier", senderId: "u2", content: "cashier", createdAt: baseDate },
        { _id: "chef", senderRole: "chef", senderId: "u3", content: "chef", createdAt: baseDate },
        { _id: "cook", senderRole: "cook", senderId: "u4", content: "cook", createdAt: baseDate },
        { _id: "helper", senderRole: "kitchen_helper", senderId: "u5", content: "helper", createdAt: baseDate },
      ],
    });

    expect(rows.map((item) => item.id)).toEqual(["server", "cashier", "chef", "cook", "helper"]);
  });

  it("excludes customer/guest/user/system roles", () => {
    const rows = toGuestStaffReplies({
      messages: [
        { senderRole: "system", senderName: "AI", content: "system", createdAt: baseDate },
        { senderRole: "guest", senderId: "g1", content: "guest", createdAt: baseDate },
        { senderRole: "customer", senderId: "c1", content: "customer", createdAt: baseDate },
        { senderRole: "user", senderId: "u1", content: "user", createdAt: baseDate },
        { senderRole: "manager", senderId: "m1", content: "visible", createdAt: baseDate },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("visible");
  });

  it("excludes handoff summary message", () => {
    const rows = toGuestStaffReplies({
      messages: [
        { senderRole: "manager", senderId: "u1", content: "[AI HANDOFF] summary", createdAt: baseDate },
        { senderRole: "manager", senderId: "u1", content: "Tin nhắn hợp lệ", createdAt: baseDate },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("Tin nhắn hợp lệ");
  });

  it("excludes wrong/invalid createdAt", () => {
    const rows = toGuestStaffReplies({
      messages: [
        { senderRole: "manager", senderId: "u1", content: "bad", createdAt: "invalid-date" },
        { senderRole: "manager", senderId: "u1", content: "good", createdAt: baseDate },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("good");
  });

  it("filters by after cursor when valid", () => {
    const rows = toGuestStaffReplies({
      after: "2026-05-20T10:00:01.000Z",
      messages: [
        { _id: "a", senderRole: "staff", senderId: "u1", content: "old", createdAt: "2026-05-20T10:00:01.000Z" },
        { _id: "b", senderRole: "staff", senderId: "u1", content: "new", createdAt: "2026-05-20T10:00:02.000Z" },
      ],
    });

    expect(rows.map((x) => x.id)).toEqual(["b"]);
  });

  it("clamps limit to 50", () => {
    const messages = Array.from({ length: 70 }).map((_, index) => ({
      _id: `id_${index}`,
      senderRole: "staff",
      senderId: "u1",
      content: `m_${index}`,
      createdAt: new Date(baseDate.getTime() + index * 1000),
    }));

    const rows = toGuestStaffReplies({ messages, limit: 500 });
    expect(rows).toHaveLength(50);
    expect(rows[0].id).toBe("id_20");
    expect(rows[49].id).toBe("id_69");
  });

  it("ignores invalid after cursor safely", () => {
    const rows = toGuestStaffReplies({
      after: "not-a-date",
      messages: [{ _id: "m1", senderRole: "staff", senderId: "u1", content: "ok", createdAt: baseDate }],
    });

    expect(rows).toHaveLength(1);
  });
});

describe("getRestaurantChatbotGuestReplies", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetAiChatbotRateLimitStoreForTests();
  });

  it("returns staff replies for valid guest ownership", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    const threadId = "507f1f77bcf86cd799439012";

    vi.spyOn(AiChatConversation, "findById").mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: conversationId,
        guestId: "guest_abc",
        status: "handoff_requested",
        chatThreadId: threadId,
      }),
    });

    vi.spyOn(ChatThread, "findById").mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          messages: [{ _id: "m1", senderRole: "server", senderId: "u1", content: "Xin chào", createdAt: "2026-05-20T10:00:00.000Z" }],
        }),
      }),
    });

    const result = await getRestaurantChatbotGuestReplies({ input: { conversationId, guestId: "guest_abc" } });
    expect(result.ok).toBe(true);
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].role).toBe("staff");
  });

  it("returns safe empty for wrong guestId", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    vi.spyOn(AiChatConversation, "findById").mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: conversationId, guestId: "guest_real", status: "handoff_requested", chatThreadId: null }),
    });

    const result = await getRestaurantChatbotGuestReplies({ input: { conversationId, guestId: "guest_other" } });
    expect(result).toEqual({ ok: false, handoffRequested: false, conversationStatus: null, handoffClosed: false, conversationId, replies: [] });
  });

  it("returns safe empty for invalid conversationId", async () => {
    const result = await getRestaurantChatbotGuestReplies({ input: { conversationId: "bad-id", guestId: "guest_abc" } });
    expect(result).toEqual({ ok: false, handoffRequested: false, conversationStatus: null, handoffClosed: false, conversationId: "bad-id", replies: [] });
  });

  it("returns safe empty replies when no chatThreadId", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    vi.spyOn(AiChatConversation, "findById").mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: conversationId, guestId: "guest_abc", status: "handoff_requested", chatThreadId: null }),
    });

    const result = await getRestaurantChatbotGuestReplies({ input: { conversationId, guestId: "guest_abc" } });
    expect(result).toEqual({ ok: true, handoffRequested: true, conversationStatus: "handoff_requested", handoffClosed: false, conversationId, replies: [] });
  });

  it("returns closed status fields when handoff was closed", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    vi.spyOn(AiChatConversation, "findById").mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: conversationId, guestId: "guest_abc", status: "closed", chatThreadId: null }),
    });
    const result = await getRestaurantChatbotGuestReplies({ input: { conversationId, guestId: "guest_abc" } });
    expect(result.handoffClosed).toBe(true);
    expect(result.conversationStatus).toBe("closed");
  });
});


describe("sendRestaurantChatbotGuestMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetAiChatbotRateLimitStoreForTests();
    vi.spyOn(Restaurant, "findById").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) });
    vi.spyOn(BrandMembership, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
  });

  it("appends guest message to linked handoff chat thread", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    const threadId = "507f1f77bcf86cd799439012";
    const saveThread = vi.fn().mockResolvedValue(true);

    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: conversationId,
      guestId: "guest_abc",
      status: "handoff_requested",
      chatThreadId: threadId,
    });

    const thread = {
      _id: threadId,
      restaurantId: "507f1f77bcf86cd799439013",
      channel: "support",
      targetRole: "support",
      participants: [],
      messages: [],
      save: saveThread,
    };
    vi.spyOn(ChatThread, "findById").mockResolvedValue(thread);

    vi.spyOn(User, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    vi.spyOn(Notification, "insertMany").mockResolvedValue([]);

    const out = await sendRestaurantChatbotGuestMessage({
      input: { conversationId, guestId: "guest_abc", content: "Xin chào nhân viên" },
    });

    expect(out.ok).toBe(true);
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0].senderRole).toBe("guest");
    expect(thread.messages[0].senderName).toBe("Khách hàng");
    expect(saveThread).toHaveBeenCalled();
  });

  it("safe fails for wrong guestId", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: conversationId,
      guestId: "guest_real",
      status: "handoff_requested",
      chatThreadId: "507f1f77bcf86cd799439012",
    });

    const out = await sendRestaurantChatbotGuestMessage({
      input: { conversationId, guestId: "guest_other", content: "x" },
    });
    expect(out.ok).toBe(false);
  });

  it("safe fails for invalid conversationId", async () => {
    const out = await sendRestaurantChatbotGuestMessage({
      input: { conversationId: "bad-id", guestId: "guest_abc", content: "x" },
    });
    expect(out.ok).toBe(false);
  });

  it("fails when conversation is not handoff_requested", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: conversationId,
      guestId: "guest_abc",
      status: "open",
      chatThreadId: "507f1f77bcf86cd799439012",
    });

    const out = await sendRestaurantChatbotGuestMessage({
      input: { conversationId, guestId: "guest_abc", content: "x" },
    });
    expect(out.ok).toBe(false);
  });
  it("fails when conversation is closed", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: conversationId,
      guestId: "guest_abc",
      status: "closed",
      chatThreadId: "507f1f77bcf86cd799439012",
    });
    const out = await sendRestaurantChatbotGuestMessage({
      input: { conversationId, guestId: "guest_abc", content: "x" },
    });
    expect(out.ok).toBe(false);
  });

  it("fails when chatThreadId missing", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: conversationId,
      guestId: "guest_abc",
      status: "handoff_requested",
      chatThreadId: null,
    });

    const out = await sendRestaurantChatbotGuestMessage({
      input: { conversationId, guestId: "guest_abc", content: "x" },
    });
    expect(out.ok).toBe(false);
  });

  it("fails for overlong content", async () => {
    const out = await sendRestaurantChatbotGuestMessage({
      input: {
        conversationId: "507f1f77bcf86cd799439011",
        guestId: "guest_abc",
        content: "x".repeat(1001),
      },
    });
    expect(out.ok).toBe(false);
  });

  it("keeps mutation successful when notification insert fails", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    const threadId = "507f1f77bcf86cd799439012";
    const saveThread = vi.fn().mockResolvedValue(true);

    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: conversationId,
      guestId: "guest_abc",
      status: "handoff_requested",
      chatThreadId: threadId,
    });

    vi.spyOn(ChatThread, "findById").mockResolvedValue({
      _id: threadId,
      restaurantId: "507f1f77bcf86cd799439013",
      channel: "support",
      targetRole: "support",
      participants: ["507f1f77bcf86cd799439099"],
      messages: [],
      save: saveThread,
    });

    vi.spyOn(User, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    vi.spyOn(Notification, "insertMany").mockRejectedValue(new Error("db down"));

    const out = await sendRestaurantChatbotGuestMessage({
      input: { conversationId, guestId: "guest_abc", content: "Xin chào nhân viên" },
      io: {
        to: () => ({ emit: () => { throw new Error("socket issue"); } }),
      },
    });

    expect(out.ok).toBe(true);
    expect(saveThread).toHaveBeenCalled();
  });

});

describe("resolveChatRecipientIdsByRole", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes direct staff by restaurantForStaff and excludes other restaurants", async () => {
    const { resolveChatRecipientIdsByRole } = await import("../../src/services/communication/chatRecipientScope.service.js");
    vi.spyOn(User, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "staff-r1" }]) }) });
    const ids = await resolveChatRecipientIdsByRole({ targetRole: "staff", restaurantId: "r1", senderId: "guest:g1" });
    expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ userType: "STAFF", restaurantForStaff: "r1", status: "active", deletedAt: null }));
    expect(ids).toEqual(["staff-r1"]);
  });

  it("routes management handoff through active BrandMembership", async () => {
    const { resolveChatRecipientIdsByRole } = await import("../../src/services/communication/chatRecipientScope.service.js");
    vi.spyOn(Restaurant, "findById").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "r1", brandId: "b1" }) }) });
    vi.spyOn(BrandMembership, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ userId: "manager-1" }, { userId: "owner-1" }]) }) });
    vi.spyOn(User, "find").mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "manager-1" }, { _id: "owner-1" }]) }) });

    const ids = await resolveChatRecipientIdsByRole({ targetRole: "management", restaurantId: "r1", senderId: "guest:g1" });

    expect(BrandMembership.find).toHaveBeenCalledWith(expect.objectContaining({
      brandId: "b1",
      status: "active",
      $or: expect.arrayContaining([
        { role: { $in: ["owner", "admin"] } },
        { role: "manager", restaurantIds: "r1" },
      ]),
    }));
    expect(JSON.stringify(User.find.mock.calls)).not.toContain("refRestaurants");
    expect(ids).toEqual(["manager-1", "owner-1"]);
  });
});
