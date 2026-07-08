import { TEST_MENU_ITEMS, TEST_RESTAURANT, TEST_USERS } from "./fixtures.js";

const jwtLikeToken = (roleName) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, roleName })).toString("base64url");
  return `smoke.${payload}.token`;
};

const makeCart = (items = []) => ({
  id: "test-cart-1",
  totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
  totalAmount: items.reduce((sum, item) => Number(sum) + Number(item.price || item.basePrice || 0) * Number(item.quantity || 1), 0),
  items,
});

const getUser = (authRole) => (authRole ? TEST_USERS[authRole] : null);

const AI_SETTINGS = {
  enabled: true,
  welcomeMessage:
    "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.",
  starterQuickReplies: [
    "Gợi ý món bán chạy cho tôi",
    "Tôi muốn đặt bàn",
    "Có mã giảm giá nào không?",
  ],
  handoffEnabled: true,
  handoffUnavailableMessage:
    "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.",
  lowConfidenceHandoffThreshold: 0.6,
  fallbackMessage:
    "Mình chưa đủ thông tin để trả lời chắc chắn. Bạn có muốn gặp nhân viên hỗ trợ không?",
};

const AI_KNOWLEDGE = [
  {
    id: "ai-knowledge-1",
    title: "Giờ mở cửa nhà hàng",
    content: "Nhà hàng mở cửa từ 08:00 đến 22:00 hằng ngày.",
    category: "hours",
    tags: ["giờ mở cửa", "thông tin"],
    enabled: true,
    priority: 10,
    sourceType: "manual",
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-02T08:00:00.000Z",
  },
];

const AI_SUGGESTIONS = [
  {
    id: "ai-suggestion-1",
    question: "Có món phù hợp cho 2 người không?",
    suggestedTitle: "Món phù hợp cho 2 người",
    suggestedContent: "Gợi ý combo hoặc món bán chạy phù hợp cho 2 người.",
    category: "menu",
    tags: ["menu", "combo"],
    triggerType: "no_knowledge_match",
    confidence: 0.72,
    status: "pending",
    occurrenceCount: 3,
    lastAskedAt: "2026-06-02T09:00:00.000Z",
    createdAt: "2026-06-02T09:00:00.000Z",
  },
];

const AI_FEEDBACK = [
  {
    id: "ai-feedback-1",
    question: "Nhà hàng có món chay không?",
    answer: "Mình chưa tìm thấy thông tin món chay.",
    rating: "not_helpful",
    reason: "Câu trả lời chưa rõ món chay hiện có.",
    tags: ["menu", "vegetarian"],
    sourceTypes: ["knowledge"],
    confidence: 0.4,
    status: "new",
    createdAt: "2026-06-02T10:00:00.000Z",
  },
];

const AI_SAFETY_RULES = [
  {
    id: "ai-safety-1",
    ruleType: "handoff_topic",
    pattern: "khiếu nại nghiêm trọng",
    responseMessage: "Mình sẽ chuyển bạn cho nhân viên để được hỗ trợ kỹ hơn.",
    enabled: true,
    priority: 20,
    createdAt: "2026-06-02T11:00:00.000Z",
    updatedAt: "2026-06-02T11:00:00.000Z",
  },
];

const AI_EVALUATION_CASES = [
  {
    id: "ai-eval-1",
    question: "Hôm nay nhà hàng mở cửa đến mấy giờ?",
    expectedBehavior: "Trả lời giờ mở cửa rõ ràng.",
    category: "hours",
    tags: ["hours"],
    enabled: true,
    createdAt: "2026-06-02T12:00:00.000Z",
    updatedAt: "2026-06-02T12:00:00.000Z",
  },
];

const AI_EVALUATION_RESULT = {
  caseId: null,
  question: "Hôm nay nhà hàng mở cửa đến mấy giờ?",
  expectedBehavior: "Trả lời giờ mở cửa rõ ràng.",
  category: "hours",
  tags: ["hours"],
  answer: "Nhà hàng mở cửa từ 08:00 đến 22:00 hằng ngày.",
  intent: "opening_hours",
  confidence: 0.91,
  isFallback: false,
  handoffSuggested: false,
  handoffReason: null,
  handoffMessage: null,
  quickReplies: ["Xem thực đơn", "Đặt bàn"],
  knowledgeMatches: [
    {
      id: "ai-knowledge-1",
      title: "Giờ mở cửa nhà hàng",
      category: "hours",
      sourceType: "manual",
      score: 0.91,
    },
  ],
  safetyResult: {
    blocked: false,
    outOfScope: false,
    disclaimers: [],
    handoffSuggested: false,
    matchedRuleIds: [],
  },
  sources: [],
};

export async function installSmokeApiMocks(page, { authRole = null } = {}) {
  const authUser = getUser(authRole);

  await page.route("**/api/auth/refresh", async (route) => {
    if (!authUser) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: jwtLikeToken(authUser.roleName), user: authUser }),
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/graphql", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON();
    const operationName = payload?.operationName || "";
    const variables = payload?.variables || {};
    const data = buildGraphqlData(operationName, variables, authUser);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
}

function buildGraphqlData(operationName, variables, authUser) {
  switch (operationName) {
    case "Me":
      return { me: authUser };
    case "GetRestaurants":
    case "AuthBusinessContext":
    case "ScopedRestaurants":
      return {
        refRestaurants: authUser?.roleName === "customer" ? [TEST_RESTAURANT] : [],
        scopedRestaurants: {
          edges: [{ cursor: TEST_RESTAURANT.id, node: TEST_RESTAURANT }],
          pageInfo: { endCursor: TEST_RESTAURANT.id, hasNextPage: false },
        },
      };
    case "GetTopMenuItems":
      return { topMenuItems: TEST_MENU_ITEMS };
    case "GetTopRestaurants":
      return { restaurantsTop: [TEST_RESTAURANT] };
    case "GetRestaurantsNearby":
      return { restaurantsNearby: [TEST_RESTAURANT] };
    case "GetRestaurantsByCategoryTimeSlot":
      return { restaurantsByCategoryTimeSlot: [TEST_RESTAURANT] };
    case "MeFoodPreferences":
      return { me: authUser };
    case "MyActiveCustomerCartForContext":
      return { myCart: null };
    case "ActiveMenuPromotions":
      return { promotionsByRestaurant: [] };
    case "CustomerFoodDetailV2":
    case "CustomerMenuItemForFoodDetail": {
      const menuItem =
        TEST_MENU_ITEMS.find((item) => item.id === variables.id) ||
        TEST_MENU_ITEMS[0];
      return {
        customerMenuItem: {
          ...menuItem,
          defaultServingKey:
            menuItem.defaultServingKey || menuItem.servingVariants?.[0]?.key || "portion",
          ingredientNames: menuItem.ingredientNames || ["Nguyên liệu smoke test"],
          foodType: menuItem.foodType || "NON_VEGETARIAN",
          meatTypes: menuItem.meatTypes || [],
          servingPortion: menuItem.servingPortion || 1,
          servingUnit: menuItem.servingUnit || "phần",
        },
      };
    }
    case "GetMenuItemsForFoodDetail":
      return {
        menuItemsConnection: {
          edges: TEST_MENU_ITEMS.map((node) => ({ node })),
          pageInfo: { endCursor: TEST_MENU_ITEMS.at(-1).id, hasNextPage: false },
        },
      };
    case "PublicRestaurantForFoodDetailV2":
    case "PublicRestaurantByIdForFoodDetail":
      return { publicRestaurant: TEST_RESTAURANT };
    case "CustomerModifierGroupsForFoodDetail":
      return { customerModifierGroups: [] };
    case "FoodReviewSummaryV2":
      return {
        reviewStats: { total: 0, avgRating: 0 },
        reviews: { total: 0, items: [] },
      };
    case "GetFoodReviewsForFoodDetail":
      return { reviews: { total: 0, items: [] } };
    case "MyFoodFavoritesForFoodDetailV2":
      return { myFavorites: [] };
    case "ToggleFavoriteForFoodDetailV2":
      return {
        toggleFavorite: {
          id: "smoke-favorite-1",
          type: "food",
          targetId: variables.input?.targetId || TEST_MENU_ITEMS[0].id,
        },
      };
    case "MenuItemLiveStateForFoodDetailV2":
    case "MenuItemLiveState":
      return {
        menuItemLiveState: {
          itemType: "MENU_ITEM",
          viewerCount: 1,
          maxAvailableQty: 20,
          outOfStock: false,
          blocked: false,
          blockedUntil: null,
          abuseWarning: null,
          policyMessage: "Smoke inventory policy",
          holdTtlSeconds: 600,
          myCartQty: 0,
          myHoldExpiresAt: null,
          reservedCartQty: 0,
        },
      };
    case "AddCartItemFromFoodDetailV2":
    case "AddCartItem":
    case "AddCartItemFromHome": {
      const input = variables.input || {};
      const menuItem = TEST_MENU_ITEMS.find((item) => item.id === input.menuItemId) || TEST_MENU_ITEMS[0];
      return {
        addCartItem: makeCart([
          {
            id: "test-cart-item-1",
            itemType: "MENU_ITEM",
            restaurantId: input.restaurantId || menuItem.restaurantId,
            menuItemId: input.menuItemId || menuItem.id,
            name: menuItem.name,
            price: menuItem.basePrice,
            modifiersPrice: 0,
            modifiers: [],
            quantity: input.quantity || 1,
            thumbImage: menuItem.thumbImage,
            note: input.note || null,
            servingVariantKey: input.servingVariantKey || "regular",
            holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            holdStatus: "active",
          },
        ]),
      };
    }
    case "CreateCheckoutOrders":
      return {
        createCheckoutOrders: {
          orders: [{ id: "test-order-1", status: "pending", totalAmount: 79000 }],
          paymentRequest: null,
        },
      };

    case "ManagerAiSettings":
      return { restaurantAiChatbotSettings: AI_SETTINGS };
    case "UpdateManagerAiSettings":
      return {
        updateRestaurantAiChatbotSettings: {
          ...AI_SETTINGS,
          ...(variables.input || {}),
          updatedAt: new Date().toISOString(),
        },
      };
    case "AiChatbotAnalytics":
      return {
        aiChatbotAnalytics: {
          totalConversations: 42,
          totalMessages: 126,
          openConversations: 5,
          handoffRequested: 6,
          resolvedHandoffs: 4,
          fallbackResponses: 2,
          lowConfidenceResponses: 3,
          handoffConversionRate: 0.14,
          averageMessagesPerConversation: 3,
          averageHandoffResolutionMinutes: 8.5,
          topIntents: [
            { intent: "menu", count: 18 },
            { intent: "booking", count: 8 },
            { intent: "coupon", count: 4 },
          ],
          messagesByRole: [
            { role: "customer", count: 70 },
            { role: "assistant", count: 52 },
            { role: "staff", count: 4 },
          ],
          rateLimitStatus: [
            { action: "askAiChatbot", max: 20, windowMs: 300000 },
            { action: "requestAiChatbotHandoff", max: 3, windowMs: 600000 },
          ],
          pendingSuggestions: 1,
          notHelpfulFeedback: 1,
          activeSafetyRules: 1,
          evaluationCaseCount: 1,
          riskySignals: [
            { code: "PENDING_SUGGESTION_BACKLOG", level: "low", count: 1 },
          ],
          recentQualityQueue: [
            {
              id: "quality-fallback-1",
              type: "fallback_response",
              label: "menu",
              detail: "Khách hỏi món chay nhưng thiếu tri thức trả lời.",
              createdAt: "2026-06-02T10:00:00.000Z",
            },
            {
              id: "quality-suggestion-1",
              type: "pending_suggestion",
              label: "knowledge",
              detail: "Gợi ý món phù hợp cho 2 người.",
              createdAt: "2026-06-02T11:00:00.000Z",
            },
          ],
        },
      };
    case "ManagerAiKnowledge":
      return { restaurantAiChatbotKnowledge: AI_KNOWLEDGE };
    case "ManagerAiKnowledgeSuggestions":
      return { restaurantAiChatbotKnowledgeSuggestions: AI_SUGGESTIONS };
    case "ManagerAiFeedback":
      return { restaurantAiChatbotAnswerFeedback: AI_FEEDBACK };
    case "ManagerAiSafetyRules":
      return { restaurantAiChatbotSafetyRules: AI_SAFETY_RULES };
    case "ManagerAiEvaluationCases":
      return { restaurantAiChatbotEvaluationCases: AI_EVALUATION_CASES };
    case "ExportManagerAiKnowledge":
      return { exportRestaurantAiChatbotKnowledge: JSON.stringify(AI_KNOWLEDGE, null, 2) };
    case "EvaluateManagerAiPrompt":
      return { evaluateRestaurantAiChatbotPrompt: { ...AI_EVALUATION_RESULT, question: variables.input?.message || AI_EVALUATION_RESULT.question } };
    case "RunManagerAiEvaluationSet":
      return { runRestaurantAiChatbotEvaluationSet: [AI_EVALUATION_RESULT] };
    case "ImportManagerAiKnowledge":
      return { importRestaurantAiChatbotKnowledge: { imported: 1, skipped: 0, errors: [] } };
    case "GenerateManagerAiKnowledgeSuggestions":
      return {
        generateRestaurantAiChatbotKnowledgeSuggestions: {
          created: 3,
          updated: 0,
          skipped: 1,
          total: 4,
          suggestions: [
            {
              id: "auto-suggestion-1",
              question: "Nhà hàng mở cửa lúc nào?",
              suggestedTitle: "Giờ mở cửa nhà hàng",
              suggestedContent: "Nhà hàng mở cửa từ 9:00 đến 22:00 hằng ngày.",
              category: "opening_hours",
              tags: ["giờ mở cửa", "nhà hàng"],
              triggerType: "no_knowledge_match",
              confidence: 0.96,
              status: "pending",
              occurrenceCount: 1,
              lastAskedAt: "2026-06-02T09:12:00.000Z",
              createdAt: "2026-06-02T09:12:00.000Z",
            },
          ],
        },
      };
    case "CreateManagerAiKnowledge":
      return { createRestaurantAiChatbotKnowledgeItem: { id: "ai-knowledge-new" } };
    case "UpdateManagerAiKnowledge":
      return { updateRestaurantAiChatbotKnowledgeItem: { id: variables.input?.id || "ai-knowledge-1" } };
    case "DeleteManagerAiKnowledge":
      return { deleteRestaurantAiChatbotKnowledgeItem: true };
    case "BulkKnowledgeEnabled":
      return { bulkUpdateRestaurantAiChatbotKnowledgeEnabled: true };
    case "BulkDeleteKnowledge":
      return { bulkDeleteRestaurantAiChatbotKnowledge: true };
    case "ApproveManagerAiSuggestion":
      return { approveRestaurantAiChatbotKnowledgeSuggestion: { id: variables.id || "ai-suggestion-1" } };
    case "DismissManagerAiSuggestion":
      return { dismissRestaurantAiChatbotKnowledgeSuggestion: true };
    case "DeleteManagerAiSuggestion":
      return { deleteRestaurantAiChatbotKnowledgeSuggestion: true };
    case "BulkDismissManagerAiSuggestions":
      return { bulkDismissRestaurantAiChatbotKnowledgeSuggestions: true };
    case "BulkDeleteManagerAiSuggestions":
      return { bulkDeleteRestaurantAiChatbotKnowledgeSuggestions: true };
    case "MarkAiFeedbackReviewed":
      return { markAiChatbotAnswerFeedbackReviewed: true };
    case "IgnoreAiFeedback":
      return { ignoreAiChatbotAnswerFeedback: true };
    case "ConvertAiFeedback":
      return { convertAiChatbotFeedbackToSuggestion: true };
    case "BulkAiFeedbackReviewed":
      return { bulkMarkAiChatbotAnswerFeedbackReviewed: true };
    case "BulkAiFeedbackIgnore":
      return { bulkIgnoreAiChatbotAnswerFeedback: true };
    case "BulkAiFeedbackConvert":
      return { bulkConvertAiChatbotFeedbackToSuggestion: true };
    case "CreateManagerAiSafetyRule":
      return { createRestaurantAiChatbotSafetyRule: { id: "ai-safety-new" } };
    case "UpdateManagerAiSafetyRule":
      return { updateRestaurantAiChatbotSafetyRule: { id: variables.input?.id || "ai-safety-1" } };
    case "DeleteManagerAiSafetyRule":
      return { deleteRestaurantAiChatbotSafetyRule: true };
    case "BulkAiSafetyEnabled":
      return { bulkUpdateRestaurantAiChatbotSafetyRuleEnabled: true };
    case "BulkAiSafetyDelete":
      return { bulkDeleteRestaurantAiChatbotSafetyRules: true };
    case "CreateManagerAiEvalCase":
      return { createRestaurantAiChatbotEvaluationCase: { id: "ai-eval-new" } };
    case "UpdateManagerAiEvalCase":
      return { updateRestaurantAiChatbotEvaluationCase: { id: variables.input?.id || "ai-eval-1" } };
    case "DeleteManagerAiEvalCase":
      return { deleteRestaurantAiChatbotEvaluationCase: true };
    default:
      return {};
  }
}

export async function expectNoPageCrash(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("body").waitFor({ state: "visible" });
}
