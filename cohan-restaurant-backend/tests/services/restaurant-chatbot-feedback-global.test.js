import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findConversation: vi.fn(),
  findMessage: vi.fn(),
  createFeedback: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  AiChatConversation: { findOne: mocks.findConversation },
  AiChatMessage: { findById: mocks.findMessage },
  AiChatbotAnswerFeedback: {
    create: mocks.createFeedback,
    find: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requireAnyRestaurantPermission: vi.fn(),
  requireRestaurantPermission: vi.fn(),
}));

vi.mock(
  "../../src/services/ai/restaurantChatbotKnowledgeSuggestion.service.js",
  () => ({ recordKnowledgeGapSuggestion: vi.fn() }),
);

const { submitAiChatbotAnswerFeedback } = await import(
  "../../src/services/ai/restaurantChatbotFeedback.service.js"
);

const restaurantId = "64a45f76c9a67c5f6f0d1000";
const conversationId = "64a45f76c9a67c5f6f0d1001";
const messageId = "64a45f76c9a67c5f6f0d1002";
const feedbackId = "64a45f76c9a67c5f6f0d1003";

const leanResult = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const feedbackDocument = (overrides = {}) => ({
  toObject: () => ({
    _id: feedbackId,
    restaurantId: null,
    conversationId: null,
    messageId: null,
    rating: "helpful",
    tags: [],
    sourceTypes: [],
    status: "new",
    ...overrides,
  }),
});

describe("chatbot answer feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the existing restaurant-scoped feedback flow", async () => {
    mocks.createFeedback.mockResolvedValue(
      feedbackDocument({ restaurantId, rating: "helpful" }),
    );

    const result = await submitAiChatbotAnswerFeedback({
      input: {
        restaurantId,
        question: "Món này còn bán không?",
        answer: "Món vẫn đang được phục vụ.",
        rating: "helpful",
      },
      ctx: {},
    });

    expect(mocks.findConversation).not.toHaveBeenCalled();
    expect(mocks.findMessage).not.toHaveBeenCalled();
    expect(mocks.createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: expect.anything(),
        conversationId: null,
        messageId: null,
        rating: "helpful",
      }),
    );
    expect(result.restaurantId).toBe(restaurantId);
  });

  it("stores verified feedback when the conversation has no restaurant", async () => {
    mocks.findConversation.mockReturnValue(
      leanResult({ _id: conversationId, restaurantId: null, guestId: "guest-1" }),
    );
    mocks.findMessage.mockReturnValue(
      leanResult({
        _id: messageId,
        conversationId,
        restaurantId: null,
        role: "assistant",
      }),
    );
    mocks.createFeedback.mockResolvedValue(
      feedbackDocument({
        conversationId,
        messageId,
        restaurantId: null,
        rating: "helpful",
      }),
    );

    const result = await submitAiChatbotAnswerFeedback({
      input: {
        conversationId,
        messageId,
        guestId: "guest-1",
        question: "Tôi muốn xem thực đơn",
        answer: "Bạn có thể mở thực đơn bằng nút bên dưới.",
        rating: "helpful",
      },
      ctx: {},
    });

    expect(mocks.createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: null,
        conversationId: expect.anything(),
        messageId: expect.anything(),
        guestId: "guest-1",
        rating: "helpful",
      }),
    );
    expect(result.restaurantId).toBeNull();
    expect(result.rating).toBe("helpful");
  });

  it("rejects feedback when the guest does not own the conversation", async () => {
    mocks.findConversation.mockReturnValue(leanResult(null));

    await expect(
      submitAiChatbotAnswerFeedback({
        input: {
          conversationId,
          guestId: "wrong-guest",
          answer: "Answer",
          rating: "not_helpful",
        },
        ctx: {},
      }),
    ).rejects.toMatchObject({ code: "BAD_USER_INPUT" });

    expect(mocks.createFeedback).not.toHaveBeenCalled();
  });
});
