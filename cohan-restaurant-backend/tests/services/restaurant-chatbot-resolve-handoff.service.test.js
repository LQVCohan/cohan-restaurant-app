import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatConversation, ChatThread } from "../../models/index.js";
import { resolveRestaurantChatbotHandoff } from "../../src/services/ai/restaurantChatbotResolveHandoff.service.js";

const permissionSpy = vi.fn();

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireRestaurantPermission: (...args) => permissionSpy(...args),
}));

describe("resolveRestaurantChatbotHandoff", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    permissionSpy.mockReset();
    permissionSpy.mockResolvedValue(true);
  });

  const restaurantId = "507f1f77bcf86cd799439013";
  const user = {
    id: "507f1f77bcf86cd799439099",
    roleName: "support",
    restaurantForStaff: restaurantId,
    permissionCodes: ["ai.chatbot.handoff"],
  };

  it("resolves by conversationId", async () => {
    const conversation = {
      _id: "507f1f77bcf86cd799439011",
      restaurantId,
      chatThreadId: "507f1f77bcf86cd799439012",
      status: "handoff_requested",
      metadata: {},
      save: vi.fn().mockResolvedValue(true),
    };
    const thread = {
      _id: "507f1f77bcf86cd799439012",
      restaurantId,
      targetRole: "support",
      participants: [],
      status: "open",
      messages: [],
      save: vi.fn().mockResolvedValue(true),
      toObject: () => ({ restaurantId, targetRole: "support", participants: [] }),
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
    const conversation = { _id: "507f1f77bcf86cd799439011", restaurantId, chatThreadId: "507f1f77bcf86cd799439012", status: "handoff_requested", metadata: {}, save: vi.fn() };
    vi.spyOn(AiChatConversation, "findOne").mockResolvedValue(conversation);
    vi.spyOn(ChatThread, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439012", restaurantId, targetRole: "support", participants: [], status: "open", messages: [],
      save: vi.fn(), toObject: () => ({ restaurantId, targetRole: "support", participants: [] }),
    });
    const out = await resolveRestaurantChatbotHandoff({ input: { chatThreadId: "507f1f77bcf86cd799439012" }, user });
    expect(out.ok).toBe(true);
  });

  it("idempotent when already closed", async () => {
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({ _id: "507f1f77bcf86cd799439011", restaurantId, chatThreadId: null, status: "closed" });
    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user });
    expect(out.ok).toBe(true);
    expect(out.alreadyClosed).toBe(true);
  });

  it("returns ok=false for open non-handoff conversation and does not save", async () => {
    const save = vi.fn();
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      restaurantId,
      chatThreadId: "507f1f77bcf86cd799439012",
      status: "open",
      save,
    });
    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user });
    expect(out.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(permissionSpy).not.toHaveBeenCalled();
  });

  it("returns ok=false when handoff conversation has no chatThreadId", async () => {
    const save = vi.fn();
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      restaurantId,
      chatThreadId: null,
      status: "handoff_requested",
      save,
    });
    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user });
    expect(out.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(permissionSpy).not.toHaveBeenCalled();
  });

  it("returns ok=false when linked chatThread cannot be loaded", async () => {
    const save = vi.fn();
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      restaurantId,
      chatThreadId: "507f1f77bcf86cd799439012",
      status: "handoff_requested",
      save,
    });
    vi.spyOn(ChatThread, "findById").mockResolvedValue(null);
    const out = await resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user });
    expect(out.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(permissionSpy).not.toHaveBeenCalled();
  });

  it("fails unauthenticated", async () => {
    await expect(resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user: null })).rejects.toThrow("Unauthorized");
  });

  it("forbids cross restaurant access", async () => {
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({ _id: "507f1f77bcf86cd799439011", restaurantId, chatThreadId: "507f1f77bcf86cd799439012", status: "handoff_requested", metadata: {}, save: vi.fn() });
    vi.spyOn(ChatThread, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439012", restaurantId: "507f1f77bcf86cd799439077", targetRole: "support", participants: [], status: "open", messages: [],
      toObject: () => ({ restaurantId: "507f1f77bcf86cd799439077", targetRole: "support", participants: [] }),
    });
    await expect(resolveRestaurantChatbotHandoff({ input: { conversationId: "507f1f77bcf86cd799439011" }, user })).rejects.toThrow("Forbidden");
  });

  it("realtime emit failure does not fail mutation", async () => {
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue({ _id: "507f1f77bcf86cd799439011", restaurantId, chatThreadId: "507f1f77bcf86cd799439012", status: "closed", metadata: {}, save: vi.fn() });
    vi.spyOn(ChatThread, "findById").mockResolvedValue({ _id: "507f1f77bcf86cd799439012", status: "closed", restaurantId, targetRole: "support", participants: [], toObject: () => ({ restaurantId, targetRole: "support", participants: [] }) });
    const out = await resolveRestaurantChatbotHandoff({
      input: { conversationId: "507f1f77bcf86cd799439011" },
      user,
      io: { to: () => ({ emit: () => { throw new Error("socket"); } }) },
    });
    expect(out.ok).toBe(true);
  });
});