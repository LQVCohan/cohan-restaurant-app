from pathlib import Path
import re


def replace_between(text, start, end, replacement):
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    return text[:start_index] + replacement + text[end_index:]


# Integrate feedback controls directly in the widget.
widget_path = Path("src/components/common/AiChatbotWidget.jsx")
widget = widget_path.read_text()
import_marker = 'import "./AiChatbotWidget.scss";\n'
direct_import = 'import AiChatbotFeedbackControls from "./AiChatbotFeedbackControls";\n'
if direct_import not in widget:
    widget = widget.replace(import_marker, import_marker + direct_import, 1)
widget = widget.replace('  const [feedbackSent, setFeedbackSent] = useState({});\n', '')
feedback_pattern = re.compile(
    r'''                  \{item\.role === "assistant" && item\.meta\?\.conversationId \? \(\n                    <div\n                      className="ai-chatbot-actions"\n                      style=\{\{ marginTop: 6 \}\}\n                    >\n.*?\n                    </div>\n                  \) : null\}''',
    re.S,
)
feedback_replacement = '''                  {item.role === "assistant" && item.meta?.conversationId ? (\n                    <AiChatbotFeedbackControls\n                      item={item}\n                      index={index}\n                      messages={messages}\n                      restaurantId={item.meta?.resolvedRestaurantId || restaurantId}\n                      guestId={guestId}\n                      submitFeedback={submitFeedback}\n                    />\n                  ) : null}'''
widget, replacement_count = feedback_pattern.subn(
    feedback_replacement,
    widget,
    count=1,
)
if replacement_count != 1:
    raise RuntimeError(
        f"Expected one legacy feedback block, replaced {replacement_count}"
    )
widget_path.write_text(widget)

vite_path = Path("vite.config.js")
vite = vite_path.read_text()
vite = vite.replace(
    'import { aiChatbotFeedbackControlsPlugin } from "./build/aiChatbotFeedbackControlsPlugin.js";\n',
    '',
)
vite = vite.replace('      aiChatbotFeedbackControlsPlugin(),\n', '')
vite_path.write_text(vite)

# Route GraphQL directly to the real service after folding reviewed behavior into it.
resolver_path = Path("cohan-restaurant-backend/graphql/resolvers/aiChatbot/index.js")
resolver = resolver_path.read_text().replace(
    'import { handleRestaurantChatbotMessage } from "../../../src/services/ai/restaurantChatbotReviewed.service.js";',
    'import { handleRestaurantChatbotMessage } from "../../../src/services/ai/restaurantChatbot.service.js";',
)
resolver_path.write_text(resolver)

service_path = Path(
    "cohan-restaurant-backend/src/services/ai/restaurantChatbot.service.js"
)
service = service_path.read_text()

# Selected menu item ownership must be verified before any client restaurant scope.
service = replace_between(
    service,
    'const findVerifiedMenuItemOwner = async (selectedMenuItem = null) => {',
    'const candidateDto = (restaurant, reason = "candidate") => ({',
    '''const findVerifiedMenuItemOwner = async (selectedMenuItem = null) => {\n  const itemId = selectedMenuItem?.id || selectedMenuItem?.menuItemId;\n  const oid = toObjectId(itemId);\n  if (!oid) return { menuItem: null, restaurant: null };\n  const item = await selectLean(MenuItem.findById ? MenuItem.findById(oid) : null);\n  if (\n    !item?.restaurantId ||\n    item.status !== "available" ||\n    item.isAvailable === false\n  ) {\n    return { menuItem: item || null, restaurant: null };\n  }\n  const restaurant = await fetchEligibleRestaurantById(item.restaurantId);\n  return restaurant\n    ? { menuItem: item, restaurant }\n    : { menuItem: item, restaurant: null };\n};\n\n''',
)

service = replace_between(
    service,
    'const resolveRestaurantScope = async ({ restaurantId, message, pageContext, user }) => {',
    'const fetchRestaurants = async ({ scope, message }) => {',
    '''const resolveRestaurantScope = async ({ restaurantId, message, pageContext, user }) => {\n  const currentPage = normalizePageContext(pageContext, restaurantId, user);\n  const selectedMenuItem = currentPage.selectedMenuItem;\n\n  if (selectedMenuItem?.id) {\n    const verifiedSelection = await findVerifiedMenuItemOwner(selectedMenuItem);\n    if (!verifiedSelection.restaurant) {\n      return { mode: "global", restaurantId: null, restaurant: null, reason: "unavailable", candidates: [], isResolved: false, currentPage };\n    }\n\n    const verifiedRestaurantId = toIdString(verifiedSelection.restaurant);\n    const suppliedRestaurantIds = [\n      restaurantId,\n      pageContext?.restaurantId,\n      pageContext?.selectedMenuItem?.restaurantId,\n    ].filter(Boolean).map(String);\n\n    if (suppliedRestaurantIds.some((id) => id !== verifiedRestaurantId)) {\n      return { mode: "global", restaurantId: null, restaurant: null, reason: "unavailable", candidates: [], isResolved: false, currentPage };\n    }\n\n    return {\n      mode: "restaurant",\n      restaurantId: verifiedRestaurantId,\n      restaurant: verifiedSelection.restaurant,\n      reason: "verifiedSelectedMenuItem",\n      candidates: [candidateDto(verifiedSelection.restaurant, "selectedMenuItem")],\n      isResolved: true,\n      currentPage: {\n        ...currentPage,\n        restaurantId: verifiedRestaurantId,\n        selectedMenuItem: { ...selectedMenuItem, restaurantId: verifiedRestaurantId },\n      },\n    };\n  }\n\n  const directCandidate = restaurantId || currentPage.restaurantId;\n  if (directCandidate) {\n    const restaurant = await fetchEligibleRestaurantById(directCandidate);\n    if (!restaurant) {\n      return { mode: "global", restaurantId: null, restaurant: null, reason: "unavailable", candidates: [], isResolved: false, currentPage };\n    }\n    return { mode: "restaurant", restaurantId: toIdString(restaurant), restaurant, reason: restaurantId ? "inputRestaurantId" : "pageContextRestaurantId", candidates: [candidateDto(restaurant, "resolved")], isResolved: true, currentPage: { ...currentPage, restaurantId: toIdString(restaurant) } };\n  }\n\n  const restaurantMatches = await findEligibleRestaurantsByMessage(message, 6);\n  if (restaurantMatches.length === 1) {\n    const restaurant = restaurantMatches[0];\n    return { mode: "restaurant", restaurantId: toIdString(restaurant), restaurant, reason: "uniqueRestaurantName", candidates: [candidateDto(restaurant, "uniqueName")], isResolved: true, currentPage: { ...currentPage, restaurantId: toIdString(restaurant) } };\n  }\n  return { mode: "global", restaurantId: null, restaurant: null, reason: restaurantMatches.length > 1 ? "ambiguousRestaurantName" : "global", candidates: restaurantMatches.map((restaurant) => candidateDto(restaurant, "nameMatch")), isResolved: false, currentPage: { ...currentPage, restaurantId: null } };\n};\n\n''',
)

service = service.replace(
    '  const filter = { status: "available" };',
    '  const filter = { status: "available", isAvailable: { $ne: false } };',
    1,
)
service = service.replace(
    'MenuItem.find({ restaurantId: toObjectId(scope.restaurantId), status: "available" })',
    'MenuItem.find({ restaurantId: toObjectId(scope.restaurantId), status: "available", isAvailable: { $ne: false } })',
    1,
)

# Coupon discovery is independent of restaurant metadata matches.
service = replace_between(
    service,
    'const fetchCoupons = async ({ scope, eligibleRestaurants = [] }) => {',
    '// Phase 26 deliberately does not cache order/cart/reservation/profile context:',
    '''const fetchCoupons = async ({ scope }) => {\n  const now = new Date();\n  const filter = {\n    isActive: true,\n    $and: [\n      { $or: [{ startAt: null }, { startAt: { $exists: false } }, { startAt: { $lte: now } }] },\n      { $or: [{ endAt: null }, { endAt: { $exists: false } }, { endAt: { $gte: now } }] },\n    ],\n  };\n  if (scope?.mode === "restaurant" && scope.restaurantId) {\n    filter.$or = [{ restaurantId: toObjectId(scope.restaurantId) }, { restaurantId: null }];\n  }\n\n  const query = Coupon.find(filter);\n  let coupons = typeof query.sort === "function"\n    ? await query.sort({ discountValue: -1, endAt: 1, updatedAt: -1 }).limit(scope?.mode === "restaurant" ? 8 : 24).lean()\n    : await runQuery(query);\n  coupons = Array.isArray(coupons) ? coupons : [];\n\n  const ownerIds = [...new Set(coupons.map((coupon) => String(coupon.restaurantId || "")).filter(Boolean))];\n  const owners = await fetchEligibleRestaurantsByIds(ownerIds);\n  const ownerMap = new Map(owners.map((restaurant) => [toIdString(restaurant), restaurant]));\n\n  return coupons\n    .filter((coupon) => !coupon.restaurantId || ownerMap.has(String(coupon.restaurantId)))\n    .map((coupon) => ({\n      ...coupon,\n      restaurant: coupon.restaurantId\n        ? ownerMap.get(String(coupon.restaurantId))\n        : null,\n    }))\n    .slice(0, 6);\n};\n\n''',
)

# Merge menu/coupon owners into global context and menu-first candidates without
# changing trusted scope mode.
service = replace_between(
    service,
    'const buildContext = async ({ message, user, pageContext = {}, scope }) => {',
    'const safeJsonParse = (raw) => {',
    '''const buildContext = async ({ message, user, pageContext = {}, scope }) => {\n  const intent = classifyIntent(message);\n  const menuPreferences = extractMenuPreferences(message);\n  const isMenuAssistant = isMenuAssistantRequest(message, intent, menuPreferences);\n  const currentPage = scope?.currentPage || normalizePageContext(pageContext, scope?.restaurantId, user);\n  const metadataRestaurants = await fetchRestaurants({ scope, message });\n  const [menuItems, coupons, orders, reservations, cart] = await Promise.all([\n    fetchMenuItems({ scope, message, limit: isMenuAssistant ? 30 : 8 }),\n    fetchCoupons({ scope }),\n    fetchOrders({ restaurantId: scope?.restaurantId, message, user }),\n    fetchReservations({ restaurantId: scope?.restaurantId, message, user }),\n    fetchCart({ user }),\n  ]);\n\n  const restaurantLookup = new Map(metadataRestaurants.map((restaurant) => [toIdString(restaurant), restaurant]));\n  for (const item of menuItems || []) {\n    if (item?.restaurant) restaurantLookup.set(toIdString(item.restaurant), item.restaurant);\n  }\n  for (const coupon of coupons || []) {\n    if (coupon?.restaurant) restaurantLookup.set(toIdString(coupon.restaurant), coupon.restaurant);\n  }\n  const restaurants = [...restaurantLookup.values()];\n\n  const candidateMap = new Map();\n  for (const candidate of scope?.candidates || []) {\n    if (candidate?.restaurantId) candidateMap.set(String(candidate.restaurantId), candidate);\n  }\n  if (scope?.mode !== "restaurant") {\n    for (const item of menuItems || []) {\n      const owner = item?.restaurant;\n      const ownerId = owner ? toIdString(owner) : String(item?.restaurantId || "");\n      if (!ownerId || candidateMap.has(ownerId)) continue;\n      candidateMap.set(\n        ownerId,\n        candidateDto(owner || { _id: ownerId, name: item?.restaurantName }, "menuMatch"),\n      );\n    }\n  }\n\n  const serializedMenuItems = menuItems.map((item) => serializeMenuItem(item, scope?.restaurant?.defaultCurrency || "VND", item.restaurant || scope?.restaurant));\n  const recommendedMenuItems = rankMenuRecommendations(serializedMenuItems, menuPreferences, 10);\n  const userSafeProfile = buildUserSafeProfile(user);\n  const matchedFeatureMapEntries = sanitizeFeatureMatches(pageContext?.featureMatches || [], currentPage.userRole || userSafeProfile.role);\n  const scopeMode = scope?.mode === "restaurant" ? "restaurant" : "global";\n  return {\n    intent,\n    scopeMode,\n    resolvedRestaurantId: scope?.mode === "restaurant" ? scope.restaurantId : null,\n    scopeCandidates: [...candidateMap.values()].slice(0, 6),\n    scopeReason: scope?.reason || "global",\n    user: userSafeProfile,\n    userSafeProfile,\n    currentPage,\n    matchedFeatureMapEntries,\n    cartSummary: cart ? serializeCart(cart, scope?.restaurant?.defaultCurrency || "VND") : null,\n    restaurants: restaurants.map(serializeRestaurant),\n    menuItems: (isMenuAssistant ? recommendedMenuItems : serializedMenuItems).slice(0, 10),\n    recommendedMenuItems: recommendedMenuItems.slice(0, 10),\n    menuPreferences,\n    coupons: coupons.map((coupon) => serializeCoupon(coupon, scope?.restaurant?.defaultCurrency || "VND", restaurantLookup)).slice(0, 6),\n    orders: orders.map((order) => serializeOrder(order, scope?.restaurant?.defaultCurrency || "VND")),\n    reservations: reservations.map((reservation) => serializeReservation(reservation, scope?.restaurant?.defaultCurrency || "VND")),\n  };\n};\n\n''',
)

# Global coupons deterministically use VND; restaurant coupons use owner currency.
service = service.replace(
    '  const couponCurrency = owner?.defaultCurrency || currency || "VND";',
    '  // Global coupons have no owner currency, so the platform default is deterministically VND.\n  const couponCurrency = owner?.defaultCurrency || currency || "VND";',
    1,
)
service = service.replace(
    '  ...(context.coupons || []).slice(0, 2).map((item) => ({ type: "coupon", id: item.id, label: item.restaurantName ? `${item.code} (${item.restaurantName})` : item.code, restaurantId: item.restaurantId || null, restaurantName: item.restaurantName || null })),',
    '  ...(context.coupons || []).slice(0, 6).map((item) => ({ type: "coupon", id: item.id, label: item.restaurantName ? `${item.code} (${item.restaurantName})` : item.code, restaurantId: item.restaurantId || null, restaurantName: item.restaurantName || null, currency: item.currency || "VND" })),',
    1,
)

service = replace_between(
    service,
    'const promotionFallback = (context) => {',
    'const restaurantInfoFallback = (context) => {',
    '''const promotionFallback = (context) => {\n  const coupons = context.coupons || [];\n  if (!coupons.length) return "Hiện mình chưa thấy coupon đang hoạt động phù hợp. Bạn có thể kiểm tra lại trong trang coupon của nhà hàng hoặc hỏi mình gợi ý combo/menu tiết kiệm.";\n  const lines = coupons.slice(0, 6).map((coupon) => {\n    const value = coupon.discountType === "AMOUNT"\n      ? formatCurrency(coupon.discountValue, coupon.currency)\n      : `${coupon.discountValue}%`;\n    const scope = coupon.restaurantName ? ` tại ${coupon.restaurantName}` : " trên hệ thống";\n    const minimum = coupon.minOrderValue ? `, đơn tối thiểu ${coupon.formattedMinOrder}` : "";\n    const maximum = coupon.maxDiscount ? `, giảm tối đa ${coupon.formattedMaxDiscount}` : "";\n    return `- ${coupon.code}${scope}: ${coupon.name} giảm ${value}${minimum}${maximum}`;\n  });\n  return `Các ưu đãi có thể dùng:\\n${lines.join("\\n")}`;\n};\n\n\n''',
)

# Support copy and actions must agree with scope and public handoff settings.
service = service.replace(
    '    support: () => "Mình có thể hỗ trợ nhanh về menu, đặt bàn, đơn hàng, coupon. Nếu cần người thật xử lý, bạn có thể bấm Gặp nhân viên để người thật hỗ trợ trực tiếp.",',
    '    support: () => context.scopeMode === "restaurant"\n      ? "Mình có thể hỗ trợ nhanh về menu, đặt bàn, đơn hàng và coupon. Nếu cần người thật xử lý, bạn có thể bấm Gặp nhân viên."\n      : "Bạn hãy chọn nhà hàng trước để mình kết nối đúng nhân viên hỗ trợ.",',
    1,
)
service = service.replace(
    '  if (responseData?.isFallback && aiSettings.fallbackMessage) responseData.answer = aiSettings.fallbackMessage;',
    '  if (responseData?.isFallback && aiSettings.fallbackMessage) responseData.answer = aiSettings.fallbackMessage;\n  if (context.intent === "promotion" && context.coupons.length) {\n    responseData.answer = promotionFallback(context);\n    responseData.sources = fallbackSources(context);\n  }',
    1,
)
old_handoff = '''  finalResponse.handoffSuggested = scope.mode === "restaurant" && handoffDecision.suggested;\n  finalResponse.handoffReason = scope.mode === "restaurant" ? handoffDecision.reason : null;\n  finalResponse.handoffMessage = finalResponse.handoffSuggested\n    ? "Nếu bạn cần hỗ trợ thêm, bạn có thể bấm 'Gặp nhân viên' để được hỗ trợ bởi người thật."\n    : null;'''
new_handoff = '''  const handoffAvailable = scope.mode === "restaurant" && aiSettings.handoffEnabled !== false;\n  finalResponse.handoffSuggested = handoffAvailable && handoffDecision.suggested;\n  finalResponse.handoffReason = handoffAvailable ? handoffDecision.reason : null;\n  finalResponse.handoffMessage = finalResponse.handoffSuggested\n    ? "Nếu bạn cần hỗ trợ thêm, bạn có thể bấm 'Gặp nhân viên' để được hỗ trợ bởi người thật."\n    : null;\n  if (!handoffAvailable) {\n    finalResponse.actions = (finalResponse.actions || []).filter((action) => action?.type !== "handoff");\n    if (finalResponse.intent === "support") {\n      finalResponse.answer = scope.mode === "restaurant"\n        ? aiSettings.handoffUnavailableMessage || "Nhà hàng này hiện chưa bật hỗ trợ trực tiếp qua chatbot."\n        : "Bạn hãy chọn nhà hàng trước để mình kết nối đúng nhân viên hỗ trợ.";\n    }\n  }'''
if old_handoff not in service:
    raise RuntimeError("Expected handoff decision block was not found")
service = service.replace(old_handoff, new_handoff, 1)

service = service.replace(
    '  isEligibleRestaurant,\n};',
    '  isEligibleRestaurant,\n  findVerifiedMenuItemOwner,\n  fetchCoupons,\n  buildContext,\n  promotionFallback,\n};',
    1,
)
service_path.write_text(service)

# Add an explicit global feedback omission assertion to the direct component tests.
feedback_test_path = Path("src/components/common/AiChatbotFeedbackControls.test.jsx")
feedback_test = feedback_test_path.read_text()
if 'omits restaurantId for verified global feedback' not in feedback_test:
    insertion = '''\n  it("omits restaurantId for verified global feedback", async () => {\n    const submitFeedback = vi.fn().mockResolvedValue({ data: {} });\n    renderControls(submitFeedback, "");\n\n    fireEvent.click(screen.getByRole("button", { name: "Hữu ích" }));\n\n    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1));\n    const input = submitFeedback.mock.calls[0][0].variables.input;\n    expect(input).not.toHaveProperty("restaurantId");\n    expect(input).toMatchObject({\n      conversationId: "conversation-1",\n      messageId: "message-1",\n      rating: "helpful",\n    });\n  });\n'''
    feedback_test = feedback_test[: feedback_test.rfind('\n});')] + insertion + '\n});\n'
    feedback_test_path.write_text(feedback_test)

# Focused behavioral tests for selected-owner scope, menu-first candidates,
# global coupons, handoff consistency and coupon currency.
backend_test_path = Path(
    "cohan-restaurant-backend/tests/services/restaurantChatbot.review-fixes.service.test.js"
)
backend_test_path.write_text(r'''import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  restaurants: [],
  metadataRestaurants: [],
  menuItems: [],
  coupons: [],
}));

const idOf = (value) => String(value?._id || value?.id || value || "");

vi.mock("../../models/index.js", () => {
  const cloneRows = (rows) => rows.map((row) => ({ ...row }));
  const chain = (initial) => {
    let rows = Array.isArray(initial) ? cloneRows(initial) : initial;
    return {
      sort() { return this; },
      limit(limit) {
        if (Array.isArray(rows)) rows = rows.slice(0, limit);
        return this;
      },
      select() { return this; },
      lean: async () => Array.isArray(rows) ? cloneRows(rows) : rows ? { ...rows } : rows,
    };
  };
  const filterRestaurants = (filter = {}) => {
    if (filter?._id?.$in) {
      const allowed = new Set(filter._id.$in.map(String));
      return state.restaurants.filter((row) => allowed.has(idOf(row)));
    }
    return state.metadataRestaurants;
  };
  const filterCoupons = (filter = {}) => {
    if (!Array.isArray(filter.$or)) return state.coupons;
    const allowed = new Set();
    let includeGlobal = false;
    for (const clause of filter.$or) {
      if (clause.restaurantId === null) includeGlobal = true;
      else if (clause.restaurantId) allowed.add(String(clause.restaurantId));
    }
    return state.coupons.filter((coupon) =>
      coupon.restaurantId
        ? allowed.has(String(coupon.restaurantId))
        : includeGlobal,
    );
  };
  return {
    Restaurant: {
      findById: (id) => chain(state.restaurants.find((row) => idOf(row) === String(id)) || null),
      find: (filter) => chain(filterRestaurants(filter)),
    },
    MenuItem: {
      findById: (id) => chain(state.menuItems.find((row) => idOf(row) === String(id)) || null),
      find: (filter = {}) => chain(state.menuItems.filter((row) => {
        if (filter.restaurantId && String(row.restaurantId) !== String(filter.restaurantId)) return false;
        if (filter.status && row.status !== filter.status) return false;
        if (filter.isAvailable?.$ne === false && row.isAvailable === false) return false;
        return true;
      })),
    },
    Coupon: { find: (filter) => chain(filterCoupons(filter)) },
    Order: { find: () => chain([]) },
    Reservation: { find: () => chain([]) },
    Cart: { findOne: () => chain(null) },
    AiChatConversation: {
      findById: () => chain(null),
      findOne: () => chain(null),
      create: vi.fn(),
      updateOne: vi.fn(),
    },
    AiChatMessage: {
      find: () => chain([]),
      create: vi.fn(),
    },
  };
});

vi.mock("../../src/services/ai/restaurantChatbotRateLimit.service.js", () => ({
  AI_CHATBOT_RATE_LIMIT_POLICIES: { askAiChatbot: "ask" },
  AI_CHATBOT_RATE_LIMIT_CODE: "RATE_LIMITED",
  AI_CHATBOT_RATE_LIMIT_MESSAGE: "rate limited",
  consumeAiChatbotRateLimit: () => ({ allowed: true }),
}));
vi.mock("../../src/services/ai/restaurantChatbotSettings.service.js", () => ({
  mergeWithDefaultAiChatbotSettings: (settings = {}) => ({
    enabled: true,
    handoffEnabled: true,
    lowConfidenceHandoffThreshold: 0.6,
    starterQuickReplies: [],
    ...settings,
  }),
}));
vi.mock("../../src/services/ai/restaurantChatbotKnowledge.service.js", () => ({
  findRelevantKnowledgeForChatbot: async () => [],
}));
vi.mock("../../src/services/ai/restaurantChatbotKnowledgeSuggestion.service.js", () => ({
  recordKnowledgeGapSuggestion: async () => null,
}));
vi.mock("../../src/services/ai/restaurantChatbotSafety.service.js", () => ({
  evaluateRestaurantAiChatbotSafety: async () => ({
    blocked: false,
    outOfScope: false,
    disclaimers: [],
    handoffSuggested: false,
    matchedRules: [],
  }),
}));
vi.mock("../../src/services/ai/localAiProvider.service.js", () => ({
  callLocalChatProvider: async () => null,
}));

import {
  __testables,
  handleRestaurantChatbotMessage,
} from "../../src/services/ai/restaurantChatbot.service.js";

const A = "507f1f77bcf86cd7994390a1";
const B = "507f1f77bcf86cd7994390b2";
const C = "507f1f77bcf86cd7994390c3";
const ITEM_A = "507f1f77bcf86cd7994391a1";
const ITEM_B = "507f1f77bcf86cd7994391b2";

const restaurant = (id, overrides = {}) => ({
  _id: id,
  name: `Restaurant ${id.slice(-2)}`,
  businessStatus: "active",
  publicationStatus: "published",
  defaultCurrency: "VND",
  aiChatbotSettings: { enabled: true, handoffEnabled: true },
  ...overrides,
});
const menuItem = (id, restaurantId, overrides = {}) => ({
  _id: id,
  restaurantId,
  name: "Bún bò",
  description: "Bún bò Huế",
  status: "available",
  isAvailable: true,
  basePrice: 80000,
  ...overrides,
});

beforeEach(() => {
  state.restaurants = [restaurant(A), restaurant(B)];
  state.metadataRestaurants = [];
  state.menuItems = [];
  state.coupons = [];
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.AI_PROVIDER;
});

describe("restaurant chatbot PR 1187 review regressions", () => {
  it("rejects a selected menu item from A when the client supplies B", async () => {
    state.menuItems = [menuItem(ITEM_A, A)];
    const scope = await __testables.resolveRestaurantScope({
      restaurantId: B,
      pageContext: { restaurantId: B, selectedMenuItem: { id: ITEM_A, restaurantId: B } },
      message: "Bún bò",
      user: null,
    });
    expect(scope).toMatchObject({ mode: "global", reason: "unavailable", restaurantId: null });
  });

  it("rejects unavailable selected menu items", async () => {
    state.menuItems = [menuItem(ITEM_A, A, { status: "unavailable", isAvailable: false })];
    const scope = await __testables.resolveRestaurantScope({
      pageContext: { selectedMenuItem: { id: ITEM_A } },
      message: "Bún bò",
      user: null,
    });
    expect(scope.reason).toBe("unavailable");
  });

  it.each([
    { businessStatus: "inactive" },
    { publicationStatus: "draft" },
    { aiChatbotSettings: { enabled: false } },
  ])("rejects a selected item whose owner is unavailable: %o", async (ownerOverride) => {
    state.restaurants = [restaurant(A, ownerOverride)];
    state.menuItems = [menuItem(ITEM_A, A)];
    const scope = await __testables.resolveRestaurantScope({
      pageContext: { selectedMenuItem: { id: ITEM_A } },
      message: "Bún bò",
      user: null,
    });
    expect(scope.reason).toBe("unavailable");
  });

  it("resolves a valid selected menu item to its database owner", async () => {
    state.menuItems = [menuItem(ITEM_A, A)];
    const scope = await __testables.resolveRestaurantScope({
      pageContext: { selectedMenuItem: { id: ITEM_A } },
      message: "Bún bò",
      user: null,
    });
    expect(scope).toMatchObject({
      mode: "restaurant",
      restaurantId: A,
      reason: "verifiedSelectedMenuItem",
    });
  });

  it("keeps menu discovery global and deduplicates owner candidates", async () => {
    state.menuItems = [
      menuItem(ITEM_A, A),
      menuItem("507f1f77bcf86cd7994391a2", A, { name: "Bún bò đặc biệt" }),
      menuItem(ITEM_B, B),
    ];
    const response = await handleRestaurantChatbotMessage({
      message: "Nhà hàng nào có bún bò?",
      guestId: "guest-menu-candidates",
      persist: false,
      recordSuggestions: false,
    });
    expect(response.scopeMode).toBe("global");
    expect(response.resolvedRestaurantId).toBeNull();
    expect(response.scopeCandidates).toEqual([
      expect.objectContaining({ restaurantId: A, reason: "menuMatch" }),
      expect.objectContaining({ restaurantId: B, reason: "menuMatch" }),
    ]);
    expect(response.contextSummary.restaurantCount).toBe(2);
  });

  it("discovers global and eligible restaurant coupons without metadata matches", async () => {
    state.restaurants.push(restaurant(C, { businessStatus: "inactive" }));
    state.coupons = [
      { _id: "507f1f77bcf86cd7994392a1", code: "GLOBAL10", name: "Global", restaurantId: null, isActive: true, discountType: "PERCENT", discountValue: 10 },
      { _id: "507f1f77bcf86cd7994392a2", code: "A10", name: "A", restaurantId: A, isActive: true, discountType: "AMOUNT", discountValue: 10 },
      { _id: "507f1f77bcf86cd7994392a3", code: "C10", name: "C", restaurantId: C, isActive: true, discountType: "AMOUNT", discountValue: 10 },
    ];
    state.restaurants[0].defaultCurrency = "USD";
    const response = await handleRestaurantChatbotMessage({
      message: "Có mã giảm giá nào không?",
      guestId: "guest-global-coupons",
      persist: false,
      recordSuggestions: false,
    });
    expect(response.answer).toContain("GLOBAL10");
    expect(response.answer).toContain("A10");
    expect(response.answer).toContain("$10.00");
    expect(response.answer).not.toContain("C10");
    expect(response.contextSummary.couponCount).toBe(2);
  });

  it("restaurant mode cannot receive another restaurant coupon and keeps global coupons", async () => {
    state.coupons = [
      { _id: "507f1f77bcf86cd7994392b1", code: "GLOBAL", name: "Global", restaurantId: null, isActive: true, discountType: "PERCENT", discountValue: 5 },
      { _id: "507f1f77bcf86cd7994392b2", code: "ONLYA", name: "A", restaurantId: A, isActive: true, discountType: "PERCENT", discountValue: 10 },
      { _id: "507f1f77bcf86cd7994392b3", code: "ONLYB", name: "B", restaurantId: B, isActive: true, discountType: "PERCENT", discountValue: 15 },
    ];
    const response = await handleRestaurantChatbotMessage({
      message: "Có mã giảm giá nào không?",
      restaurantId: A,
      guestId: "guest-restaurant-coupons",
      persist: false,
      recordSuggestions: false,
    });
    expect(response.answer).toContain("GLOBAL");
    expect(response.answer).toContain("ONLYA");
    expect(response.answer).not.toContain("ONLYB");
  });

  it("keeps support copy and actions consistent in global and restaurant modes", async () => {
    const globalResponse = await handleRestaurantChatbotMessage({
      message: "Tôi cần hỗ trợ",
      guestId: "guest-global-support",
      persist: false,
      recordSuggestions: false,
    });
    expect(globalResponse.answer).toContain("chọn nhà hàng");
    expect(globalResponse.handoffSuggested).toBe(false);
    expect(globalResponse.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Chọn nhà hàng" }),
    ]));
    expect(globalResponse.actions.some((action) => action.type === "handoff")).toBe(false);

    const enabledResponse = await handleRestaurantChatbotMessage({
      message: "Tôi cần hỗ trợ",
      restaurantId: A,
      guestId: "guest-enabled-support",
      persist: false,
      recordSuggestions: false,
    });
    expect(enabledResponse.handoffSuggested).toBe(true);
    expect(enabledResponse.actions.some((action) => action.type === "handoff")).toBe(true);

    state.restaurants[0].aiChatbotSettings = {
      enabled: true,
      handoffEnabled: false,
      handoffUnavailableMessage: "Hỗ trợ trực tiếp đang tắt.",
    };
    const disabledResponse = await handleRestaurantChatbotMessage({
      message: "Tôi cần hỗ trợ",
      restaurantId: A,
      guestId: "guest-disabled-support",
      persist: false,
      recordSuggestions: false,
    });
    expect(disabledResponse.answer).toBe("Hỗ trợ trực tiếp đang tắt.");
    expect(disabledResponse.handoffSuggested).toBe(false);
    expect(disabledResponse.actions.some((action) => action.type === "handoff")).toBe(false);
  });

  it("formats USD, VND and percentage coupons with consistent minimum and maximum currency", () => {
    const answer = __testables.promotionFallback({
      coupons: [
        { code: "USD10", name: "USD", discountType: "AMOUNT", discountValue: 10, currency: "USD", restaurantName: "US Diner", minOrderValue: 50, formattedMinOrder: "$50.00", maxDiscount: 20, formattedMaxDiscount: "$20.00" },
        { code: "VND100", name: "VND", discountType: "AMOUNT", discountValue: 100000, currency: "VND", restaurantName: "Quán Việt", minOrderValue: 300000, formattedMinOrder: "300.000đ", maxDiscount: 150000, formattedMaxDiscount: "150.000đ" },
        { code: "PCT20", name: "Percent", discountType: "PERCENT", discountValue: 20, currency: "VND", restaurantName: null },
      ],
    });
    expect(answer).toContain("$10.00");
    expect(answer).toContain("$50.00");
    expect(answer).toContain("$20.00");
    expect(answer).toContain("100.000đ");
    expect(answer).toContain("300.000đ");
    expect(answer).toContain("150.000đ");
    expect(answer).toContain("20%");
  });
});
''')

# Remove superseded implementation layers.
for obsolete in [
    Path("build/aiChatbotFeedbackControlsPlugin.js"),
    Path("cohan-restaurant-backend/src/services/ai/restaurantChatbotReviewed.service.js"),
]:
    if obsolete.exists():
        obsolete.unlink()

# Required review guards.
assert "window.prompt" not in widget_path.read_text()
assert "aiChatbotFeedbackControlsPlugin" not in vite_path.read_text()
assert "restaurantChatbotReviewed.service.js" not in resolver_path.read_text()
feedback_input = Path(
    "cohan-restaurant-backend/graphql/schema/aiChatbot.graphql"
).read_text().split("input SubmitAiChatbotAnswerFeedbackInput", 1)[1].split("}", 1)[0]
assert "restaurantId: ID!" not in feedback_input
