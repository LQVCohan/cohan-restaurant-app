import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

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

const IDS = {
  conversation: "507f1f77bcf86cd799439011",
  thread: "507f1f77bcf86cd799439012",
  restaurant: "507f1f77bcf86cd799439013",
  otherThread: "507f1f77bcf86cd799439014",
};
const user = {
  id: "507f1f77bcf86cd799439099",
  roleName: "support",
  permissions: ["ai.chatbot.handoff"],
};

const makeConversation = (patch = {}) => ({
  _id: IDS.conversation,
  chatThreadId: IDS.thread,
  status: "handoff_requested",
  metadata: {},
  restaurantId: IDS.restaurant,
  ...patch,
});
const makeThread = (patch = {}) => ({
  _id: IDS.thread,
  restaurantId: IDS.restaurant,
  kind: "ai_chatbot_handoff",
  subject: "AI handoff - Khách cần hỗ trợ",
  targetRole: null,
  participants: [],
  status: "open",
  messages: [{ content: "[AI HANDOFF]" }],
  ...patch,
});

const session = {
  withTransaction: vi.fn(async (callback) => callback()),
  endSession: vi.fn().mockResolvedValue(),
};

const mockLifecycle = ({
  conversation = makeConversation(),
  thread = makeThread(),
} = {}) => {
  vi.spyOn(AiChatConversation, "findById").mockImplementation(
    async () => conversation,
  );
  vi.spyOn(AiChatConversation, "findOne").mockImplementation(
    async () => conversation,
  );
  vi.spyOn(ChatThread, "findById").mockImplementation(async () => thread);
  vi.spyOn(ChatThread, "updateOne").mockImplementation(
    async (_filter, update) => {
      if (!thread || thread.status === "closed") return { modifiedCount: 0 };
      thread.status = update.$set.status;
      thread.lastMessageAt = update.$set.lastMessageAt;
      thread.lastMessagePreview = update.$set.lastMessagePreview;
      thread.messages.push(update.$push.messages);
      return { modifiedCount: 1 };
    },
  );
  vi.spyOn(AiChatConversation, "updateOne").mockImplementation(
    async (_filter, update) => {
      conversation.status = update.$set.status;
      conversation.metadata = update.$set.metadata;
      return { matchedCount: 1, modifiedCount: 1 };
    },
  );
  return { conversation, thread };
};

describe("resolveRestaurantChatbotHandoff", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMocks.requireRestaurantPermission.mockClear();
    session.withTransaction.mockClear();
    session.endSession.mockClear();
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
  });

  it("closes the conversation and linked thread in one transaction", async () => {
    const { conversation, thread } = mockLifecycle();

    const result = await resolveRestaurantChatbotHandoff({
      input: {
        conversationId: IDS.conversation,
        resolutionNote: "Khách đã được hỗ trợ",
      },
      user,
    });

    expect(result).toMatchObject({ ok: true, status: "closed" });
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(conversation.status).toBe("closed");
    expect(conversation.metadata).toMatchObject({
      handoffResolvedBy: user.id,
      handoffResolutionNote: "Khách đã được hỗ trợ",
    });
    expect(thread.status).toBe("closed");
    expect(thread.messages.at(-1).content).toContain(
      "Phiên hỗ trợ đã được đánh dấu là đã xử lý",
    );
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it("resolves by chatThreadId", async () => {
    mockLifecycle();
    vi.spyOn(AiChatConversation, "findById").mockResolvedValue(null);

    const result = await resolveRestaurantChatbotHandoff({
      input: { chatThreadId: IDS.thread },
      user,
    });

    expect(result.ok).toBe(true);
    expect(AiChatConversation.findOne).toHaveBeenCalledWith({
      chatThreadId: expect.anything(),
    });
  });

  it("rejects conflicting conversation and thread identifiers", async () => {
    mockLifecycle();

    const result = await resolveRestaurantChatbotHandoff({
      input: {
        conversationId: IDS.conversation,
        chatThreadId: IDS.otherThread,
      },
      user,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/không khớp/i);
    expect(session.withTransaction).not.toHaveBeenCalled();
  });

  it("uses restaurant permission instead of legacy participant assignment", async () => {
    mockLifecycle({
      thread: makeThread({ participants: [], targetRole: "another-role" }),
    });

    const result = await resolveRestaurantChatbotHandoff({
      input: { conversationId: IDS.conversation },
      user: { ...user, restaurantForStaff: null },
    });

    expect(result.ok).toBe(true);
    expect(authMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      { user: expect.anything() },
      IDS.restaurant,
      "ai.chatbot.handoff",
    );
  });

  it("rejects a linked thread from another restaurant or kind", async () => {
    mockLifecycle({
      thread: makeThread({ restaurantId: "507f1f77bcf86cd799439077" }),
    });

    const result = await resolveRestaurantChatbotHandoff({
      input: { conversationId: IDS.conversation },
      user,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/không thuộc/i);
    expect(session.withTransaction).not.toHaveBeenCalled();
  });

  it("is idempotent when conversation and thread are already closed", async () => {
    mockLifecycle({
      conversation: makeConversation({ status: "closed" }),
      thread: makeThread({ status: "closed" }),
    });

    const result = await resolveRestaurantChatbotHandoff({
      input: { conversationId: IDS.conversation },
      user,
    });

    expect(result).toMatchObject({
      ok: true,
      alreadyClosed: true,
      status: "closed",
    });
    expect(session.withTransaction).not.toHaveBeenCalled();
  });

  it("rejects a concurrent conversation state change", async () => {
    mockLifecycle();
    AiChatConversation.updateOne.mockResolvedValueOnce({
      matchedCount: 0,
      modifiedCount: 0,
    });

    await expect(
      resolveRestaurantChatbotHandoff({
        input: { conversationId: IDS.conversation },
        user,
      }),
    ).rejects.toMatchObject({
      message: "HANDOFF_STATE_CHANGED",
      code: "HANDOFF_STATE_CHANGED",
    });
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it("rejects open non-handoff conversations and missing linked threads", async () => {
    mockLifecycle({ conversation: makeConversation({ status: "open" }) });
    const openResult = await resolveRestaurantChatbotHandoff({
      input: { conversationId: IDS.conversation },
      user,
    });
    expect(openResult.ok).toBe(false);

    vi.restoreAllMocks();
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    mockLifecycle({ thread: null });
    const missingThreadResult = await resolveRestaurantChatbotHandoff({
      input: { conversationId: IDS.conversation },
      user,
    });
    expect(missingThreadResult.ok).toBe(false);
  });

  it("fails unauthenticated and forbids cross-restaurant access", async () => {
    await expect(
      resolveRestaurantChatbotHandoff({
        input: { conversationId: IDS.conversation },
        user: null,
      }),
    ).rejects.toThrow("Unauthorized");

    mockLifecycle({
      conversation: makeConversation({
        restaurantId: "507f1f77bcf86cd799439077",
      }),
      thread: makeThread({ restaurantId: "507f1f77bcf86cd799439077" }),
    });
    await expect(
      resolveRestaurantChatbotHandoff({
        input: { conversationId: IDS.conversation },
        user,
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("keeps the mutation successful when realtime emit fails", async () => {
    mockLifecycle();

    const result = await resolveRestaurantChatbotHandoff({
      input: { conversationId: IDS.conversation },
      user,
      io: {
        to: () => ({
          emit: () => {
            throw new Error("socket");
          },
        }),
      },
    });

    expect(result.ok).toBe(true);
  });
});
