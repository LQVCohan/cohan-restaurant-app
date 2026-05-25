import { GraphQLError } from "graphql";
import { AI_CHATBOT_RATE_LIMIT_CODE } from "../../../src/services/ai/restaurantChatbotRateLimit.service.js";
import { handleRestaurantChatbotMessage } from "../../../src/services/ai/restaurantChatbot.service.js";
import { requestRestaurantChatbotHandoff } from "../../../src/services/ai/restaurantChatbotHandoff.service.js";
import { getRestaurantChatbotGuestReplies, sendRestaurantChatbotGuestMessage } from "../../../src/services/ai/restaurantChatbotGuestReplies.service.js";
import { resolveRestaurantChatbotHandoff } from "../../../src/services/ai/restaurantChatbotResolveHandoff.service.js";

const Query = {
  aiChatbotGuestReplies: async (_, { input }, ctx) => {
    try {
      return await getRestaurantChatbotGuestReplies({
        input,
        clientIp: ctx?.request?.ip || ctx?.reply?.request?.ip || "",
      });
    } catch {
      return {
        ok: false,
        handoffRequested: false,
        conversationId: String(input?.conversationId || ""),
        replies: [],
      };
    }
  },
};

const Mutation = {
  askAiChatbot: async (_, { input }, ctx) => {
    try {
      return await handleRestaurantChatbotMessage({
        message: input?.message,
        restaurantId: input?.restaurantId,
        history: input?.history || [],
        guestId: input?.guestId,
        conversationId: input?.conversationId,
        user: ctx?.user || null,
        clientIp: ctx?.request?.ip || ctx?.reply?.request?.ip || "",
      });
    } catch (err) {
      throw new GraphQLError(err?.message || "Không thể xử lý tin nhắn chatbot", {
        extensions: { code: err?.code || (err?.statusCode === 400 ? "BAD_USER_INPUT" : "AI_CHATBOT_FAILED") },
      });
    }
  },
  requestAiChatbotHandoff: async (_, { input }, ctx) => {
    try {
      return await requestRestaurantChatbotHandoff({
        input,
        user: ctx?.user || null,
        io: ctx?.io || null,
        clientIp: ctx?.request?.ip || ctx?.reply?.request?.ip || "",
      });
    } catch (err) {
      throw new GraphQLError(err?.message || "Không thể gửi yêu cầu hỗ trợ nhân viên", {
        extensions: { code: err?.statusCode === 400 ? "BAD_USER_INPUT" : "AI_CHATBOT_HANDOFF_FAILED" },
      });
    }
  },
  sendAiChatbotGuestMessage: async (_, { input }, ctx) => {
    try {
      return await sendRestaurantChatbotGuestMessage({
        input,
        io: ctx?.io || null,
        clientIp: ctx?.request?.ip || ctx?.reply?.request?.ip || "",
      });
    } catch {
      return { ok: false, conversationId: String(input?.conversationId || ""), message: null };
    }
  },
  resolveAiChatbotHandoff: async (_, { input }, ctx) => {
    try {
      return await resolveRestaurantChatbotHandoff({ input, user: ctx?.user || null, io: ctx?.io || null });
    } catch (err) {
      throw new GraphQLError(err?.message || "Không thể đánh dấu phiên hỗ trợ đã xử lý", {
        extensions: { code: err?.code || "AI_CHATBOT_HANDOFF_RESOLVE_FAILED" },
      });
    }
  },
};

export default { Query, Mutation };
