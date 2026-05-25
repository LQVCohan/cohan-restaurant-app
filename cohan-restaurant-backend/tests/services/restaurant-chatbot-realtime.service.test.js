import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  AiChatConversation: { findById: vi.fn(), findOne: vi.fn() },
}));

const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith("valid-")),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({ default: mongooseMocks }));

describe("restaurantChatbotRealtime service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows valid guest ownership join", async () => {
    modelMocks.AiChatConversation.findById.mockReturnValue({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue({ _id: "valid-conv1", guestId: "guest_1" }) })),
    });

    const svc = await import("../../src/services/ai/restaurantChatbotRealtime.service.js");
    const result = await svc.validateGuestConversationOwnership({ conversationId: "valid-conv1", guestId: " guest_1 " });

    expect(result.ok).toBe(true);
    expect(result.roomName).toBe("ai_conv_valid-conv1");
  });

  it("rejects wrong guest ownership", async () => {
    modelMocks.AiChatConversation.findById.mockReturnValue({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue({ _id: "valid-conv1", guestId: "guest_ok" }) })),
    });

    const svc = await import("../../src/services/ai/restaurantChatbotRealtime.service.js");
    const result = await svc.validateGuestConversationOwnership({ conversationId: "valid-conv1", guestId: "guest_bad" });

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects invalid conversationId safely", async () => {
    const svc = await import("../../src/services/ai/restaurantChatbotRealtime.service.js");
    const result = await svc.validateGuestConversationOwnership({ conversationId: "bad-conv1", guestId: "guest_ok" });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("emits guest-safe payload only for linked AI conversation", async () => {
    modelMocks.AiChatConversation.findOne.mockReturnValue({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue({ _id: "valid-conv1" }) })),
    });
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const io = { to };

    const svc = await import("../../src/services/ai/restaurantChatbotRealtime.service.js");
    const ok = await svc.emitAiChatbotStaffReplyIfLinked({
      io,
      chatThreadId: "valid-thread-1",
      message: { _id: "m1", senderRole: "staff", senderId: "u1", content: "Xin chào", createdAt: new Date().toISOString() },
    });

    expect(ok).toBe(true);
    expect(to).toHaveBeenCalledWith("ai_conv_valid-conv1");
    const payload = emit.mock.calls[0][1];
    expect(payload).toMatchObject({ id: "m1", role: "staff", senderLabel: "Nhân viên", content: "Xin chào" });
    expect(payload.threadId).toBeUndefined();
    expect(payload.senderId).toBeUndefined();
    expect(payload.participants).toBeUndefined();
    expect(payload.unreadBy).toBeUndefined();
  });

  it("does not emit for non-AI or disallowed message", async () => {
    modelMocks.AiChatConversation.findOne.mockReturnValue({
      select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
    });
    const emit = vi.fn();
    const io = { to: vi.fn(() => ({ emit })) };

    const svc = await import("../../src/services/ai/restaurantChatbotRealtime.service.js");
    const ok = await svc.emitAiChatbotStaffReplyIfLinked({
      io,
      chatThreadId: "valid-thread-1",
      message: { senderRole: "system", content: "[AI HANDOFF] x", createdAt: new Date().toISOString() },
    });

    expect(ok).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });
});
