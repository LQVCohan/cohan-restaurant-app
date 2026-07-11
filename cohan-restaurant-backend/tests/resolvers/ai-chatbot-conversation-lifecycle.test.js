import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatConversation } from "../../models/index.js";
import { keepOnlyOpenAiConversationReference } from "../../graphql/resolvers/aiChatbot/index.js";

const CONVERSATION_ID = "507f1f77bcf86cd799439011";

const statusQuery = (status) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(status == null ? null : { status }),
});

describe("Home AI conversation lifecycle before askAiChatbot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a supplied open conversation", async () => {
    vi.spyOn(AiChatConversation, "findById").mockReturnValue(
      statusQuery("open"),
    );

    await expect(
      keepOnlyOpenAiConversationReference({
        conversationId: CONVERSATION_ID,
        guestId: "guest_1",
        message: "Xin chào",
      }),
    ).resolves.toMatchObject({
      conversationId: CONVERSATION_ID,
      guestId: "guest_1",
      message: "Xin chào",
    });
  });

  it.each(["handoff_requested", "closed"])(
    "drops a %s conversation so the next Home message starts a clean session",
    async (status) => {
      vi.spyOn(AiChatConversation, "findById").mockReturnValue(
        statusQuery(status),
      );

      await expect(
        keepOnlyOpenAiConversationReference({
          conversationId: CONVERSATION_ID,
          guestId: "guest_1",
        }),
      ).resolves.toMatchObject({ conversationId: null, guestId: "guest_1" });
    },
  );

  it("drops invalid, missing and unreadable conversation references safely", async () => {
    await expect(
      keepOnlyOpenAiConversationReference({ conversationId: "invalid" }),
    ).resolves.toMatchObject({ conversationId: null });

    vi.spyOn(AiChatConversation, "findById")
      .mockReturnValueOnce(statusQuery(null))
      .mockImplementationOnce(() => {
        throw new Error("database unavailable");
      });

    await expect(
      keepOnlyOpenAiConversationReference({
        conversationId: CONVERSATION_ID,
      }),
    ).resolves.toMatchObject({ conversationId: null });
    await expect(
      keepOnlyOpenAiConversationReference({
        conversationId: CONVERSATION_ID,
      }),
    ).resolves.toMatchObject({ conversationId: null });
  });
});
