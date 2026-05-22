import { GraphQLError } from "graphql";
import { handleRestaurantChatbotMessage } from "../../../src/services/ai/restaurantChatbot.service.js";

const Mutation = {
  askAiChatbot: async (_, { input }, ctx) => {
    try {
      return await handleRestaurantChatbotMessage({
        message: input?.message,
        restaurantId: input?.restaurantId,
        history: input?.history || [],
        user: ctx?.user || null,
      });
    } catch (err) {
      throw new GraphQLError(err?.message || "Không thể xử lý tin nhắn chatbot", {
        extensions: { code: err?.statusCode === 400 ? "BAD_USER_INPUT" : "AI_CHATBOT_FAILED" },
      });
    }
  },
};

export default { Mutation };
