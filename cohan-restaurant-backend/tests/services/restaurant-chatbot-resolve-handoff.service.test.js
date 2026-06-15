import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn((_ctx, restaurantId) => {
    if (String(restaurantId).endsWith("077")) throw new Error("Forbidden");
    return true;
  }),
}));

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: authMocks.requireRestaurantPermission,
}));
import { AiChatConversation, ChatThread } from "../../models/index.js";
import { resolveRestaurantChatbotHandoff } from "../../src/services/ai/restaurantChatbotResolveHandoff.service.js";

describe("resolveRestaurantChatbotHandoff", () => {
  beforeEach(() => { vi.restoreAllMocks(); authMocks.requireRestaurantPermission.mockClear(); });

  const user = { id: "507f1f77bcf86cd799439099", roleName: "support", restaurantId: "507f1f77bcf86cd799439013", restaurantForStaff: "507f1f77bcf86cd799439013", restaurantIds: ["507f1f77bcf86cd799439013"], permissions: ["ai.chatbot.handoff"] };

  it("resolves by conversationId", async () => {
    const conversation = {
      _id: "507f1f77bcf86cd799439011",
      chatThreadId: "507f1f77bcf86cd799439012",
      status: "handoff_requested",
      metadata: {},
      restaurantId: "507f1f77bcf86cd799439013",
      save: vi.fn().mockResolvedValue(true),
    };
    const thread = {
      _id: "507f1f77bcf86cd799439012",
      restaurantId: "507f1f77bcf86cd799439013",
      targetRole: "support",
      participants: [],
      status: "open",
      messages: [],
      save: vi.fn().mockResolvedValue(true),
      toObject: () => ({ restaurantId: "507f1f77bcf86cd799439013", targetRole: "support", participants: [] }),
    };
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue(conversation);
    vi.spyOn(ChatThread, "findById").mockResolvedValue(thread);

    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: conversation._id }, user });
    expect(out.ok).toBe(true);
    expect(out.status).toBe("closed");
    expect(conversation.status).toBe("closed");
    expect(thread.status).toBe("closed");
    expect(thread.messages.at(-1).content).toContain("Phiên hỗ trợ đã được đánh dấu là đã xử lý");
  });

  it("resolves by chatThreadId", async () => {
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue(null);
    const conversation = { _id: "507f1f77bcf86cd799439011", chatThreadId: "507f1f77bcf86cd799439012", status: "handoff_requested", metadata: {}, restaurantId: "507f1f77bcf86cd799439013", save: vi.fn() };
    vi.spyOn(AiChatConversation, "findOne").mockResolvedValue(conversation);
    vi.spyOn(ChatThread, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439012", restaurantId: "507f1f77bcf86cd799439013", targetRole: "support", participants: [], status: "open", messages: [],
      save: vi.fn(), toObject: () => ({ restaurantId: "507f1f77bcf86cd799439013", targetRole: "support", participants: [] }),
    });
    const out = await resolveRestaurantChatbotHandoff({ input: { chatThreadId: "507f1f77bcf86cd799439012" }, user });
    expect(out.ok).toBe(true);
  });

  it("idempotent when already closed", async () => {
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({ _id: "507f1f77bcf86cd799439011", chatThreadId: null, restaurantId: "507f1f77bcf86cd799439013", status: "closed" });
    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user });
    expect(out.ok).toBe(true);
    expect(out.alreadyClosed).toBe(true);
  });

  it("returns ok=false for open non-handoff conversation and does not save", async () => {
    const save = vi.fn();
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      chatThreadId: "507f1f77bcf86cd799439012",
      status: "open",
      restaurantId: "507f1f77bcf86cd799439013",
      save,
    });
    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user });
    expect(out.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it("returns ok=false when handoff conversation has no chatThreadId", async () => {
    const save = vi.fn();
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      chatThreadId: null,
      status: "handoff_requested",
      restaurantId: "507f1f77bcf86cd799439013",
      save,
    });
    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user });
    expect(out.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it("returns ok=false when linked chatThread cannot be loaded", async () => {
    const save = vi.fn();
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      chatThreadId: "507f1f77bcf86cd799439012",
      status: "handoff_requested",
      restaurantId: "507f1f77bcf86cd799439013",
      save,
    });
    vi.spyOn(ChatThread, "findById").mockResolvedValue(null);
    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user });
    expect(out.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it("fails unauthenticated", async () => {
    await expect(resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user: null })).rejects.toThrow("Unauthorized");
  });

  it("forbids cross restaurant access", async () => {
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({ _id: "507f1f77bcf86cd799439011", chatThreadId: "507f1f77bcf86cd799439012", status: "handoff_requested", metadata: {}, restaurantId: "507f1f77bcf86cd799439077", save: vi.fn() });
    vi.spyOn(ChatThread, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439012", restaurantId: "507f1f77bcf86cd799439077", targetRole: "support", participants: [], status: "open", messages: [],
      toObject: () => ({ restaurantId: "507f1f77bcf86cd799439077", targetRole: "support", participants: [] }),
    });
    await expect(resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user })).rejects.toThrow("Forbidden");
  });

  it("realtime emit failure does not fail mutation", async () => {
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({ _id: "507f1f77bcf86cd799439011", chatThreadId: "507f1f77bcf86cd799439012", restaurantId: "507f1f77bcf86cd799439013", status: "closed", metadata: {}, save: vi.fn() });
    vi.spyOn(ChatThread, "findById").mockResolvedValue({ _id: "507f1f77bcf86cd799439012", status: "closed", restaurantId: "507f1f77bcf86cd799439013", targetRole: "support", participants: [], toObject: () => ({ restaurantId: "507f1f77bcf86cd799439013", targetRole: "support", participants: [] }) });
    const out = await resolveRestaurantChatbotHandoff({
      input: { conversationId: "507f1f77bcf86cd799439011" },
      user,
      io: { to: () => ({ emit: () => { throw new Error("socket"); } }) },
    });
    expect(out.ok).toBe(true);
  });
});
