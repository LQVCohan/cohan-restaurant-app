from pathlib import Path


def replace_range(source: str, start: str, end: str, replacement: str) -> str:
    start_index = source.find(start)
    end_index = source.find(end, start_index)
    if start_index < 0 or end_index < 0:
        raise RuntimeError(f"Missing replacement markers: {start!r} -> {end!r}")
    return source[:start_index] + replacement.rstrip() + "\n\n" + source[end_index:]


def replace_once(source: str, old: str, new: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one occurrence, found {count}: {old[:100]!r}")
    return source.replace(old, new, 1)


service_path = Path("cohan-restaurant-backend/src/services/ai/restaurantChatbot.service.js")
service = service_path.read_text(encoding="utf-8")

service = replace_range(
    service,
    "const findVerifiedMenuItemOwner = async",
    "const candidateDto =",
    r'''const findVerifiedMenuItemOwner = async (selectedMenuItem = null) => {
  const itemId = selectedMenuItem?.id || selectedMenuItem?.menuItemId;
  const oid = toObjectId(itemId);
  if (!oid) return { menuItem: null, restaurant: null };
  const item = await selectLean(MenuItem.findById ? MenuItem.findById(oid) : null);
  const available = Boolean(
    item?.restaurantId &&
    item?.status === "available" &&
    item?.isAvailable !== false
  );
  if (!available) return { menuItem: item || null, restaurant: null };
  const restaurant = await fetchEligibleRestaurantById(item.restaurantId);
  return restaurant ? { menuItem: item, restaurant } : { menuItem: item, restaurant: null };
};''',
)

service = replace_range(
    service,
    "const resolveRestaurantScope = async",
    "const fetchRestaurants =",
    r'''const resolveRestaurantScope = async ({ restaurantId, message, pageContext, user }) => {
  const currentPage = normalizePageContext(pageContext, restaurantId, user);
  const selectedItemId = currentPage.selectedMenuItem?.id || currentPage.selectedMenuItem?.menuItemId;

  if (selectedItemId) {
    const verifiedSelection = await findVerifiedMenuItemOwner(currentPage.selectedMenuItem);
    if (!verifiedSelection.restaurant) {
      return { mode: "global", restaurantId: null, restaurant: null, reason: "unavailable", candidates: [], isResolved: false, currentPage };
    }

    const restaurant = verifiedSelection.restaurant;
    const verifiedRestaurantId = toIdString(restaurant);
    const suppliedRestaurantIds = [
      restaurantId,
      currentPage.restaurantId,
      currentPage.selectedMenuItem?.restaurantId,
    ]
      .filter(Boolean)
      .map(String);

    if (suppliedRestaurantIds.some((id) => id !== verifiedRestaurantId)) {
      return { mode: "global", restaurantId: null, restaurant: null, reason: "unavailable", candidates: [], isResolved: false, currentPage };
    }

    return {
      mode: "restaurant",
      restaurantId: verifiedRestaurantId,
      restaurant,
      reason: "verifiedSelectedMenuItem",
      candidates: [candidateDto(restaurant, "selectedMenuItem")],
      isResolved: true,
      currentPage: {
        ...currentPage,
        restaurantId: verifiedRestaurantId,
        selectedMenuItem: {
          ...currentPage.selectedMenuItem,
          restaurantId: verifiedRestaurantId,
        },
      },
    };
  }

  const directCandidate = restaurantId || currentPage.restaurantId;
  if (directCandidate) {
    const restaurant = await fetchEligibleRestaurantById(directCandidate);
    if (!restaurant) {
      return { mode: "global", restaurantId: null, restaurant: null, reason: "unavailable", candidates: [], isResolved: false, currentPage };
    }
    return { mode: "restaurant", restaurantId: toIdString(restaurant), restaurant, reason: restaurantId ? "inputRestaurantId" : "pageContextRestaurantId", candidates: [candidateDto(restaurant, "resolved")], isResolved: true, currentPage: { ...currentPage, restaurantId: toIdString(restaurant) } };
  }

  const restaurantMatches = await findEligibleRestaurantsByMessage(message, 6);
  if (restaurantMatches.length === 1) {
    const restaurant = restaurantMatches[0];
    return { mode: "restaurant", restaurantId: toIdString(restaurant), restaurant, reason: "uniqueRestaurantName", candidates: [candidateDto(restaurant, "uniqueName")], isResolved: true, currentPage: { ...currentPage, restaurantId: toIdString(restaurant) } };
  }
  return { mode: "global", restaurantId: null, restaurant: null, reason: restaurantMatches.length > 1 ? "ambiguousRestaurantName" : "global", candidates: restaurantMatches.map((r) => candidateDto(r, "nameMatch")), isResolved: false, currentPage: { ...currentPage, restaurantId: null } };
};''',
)

service = replace_range(
    service,
    "const fetchCoupons = async",
    "// Phase 26 deliberately",
    r'''const fetchCoupons = async ({ scope }) => {
  const now = new Date();
  const filter = {
    isActive: true,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $exists: false } }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $exists: false } }, { endAt: { $gte: now } }] },
    ],
  };

  if (scope?.mode === "restaurant" && scope.restaurantId) {
    filter.$or = [{ restaurantId: toObjectId(scope.restaurantId) }, { restaurantId: null }];
    const query = Coupon.find(filter);
    const rows = typeof query.sort === "function"
      ? await query.sort({ discountValue: -1, endAt: 1, updatedAt: -1 }).limit(6).lean()
      : await runQuery(query);
    return (Array.isArray(rows) ? rows : []).map((coupon) => ({
      ...coupon,
      restaurant: coupon.restaurantId ? scope.restaurant : null,
    }));
  }

  const query = Coupon.find(filter);
  const rows = typeof query.sort === "function"
    ? await query.sort({ discountValue: -1, endAt: 1, updatedAt: -1 }).limit(24).lean()
    : await runQuery(query);
  const coupons = Array.isArray(rows) ? rows : [];
  const ownerIds = coupons.map((coupon) => coupon.restaurantId).filter(Boolean).map(String);
  const owners = await fetchEligibleRestaurantsByIds(ownerIds);
  const ownerMap = new Map(owners.map((restaurant) => [toIdString(restaurant), restaurant]));

  return coupons
    .filter((coupon) => !coupon.restaurantId || ownerMap.has(String(coupon.restaurantId)))
    .map((coupon) => ({
      ...coupon,
      restaurant: coupon.restaurantId ? ownerMap.get(String(coupon.restaurantId)) : null,
    }))
    .slice(0, 6);
};''',
)

service = replace_range(
    service,
    "const buildContext = async",
    "const safeJsonParse =",
    r'''const buildContext = async ({ message, user, pageContext = {}, scope }) => {
  const intent = classifyIntent(message);
  const menuPreferences = extractMenuPreferences(message);
  const isMenuAssistant = isMenuAssistantRequest(message, intent, menuPreferences);
  const currentPage = scope?.currentPage || normalizePageContext(pageContext, scope?.restaurantId, user);
  const [metadataRestaurants, menuItems, coupons, orders, reservations, cart] = await Promise.all([
    fetchRestaurants({ scope, message }),
    fetchMenuItems({ scope, message, limit: isMenuAssistant ? 30 : 8 }),
    fetchCoupons({ scope }),
    fetchOrders({ restaurantId: scope?.restaurantId, message, user }),
    fetchReservations({ restaurantId: scope?.restaurantId, message, user }),
    fetchCart({ user }),
  ]);

  const restaurantMap = new Map();
  for (const restaurant of metadataRestaurants || []) {
    if (restaurant) restaurantMap.set(toIdString(restaurant), restaurant);
  }
  for (const item of menuItems || []) {
    if (item?.restaurant) restaurantMap.set(toIdString(item.restaurant), item.restaurant);
  }
  for (const coupon of coupons || []) {
    if (coupon?.restaurant) restaurantMap.set(toIdString(coupon.restaurant), coupon.restaurant);
  }
  const restaurants = [...restaurantMap.values()];
  const restaurantLookup = new Map(restaurants.map((restaurant) => [toIdString(restaurant), restaurant]));

  const candidateMap = new Map();
  for (const candidate of scope?.candidates || []) {
    if (candidate?.restaurantId) candidateMap.set(String(candidate.restaurantId), candidate);
  }
  if (scope?.mode !== "restaurant") {
    for (const item of menuItems || []) {
      if (item?.restaurant) {
        const candidate = candidateDto(item.restaurant, "menuMatch");
        candidateMap.set(candidate.restaurantId, candidate);
      }
    }
    for (const coupon of coupons || []) {
      if (coupon?.restaurant) {
        const candidate = candidateDto(coupon.restaurant, "couponMatch");
        if (!candidateMap.has(candidate.restaurantId)) candidateMap.set(candidate.restaurantId, candidate);
      }
    }
  }

  const serializedMenuItems = menuItems.map((item) => serializeMenuItem(item, scope?.restaurant?.defaultCurrency || "VND", item.restaurant || scope?.restaurant));
  const recommendedMenuItems = rankMenuRecommendations(serializedMenuItems, menuPreferences, 10);
  const userSafeProfile = buildUserSafeProfile(user);
  const matchedFeatureMapEntries = sanitizeFeatureMatches(pageContext?.featureMatches || [], currentPage.userRole || userSafeProfile.role);
  const scopeMode = scope?.mode === "restaurant" ? "restaurant" : "global";
  return {
    intent,
    scopeMode,
    resolvedRestaurantId: scope?.mode === "restaurant" ? scope.restaurantId : null,
    scopeCandidates: [...candidateMap.values()].slice(0, 6),
    scopeReason: scope?.reason || "global",
    user: userSafeProfile,
    userSafeProfile,
    currentPage,
    matchedFeatureMapEntries,
    cartSummary: cart ? serializeCart(cart, scope?.restaurant?.defaultCurrency || "VND") : null,
    restaurants: restaurants.map(serializeRestaurant),
    menuItems: (isMenuAssistant ? recommendedMenuItems : serializedMenuItems).slice(0, 10),
    recommendedMenuItems: recommendedMenuItems.slice(0, 10),
    menuPreferences,
    coupons: coupons.map((coupon) => serializeCoupon(coupon, scope?.restaurant?.defaultCurrency || "VND", restaurantLookup)).slice(0, 6),
    orders: orders.map((order) => serializeOrder(order, scope?.restaurant?.defaultCurrency || "VND")),
    reservations: reservations.map((reservation) => serializeReservation(reservation, scope?.restaurant?.defaultCurrency || "VND")),
  };
};''',
)

service = replace_once(
    service,
    '  for (const action of [...deterministic, ...provider]) {\n    const normalized = normalizeAiAction(action, allowedItemIds);',
    '  for (const action of [...deterministic, ...provider]) {\n    if (action?.type === "handoff" && (context.scopeMode !== "restaurant" || context.handoffEnabled === false)) continue;\n    const normalized = normalizeAiAction(action, allowedItemIds);',
)

service = replace_once(
    service,
    '  if (context.intent === "support" && context.scopeMode === "restaurant") pushAction(actions, { type: "handoff", label: "Gặp nhân viên", href: "/contact", description: "Gửi yêu cầu để nhân viên hỗ trợ trong luồng handoff hiện có.", icon: "support", priority: 1 });\n  if (context.intent === "support" && context.scopeMode !== "restaurant") pushAction(actions, { type: "link", label: "Chọn nhà hàng", href: "/restaurants", description: "Chọn nhà hàng trước khi gặp nhân viên.", icon: "restaurant", priority: 1 });',
    '  if (context.intent === "support" && context.scopeMode === "restaurant" && context.handoffEnabled !== false) pushAction(actions, { type: "handoff", label: "Gặp nhân viên", href: "/contact", description: "Gửi yêu cầu để nhân viên hỗ trợ trong luồng handoff hiện có.", icon: "support", priority: 1 });\n  if (context.intent === "support" && context.scopeMode !== "restaurant") pushAction(actions, { type: "link", label: "Chọn nhà hàng", href: "/restaurants", description: "Chọn nhà hàng trước khi gặp nhân viên.", icon: "restaurant", priority: 1 });',
)

service = replace_once(
    service,
    '    support: () => "Mình có thể hỗ trợ nhanh về menu, đặt bàn, đơn hàng, coupon. Nếu cần người thật xử lý, bạn có thể bấm Gặp nhân viên để người thật hỗ trợ trực tiếp.",',
    '    support: (currentContext) => currentContext.scopeMode !== "restaurant"\n      ? "Bạn hãy chọn nhà hàng trước để mình kết nối đúng nhân viên hỗ trợ."\n      : currentContext.handoffEnabled === false\n        ? (currentContext.handoffUnavailableMessage || "Nhà hàng này hiện chưa bật hỗ trợ trực tiếp qua chatbot.")\n        : "Mình có thể hỗ trợ nhanh về menu, đặt bàn, đơn hàng và coupon. Bạn có thể bấm Gặp nhân viên để được hỗ trợ trực tiếp.",',
)

service = replace_once(
    service,
    '    const value = coupon.discountType === "AMOUNT" ? formatCurrency(coupon.discountValue) : `${coupon.discountValue}%`;',
    '    const value = coupon.discountType === "AMOUNT" ? formatCurrency(coupon.discountValue, coupon.currency || "VND") : `${coupon.discountValue}%`;',
)

service = replace_once(
    service,
    '  const context = await buildContext({ message: cleanMessage, user, pageContext, scope });\n  const refusal = shouldRefuseRequest({ message: cleanMessage, context });',
    '  const context = await buildContext({ message: cleanMessage, user, pageContext, scope });\n  context.handoffEnabled = Boolean(aiSettings.handoffEnabled);\n  context.handoffUnavailableMessage = aiSettings.handoffUnavailableMessage;\n  const refusal = shouldRefuseRequest({ message: cleanMessage, context });',
)

service = replace_once(
    service,
    '  finalResponse.handoffSuggested = scope.mode === "restaurant" && handoffDecision.suggested;',
    '  finalResponse.handoffSuggested = scope.mode === "restaurant" && aiSettings.handoffEnabled && handoffDecision.suggested;',
)

service_path.write_text(service, encoding="utf-8")

widget_path = Path("src/components/common/AiChatbotWidget.jsx")
widget = widget_path.read_text(encoding="utf-8")
widget = replace_once(
    widget,
    'import "./AiChatbotWidget.scss";',
    'import "./AiChatbotWidget.scss";\nimport AiChatbotFeedbackControls from "./AiChatbotFeedbackControls";\nimport "@/styles/AiChatbotFeedbackControls.css";',
)
widget = replace_once(widget, '  const [feedbackSent, setFeedbackSent] = useState({});\n', '')

feedback_start = '                  {item.role === "assistant" && item.meta?.conversationId ? ('
feedback_end = '                  ) : null}\n                </div>\n              ))}'
start_index = widget.find(feedback_start)
end_index = widget.find(feedback_end, start_index)
if start_index < 0 or end_index < 0:
    raise RuntimeError("Could not find legacy feedback block")
replacement = r'''                  {item.role === "assistant" && item.meta?.conversationId ? (
                    <AiChatbotFeedbackControls
                      item={item}
                      index={index}
                      messages={messages}
                      restaurantId={item.meta?.resolvedRestaurantId || restaurantId}
                      guestId={guestId}
                      submitFeedback={submitFeedback}
                    />
                  ) : null}'''
widget = widget[:start_index] + replacement + widget[end_index + len('                  ) : null}') :]
widget_path.write_text(widget, encoding="utf-8")

Path("scripts/apply_chatbot_review_fixes.py").unlink(missing_ok=True)
Path(".github/workflows/apply-chatbot-review-fixes.yml").unlink(missing_ok=True)
