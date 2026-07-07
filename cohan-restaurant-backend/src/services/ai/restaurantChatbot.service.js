import process from "process";
import {
  __testables as coreTestables,
  handleRestaurantChatbotMessage as handleCoreRestaurantChatbotMessage,
} from "./restaurantChatbotCore.service.js";
import { DEFAULT_GEMINI_MODEL } from "./geminiClient.service.js";

const enforceGeminiProviderPolicy = () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  process.env.AI_PROVIDER = "gemini";
  process.env.AI_FALLBACK_PROVIDER = "local";
  process.env.GEMINI_MODEL = DEFAULT_GEMINI_MODEL;
  process.env.AI_CHATBOT_MODEL = DEFAULT_GEMINI_MODEL;
};

export const handleRestaurantChatbotMessage = async (options = {}) => {
  enforceGeminiProviderPolicy();
  return handleCoreRestaurantChatbotMessage(options);
};

export const __testables = coreTestables;
