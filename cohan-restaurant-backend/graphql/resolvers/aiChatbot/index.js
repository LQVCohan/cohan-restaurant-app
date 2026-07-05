import { GraphQLError } from "graphql";
import { AI_CHATBOT_RATE_LIMIT_CODE } from "../../../src/services/ai/restaurantChatbotRateLimit.service.js";
import { handleRestaurantChatbotMessage } from "../../../src/services/ai/restaurantChatbotReviewed.service.js";
import { requestRestaurantChatbotHandoff } from "../../../src/services/ai/restaurantChatbotHandoff.service.js";
import { getRestaurantChatbotGuestReplies, sendRestaurantChatbotGuestMessage } from "../../../src/services/ai/restaurantChatbotGuestReplies.service.js";
import { resolveRestaurantChatbotHandoff } from "../../../src/services/ai/restaurantChatbotResolveHandoff.service.js";
import { getRestaurantChatbotAnalytics } from "../../../src/services/ai/restaurantChatbotAnalytics.service.js";
import { getPublicAiChatbotSettings, getRestaurantAiChatbotSettings, updateRestaurantAiChatbotSettings } from "../../../src/services/ai/restaurantChatbotSettings.service.js";
import {
  listRestaurantAiChatbotKnowledge,
  getRestaurantAiChatbotKnowledgeItem,
  createRestaurantAiChatbotKnowledgeItem,
  updateRestaurantAiChatbotKnowledgeItem,
  deleteRestaurantAiChatbotKnowledgeItem,
  bulkUpdateRestaurantAiChatbotKnowledgeEnabled,
  bulkDeleteRestaurantAiChatbotKnowledge,
  exportRestaurantAiChatbotKnowledge,
  importRestaurantAiChatbotKnowledge,
  rebuildRestaurantAiKnowledgeEmbeddings,
} from "../../../src/services/ai/restaurantChatbotKnowledge.service.js";
import {
  listRestaurantAiChatbotKnowledgeSuggestions,
  approveRestaurantAiChatbotKnowledgeSuggestion,
  dismissRestaurantAiChatbotKnowledgeSuggestion,
  deleteRestaurantAiChatbotKnowledgeSuggestion,
  bulkDismissRestaurantAiChatbotKnowledgeSuggestions,
  bulkDeleteRestaurantAiChatbotKnowledgeSuggestions,
  generateRestaurantAiChatbotKnowledgeSuggestions,
} from "../../../src/services/ai/restaurantChatbotKnowledgeSuggestion.service.js";
import {
  submitAiChatbotAnswerFeedback,
  listRestaurantAiChatbotAnswerFeedback,
  markAiChatbotAnswerFeedbackReviewed,
  ignoreAiChatbotAnswerFeedback,
  convertAiChatbotFeedbackToSuggestion,
  bulkMarkAiChatbotAnswerFeedbackReviewed,
  bulkIgnoreAiChatbotAnswerFeedback,
  bulkConvertAiChatbotFeedbackToSuggestion,
} from "../../../src/services/ai/restaurantChatbotFeedback.service.js";
import {
  listRestaurantAiChatbotSafetyRules,
  createRestaurantAiChatbotSafetyRule,
  updateRestaurantAiChatbotSafetyRule,
  deleteRestaurantAiChatbotSafetyRule,
  bulkUpdateRestaurantAiChatbotSafetyRuleEnabled,
  bulkDeleteRestaurantAiChatbotSafetyRules,
} from "../../../src/services/ai/restaurantChatbotSafety.service.js";
import {
  evaluateRestaurantAiChatbotPrompt,
  runRestaurantAiChatbotEvaluationSet,
  listRestaurantAiChatbotEvaluationCases,
  createRestaurantAiChatbotEvaluationCase,
  updateRestaurantAiChatbotEvaluationCase,
  deleteRestaurantAiChatbotEvaluationCase,
} from "../../../src/services/ai/restaurantChatbotEvaluation.service.js";

const isManagerNavigationRequest = (message = "") =>
  /(?:mở|mo|đi tới|di toi|vào|vao|truy cập|truy cap).*(?:quản lý|quan ly|dashboard)|(?:trang quản lý|trang quan ly|dashboard)/i.test(String(message || ""));

const isManagerPath = (href = "") => /^\/manager(?:$|[/?#])/.test(String(href || ""));

export const sanitizeAiChatbotResponse = (response = {}, message = "") => {
  const intent = String(response?.intent || "general");
  const originalActions = Array.isArray(response?.actions) ? response.actions : [];
  const managerAction = originalActions.find((action) => action?.href === "/manager") || originalActions.find((action) => isManagerPath(action?.href));
  const managerNavigation = Boolean(managerAction && isManagerNavigationRequest(message));
  const keepMenuSources = intent === "menu" && !managerNavigation;
  const sources = (Array.isArray(response?.sources) ? response.sources : [])
    .filter((source) => keepMenuSources || source?.type !== "menuItem");

  if (managerNavigation) {
    return {
      ...response,
      answer: `Mình đã tìm thấy trang quản lý nhà hàng. Chọn "${managerAction.label || "Mở dashboard quản lý"}" bên dưới để mở.`,
      intent: "managerFeatureHelp",
      actions: [{ ...managerAction, label: "Mở trang quản lý nhà hàng" }],
      sources,
      contextSummary: response.contextSummary
        ? { ...response.contextSummary, menuItemCount: 0 }
        : response.contextSummary,
    };
  }

  if (intent === "menu") return response;

  const actions = originalActions
    .filter((action) => !String(action?.href || "").startsWith("/food/"));

  return { ...response, actions, sources };
};

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
  aiChatbotAnalytics: async (_, { input }, ctx) => {
    try {
      return await getRestaurantChatbotAnalytics({ input, ctx });
    } catch (err) {
      throw new GraphQLError(err?.message || "Không thể tải thống kê AI chatbot", {
        extensions: { code: err?.code || "AI_CHATBOT_ANALYTICS_FAILED" },
      });
    }
  },
  restaurantAiChatbotSettings: async (_, { restaurantId }, ctx) => getRestaurantAiChatbotSettings({ restaurantId, ctx }),
  publicAiChatbotSettings: async (_, { restaurantId }) => getPublicAiChatbotSettings({ restaurantId }),
  restaurantAiChatbotKnowledge: async (_, { restaurantId, filter }, ctx) => listRestaurantAiChatbotKnowledge({ restaurantId, filter, ctx }),
  restaurantAiChatbotKnowledgeItem: async (_, { id }, ctx) => getRestaurantAiChatbotKnowledgeItem({ id, ctx }),
  exportRestaurantAiChatbotKnowledge: async (_, { restaurantId, format }, ctx) => exportRestaurantAiChatbotKnowledge({ restaurantId, format, ctx }),
  restaurantAiChatbotKnowledgeSuggestions: async (_, { restaurantId, filter }, ctx) => listRestaurantAiChatbotKnowledgeSuggestions({ restaurantId, filter, ctx }),
  restaurantAiChatbotAnswerFeedback: async (_, { restaurantId, filter }, ctx) => listRestaurantAiChatbotAnswerFeedback({ restaurantId, filter, ctx }),
  restaurantAiChatbotSafetyRules: async (_, { restaurantId, filter }, ctx) => listRestaurantAiChatbotSafetyRules({ restaurantId, filter, ctx }),
  evaluateRestaurantAiChatbotPrompt: async (_, { input }, ctx) => evaluateRestaurantAiChatbotPrompt({ input, ctx }),
  runRestaurantAiChatbotEvaluationSet: async (_, { input }, ctx) => runRestaurantAiChatbotEvaluationSet({ input, ctx }),
  restaurantAiChatbotEvaluationCases: async (_, { restaurantId }, ctx) => listRestaurantAiChatbotEvaluationCases({ restaurantId, ctx }),
};

const Mutation = {
  askAiChatbot: async (_, { input }, ctx) => {
    try {
      const response = await handleRestaurantChatbotMessage({
        message: input?.message,
        restaurantId: input?.restaurantId,
        history: input?.history || [],
        guestId: input?.guestId,
        conversationId: input?.conversationId,
        pageContext: input?.pageContext || {},
        user: ctx?.user || null,
        clientIp: ctx?.request?.ip || ctx?.reply?.request?.ip || "",
      });
      return sanitizeAiChatbotResponse(response, input?.message);
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
  updateRestaurantAiChatbotSettings: async (_, { input }, ctx) => updateRestaurantAiChatbotSettings({ input, ctx }),
  createRestaurantAiChatbotKnowledgeItem: async (_, { input }, ctx) => createRestaurantAiChatbotKnowledgeItem({ input, ctx }),
  updateRestaurantAiChatbotKnowledgeItem: async (_, { input }, ctx) => updateRestaurantAiChatbotKnowledgeItem({ input, ctx }),
  deleteRestaurantAiChatbotKnowledgeItem: async (_, { id }, ctx) => deleteRestaurantAiChatbotKnowledgeItem({ id, ctx }),
  bulkUpdateRestaurantAiChatbotKnowledgeEnabled: async (_, { input, enabled }, ctx) => bulkUpdateRestaurantAiChatbotKnowledgeEnabled({ ids: input?.ids || [], enabled, ctx }),
  bulkDeleteRestaurantAiChatbotKnowledge: async (_, { input }, ctx) => bulkDeleteRestaurantAiChatbotKnowledge({ ids: input?.ids || [], ctx }),
  importRestaurantAiChatbotKnowledge: async (_, { input }, ctx) => importRestaurantAiChatbotKnowledge({ input, ctx }),
  rebuildRestaurantAiKnowledgeEmbeddings: async (_, { restaurantId }, ctx) => rebuildRestaurantAiKnowledgeEmbeddings({ restaurantId, ctx }),
  generateRestaurantAiChatbotKnowledgeSuggestions: async (_, { input }, ctx) => generateRestaurantAiChatbotKnowledgeSuggestions({ input, ctx }),
  approveRestaurantAiChatbotKnowledgeSuggestion: async (_, { id, input }, ctx) => approveRestaurantAiChatbotKnowledgeSuggestion({ id, input, ctx }),
  dismissRestaurantAiChatbotKnowledgeSuggestion: async (_, { id }, ctx) => dismissRestaurantAiChatbotKnowledgeSuggestion({ id, ctx }),
  deleteRestaurantAiChatbotKnowledgeSuggestion: async (_, { id }, ctx) => deleteRestaurantAiChatbotKnowledgeSuggestion({ id, ctx }),
  bulkDismissRestaurantAiChatbotKnowledgeSuggestions: async (_, { input }, ctx) => bulkDismissRestaurantAiChatbotKnowledgeSuggestions({ ids: input?.ids || [], ctx }),
  bulkDeleteRestaurantAiChatbotKnowledgeSuggestions: async (_, { input }, ctx) => bulkDeleteRestaurantAiChatbotKnowledgeSuggestions({ ids: input?.ids || [], ctx }),
  submitAiChatbotAnswerFeedback: async (_, { input }, ctx) => submitAiChatbotAnswerFeedback({ input, ctx }),
  markAiChatbotAnswerFeedbackReviewed: async (_, { id }, ctx) => markAiChatbotAnswerFeedbackReviewed({ id, ctx }),
  ignoreAiChatbotAnswerFeedback: async (_, { id }, ctx) => ignoreAiChatbotAnswerFeedback({ id, ctx }),
  convertAiChatbotFeedbackToSuggestion: async (_, { id }, ctx) => convertAiChatbotFeedbackToSuggestion({ id, ctx }),
  bulkMarkAiChatbotAnswerFeedbackReviewed: async (_, { input }, ctx) => bulkMarkAiChatbotAnswerFeedbackReviewed({ ids: input?.ids || [], ctx }),
  bulkIgnoreAiChatbotAnswerFeedback: async (_, { input }, ctx) => bulkIgnoreAiChatbotAnswerFeedback({ ids: input?.ids || [], ctx }),
  bulkConvertAiChatbotFeedbackToSuggestion: async (_, { input }, ctx) => bulkConvertAiChatbotFeedbackToSuggestion({ ids: input?.ids || [], ctx }),
  createRestaurantAiChatbotSafetyRule: async (_, { input }, ctx) => createRestaurantAiChatbotSafetyRule({ input, ctx }),
  updateRestaurantAiChatbotSafetyRule: async (_, { input }, ctx) => updateRestaurantAiChatbotSafetyRule({ input, ctx }),
  deleteRestaurantAiChatbotSafetyRule: async (_, { id }, ctx) => deleteRestaurantAiChatbotSafetyRule({ id, ctx }),
  bulkUpdateRestaurantAiChatbotSafetyRuleEnabled: async (_, { input, enabled }, ctx) => bulkUpdateRestaurantAiChatbotSafetyRuleEnabled({ ids: input?.ids || [], enabled, ctx }),
  bulkDeleteRestaurantAiChatbotSafetyRules: async (_, { input }, ctx) => bulkDeleteRestaurantAiChatbotSafetyRules({ ids: input?.ids || [], ctx }),
  createRestaurantAiChatbotEvaluationCase: async (_, { input }, ctx) => createRestaurantAiChatbotEvaluationCase({ input, ctx }),
  updateRestaurantAiChatbotEvaluationCase: async (_, { input }, ctx) => updateRestaurantAiChatbotEvaluationCase({ input, ctx }),
  deleteRestaurantAiChatbotEvaluationCase: async (_, { id }, ctx) => deleteRestaurantAiChatbotEvaluationCase({ id, ctx }),
  resolveAiChatbotHandoff: async (_, { input }, ctx) => {
    try {
      return await resolveRestaurantChatbotHandoff({
        input,
        user: ctx?.user || null,
        ctx,
        io: ctx?.io || null,
      });
    } catch (err) {
      throw new GraphQLError(err?.message || "Không thể đánh dấu phiên hỗ trợ đã xử lý", {
        extensions: { code: err?.code || "AI_CHATBOT_HANDOFF_RESOLVE_FAILED" },
      });
    }
  },
};

export default { Query, Mutation };
