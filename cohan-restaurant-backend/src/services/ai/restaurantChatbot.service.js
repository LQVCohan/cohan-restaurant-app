import mongoose from "mongoose";
import process from "process";
import { AI_CHATBOT_RATE_LIMIT_POLICIES, consumeAiChatbotRateLimit, AI_CHATBOT_RATE_LIMIT_CODE, AI_CHATBOT_RATE_LIMIT_MESSAGE } from "./restaurantChatbotRateLimit.service.js";
import {
  Coupon,
  MenuItem,
  Order,
  Reservation,
  Restaurant,
  AiChatConversation,
  AiChatMessage,
} from "../../../models/index.js";
import { mergeWithDefaultAiChatbotSettings } from "./restaurantChatbotSettings.service.js";
import { findRelevantKnowledgeForChatbot } from "./restaurantChatbotKnowledge.service.js";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.AI_CHATBOT_MODEL || process.env.AI_MODEL || "gpt-5";
const MAX_HISTORY_MESSAGES = 8;
const MAX_KNOWLEDGE_CHARS = 1800;

const INTENTS = {
  menu: ["món", "menu", "ăn", "đồ ăn", "giá", "recommend", "gợi ý", "ngon", "bán chạy"],
  reservation: ["đặt bàn", "booking", "bàn", "giữ chỗ", "đặt chỗ", "reservation"],
  order: ["đơn", "order", "mã đơn", "trạng thái", "giao", "ship", "thanh toán"],
  promotion: ["coupon", "voucher", "mã giảm", "khuyến mãi", "ưu đãi", "giảm giá"],
  manager: ["doanh thu", "tồn kho", "nhân viên", "hiệu suất", "ca làm", "quản lý", "kpi"],
  support: ["hỗ trợ", "liên hệ", "khiếu nại", "phàn nàn", "gặp nhân viên", "support"],
};
const HANDOFF_KEYWORDS = [
  "gặp nhân viên",
  "người thật",
  "support",
  "liên hệ nhân viên",
  "khiếu nại",
  "phàn nàn",
  "talk to human",
];

const STOP_WORDS = new Set([
  "toi",
  "tôi",
  "minh",
  "mình",
  "ban",
  "bạn",
  "cho",
  "hoi",
  "hỏi",
  "giup",
  "giúp",
  "nha",
  "nhé",
  "duoc",
  "được",
  "khong",
  "không",
  "co",
  "có",
  "la",
  "là",
  "cua",
  "của",
  "trong",
  "ve",
  "về",
]);

const ROLE_MANAGER_LIKE = new Set(["admin", "manager", "hr", "accountant"]);

const toObjectId = (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const asLower = (value) => String(value || "").toLowerCase();

const roleSlug = (user) =>
  asLower(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType);

const isManagerLike = (user) => ROLE_MANAGER_LIKE.has(roleSlug(user));

const normalizeMessage = (message) => String(message || "").trim().slice(0, 1200);
const normalizeGuestId = (guestId) => {
  const value = String(guestId || "").trim().slice(0, 128);
  return value ? value.replace(/[^a-zA-Z0-9_-]/g, "") : "";
};

const normalizeConversationId = (conversationId) => {
  if (!conversationId || !mongoose.isValidObjectId(conversationId)) return null;
  return String(conversationId);
};


const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tokenize = (message) =>
  asLower(message)
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    .slice(0, 8);

const buildSearchRegex = (message) => {
  const tokens = tokenize(message);
  if (!tokens.length) return null;
  return new RegExp(tokens.map(escapeRegex).join("|"), "i");
};

const formatCurrency = (value, currency = "VND") => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0đ";
  if (currency === "USD") return `$${amount.toFixed(2)}`;
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
};

const serializeRestaurant = (restaurant) => {
  if (!restaurant) return null;
  const address = restaurant.address || {};
  return {
    id: String(restaurant._id || restaurant.id),
    name: restaurant.name,
    cuisineType: restaurant.cuisineType,
    address: [address.line1, address.ward, address.district, address.city]
      .filter(Boolean)
      .join(", "),
    phone: restaurant.phone,
    email: restaurant.email,
    openingHours: restaurant.openingHours,
    closingHours: restaurant.closingHours,
    operationalStatus: restaurant.operationalStatus,
    priceRange: restaurant.priceRange,
    avgRating: restaurant.avgRating,
    capabilities: restaurant.capabilities || {},
  };
};

const serializeMenuItem = (item, currency = "VND") => ({
  id: String(item._id || item.id),
  name: item.name,
  description: item.description,
  labels: item.labels || [],
  basePrice: item.basePrice,
  formattedPrice: formatCurrency(item.basePrice, currency),
  status: item.status,
  rate: item.rate,
  orderCounter: item.orderCounter,
  avgPrepTimeMin: item.avgPrepTimeMin,
});

const serializeCoupon = (coupon, currency = "VND") => ({
  id: String(coupon._id || coupon.id),
  code: coupon.code,
  name: coupon.name,
  description: coupon.description,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  minOrderValue: coupon.minOrderValue,
  maxDiscount: coupon.maxDiscount,
  formattedMinOrder: formatCurrency(coupon.minOrderValue, currency),
  formattedMaxDiscount: coupon.maxDiscount ? formatCurrency(coupon.maxDiscount, currency) : null,
  endAt: coupon.endAt,
});

const serializeOrder = (order, currency = "VND") => ({
  id: String(order._id || order.id),
  orderCode: order.orderCode,
  trackingCode: order.trackingCode,
  publicStatus: order.publicStatus,
  currentStatus: order.currentStatus,
  kitchenStatus: order.kitchenStatus,
  paymentStatus: order.orderPaymentStatus || order.payment?.status,
  orderType: order.orderType,
  tableCode: order.tableCode,
  estimatedReadyAt: order.estimatedReadyAt,
  estimatedDeliveryAt: order.estimatedDeliveryAt,
  customerVisibleNote: order.customerVisibleNote,
  total: order.totals?.grandTotal,
  formattedTotal: formatCurrency(order.totals?.grandTotal, currency),
  items: (order.items || []).slice(0, 5).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    status: item.status,
  })),
});

const serializeReservation = (reservation, currency = "VND") => ({
  id: String(reservation._id || reservation.id),
  orderCode: reservation.orderCode,
  restaurantName: reservation.restaurantName,
  timeTo: reservation.timeTo,
  durationMinutes: reservation.durationMinutes,
  partySize: reservation.partySize,
  status: reservation.status,
  depositStatus: reservation.depositStatus,
  depositAmount: reservation.depositAmount,
  formattedDeposit: formatCurrency(reservation.depositAmount, currency),
  changeRequestStatus: reservation.changeRequestStatus,
});

const classifyIntent = (message) => {
  const raw = asLower(message);
  let best = { intent: "general", score: 0 };
  Object.entries(INTENTS).forEach(([intent, keywords]) => {
    const score = keywords.reduce((sum, keyword) => sum + (raw.includes(keyword) ? 1 : 0), 0);
    if (score > best.score) best = { intent, score };
  });
  return best.intent;
};
const shouldSuggestHandoff = ({ message, intent, confidence, isFallback, threshold = 0.6 }) => {
  const raw = asLower(message);
  if (intent === "support") return { suggested: true, reason: "support_intent" };
  if (HANDOFF_KEYWORDS.some((k) => raw.includes(k))) return { suggested: true, reason: "user_request_human" };
  if (isFallback) return { suggested: true, reason: "fallback_response" };
  if (Number.isFinite(Number(confidence)) && Number(confidence) < Number(threshold)) return { suggested: true, reason: "low_confidence" };
  return { suggested: false, reason: null };
};

const extractLookupCode = (message) => {
  const match = String(message || "")
    .toUpperCase()
    .match(/\b(?:ORD|RSV|OD|HD|DH)?[-_ ]?[A-Z0-9]{4,14}\b/);
  return match ? match[0].replace(/[\s_-]/g, "") : null;
};

const recentHistoryForPrompt = (history = []) =>
  (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").slice(0, 500),
    }))
    .filter((item) => item.content);

const buildConversationScopeFilter = ({ userId, guestId, restaurantObjectId }) => {
  const filter = { status: "open" };
  if (restaurantObjectId) filter.restaurantId = restaurantObjectId;
  else filter.restaurantId = null;

  if (userId) filter.userId = userId;
  else if (guestId) filter.guestId = guestId;
  else return null;

  return filter;
};

const isConversationOwned = (conversation, { userId, guestId }) => {
  if (!conversation) return false;
  if (userId) return String(conversation.userId || "") === String(userId);
  if (guestId) return String(conversation.guestId || "") === String(guestId);
  return false;
};

const fetchPersistedHistoryForPrompt = async (conversationId) => {
  if (!conversationId) return [];
  const records = await AiChatMessage.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(MAX_HISTORY_MESSAGES)
    .lean();

  return records
    .reverse()
    .map((item) => ({ role: item?.role === "assistant" ? "assistant" : "user", content: String(item?.content || "") }))
    .filter((item) => item.content);
};


const fetchRestaurants = async ({ restaurantId, message }) => {
  const rid = toObjectId(restaurantId);
  if (rid) {
    const restaurant = await Restaurant.findById(rid).lean();
    return restaurant ? [restaurant] : [];
  }

  const regex = buildSearchRegex(message);
  const filter = {
    businessStatus: "active",
    publicationStatus: "published",
  };
  if (regex) {
    filter.$or = [
      { name: regex },
      { cuisineType: regex },
      { description: regex },
      { "address.line1": regex },
      { "address.district": regex },
      { "address.city": regex },
    ];
  }

  return Restaurant.find(filter)
    .sort({ avgRating: -1, reviewCount: -1, updatedAt: -1 })
    .limit(4)
    .lean();
};

const fetchMenuItems = async ({ restaurantId, message }) => {
  const rid = toObjectId(restaurantId);
  const regex = buildSearchRegex(message);
  const filter = { status: "available" };
  if (rid) filter.restaurantId = rid;
  if (regex) {
    filter.$or = [
      { name: regex },
      { description: regex },
      { labels: regex },
      { code: regex },
    ];
  }

  let items = await MenuItem.find(filter)
    .sort({ orderCounter: -1, rate: -1, sortOrder: 1 })
    .limit(8)
    .lean();

  if (!items.length && rid) {
    items = await MenuItem.find({ restaurantId: rid, status: "available" })
      .sort({ orderCounter: -1, rate: -1, sortOrder: 1 })
      .limit(8)
      .lean();
  }

  return items;
};

const fetchCoupons = async ({ restaurantId }) => {
  const rid = toObjectId(restaurantId);
  const now = new Date();
  const filter = {
    isActive: true,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $exists: false } }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $exists: false } }, { endAt: { $gte: now } }] },
    ],
  };
  if (rid) filter.$or = [{ restaurantId: rid }, { restaurantId: null }];

  return Coupon.find(filter)
    .sort({ discountValue: -1, endAt: 1, updatedAt: -1 })
    .limit(6)
    .lean();
};

const fetchOrders = async ({ restaurantId, message, user }) => {
  const code = extractLookupCode(message);
  const rid = toObjectId(restaurantId);
  const uid = toObjectId(user?.id || user?._id);
  const filter = {};
  if (rid) filter.restaurantId = rid;
  if (code) {
    filter.$or = [{ orderCode: code }, { trackingCode: code }, { trackingToken: code }];
  } else if (uid && !isManagerLike(user)) {
    filter.userId = uid;
  } else if (!isManagerLike(user)) {
    return [];
  }

  return Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(code ? 3 : 5)
    .lean();
};

const fetchReservations = async ({ restaurantId, message, user }) => {
  const code = extractLookupCode(message);
  const rid = toObjectId(restaurantId);
  const uid = toObjectId(user?.id || user?._id);
  const filter = {};
  if (rid) filter.restaurantId = rid;
  if (code) filter.orderCode = code;
  else if (uid) filter.userId = uid;
  else return [];

  return Reservation.find(filter)
    .sort({ timeTo: -1, createdAt: -1 })
    .limit(code ? 3 : 5)
    .lean();
};

const buildKnowledgePrompt = (knowledgeItems = []) => {
  const lines = [];
  let used = 0;
  for (const item of knowledgeItems || []) {
    const row = `- [${item.sourceType || "manual"}] ${item.title || ""} | category: ${item.category || "N/A"} | tags: ${Array.isArray(item.tags) ? item.tags.join(", ") : ""}\n${String(item.content || "").slice(0, 500)}`.trim();
    if (!row) continue;
    if (used + row.length > MAX_KNOWLEDGE_CHARS) break;
    lines.push(row);
    used += row.length;
  }
  return lines;
};

const buildContext = async ({ message, restaurantId, user }) => {
  const intent = classifyIntent(message);
  const restaurants = await fetchRestaurants({ restaurantId, message });
  const primaryRestaurant = restaurants[0] || null;
  const currency = primaryRestaurant?.defaultCurrency || "VND";

  const [menuItems, coupons, orders, reservations] = await Promise.all([
    fetchMenuItems({ restaurantId: restaurantId || primaryRestaurant?._id, message }),
    fetchCoupons({ restaurantId: restaurantId || primaryRestaurant?._id }),
    fetchOrders({ restaurantId: restaurantId || primaryRestaurant?._id, message, user }),
    fetchReservations({ restaurantId: restaurantId || primaryRestaurant?._id, message, user }),
  ]);

  return {
    intent,
    user: user
      ? {
          id: String(user.id || user._id || ""),
          name: user.fullName || user.email || "Người dùng",
          role: roleSlug(user) || "guest",
        }
      : { role: "guest" },
    restaurants: restaurants.map(serializeRestaurant),
    menuItems: menuItems.map((item) => serializeMenuItem(item, currency)),
    coupons: coupons.map((coupon) => serializeCoupon(coupon, currency)),
    orders: orders.map((order) => serializeOrder(order, currency)),
    reservations: reservations.map((reservation) => serializeReservation(reservation, currency)),
  };
};

const safeJsonParse = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

const normalizeAiResult = (parsed, context) => ({
  answer: String(parsed?.answer || "").trim() || fallbackAnswer(context).answer,
  intent: parsed?.intent || context.intent || "general",
  confidence: Math.max(0, Math.min(1, Number(parsed?.confidence ?? 0.7))),
  quickReplies: Array.isArray(parsed?.quickReplies)
    ? parsed.quickReplies.map(String).slice(0, 4)
    : fallbackQuickReplies(context.intent),
  actions: Array.isArray(parsed?.actions) ? parsed.actions.slice(0, 4) : fallbackActions(context),
  sources: Array.isArray(parsed?.sources) ? parsed.sources.slice(0, 8) : fallbackSources(context),
  isFallback: false,
});

const callOpenAI = async ({ message, context, history, knowledgeItems = [] }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const knowledgeLines = buildKnowledgePrompt(knowledgeItems);
  const prompt = [
    "Bạn là ChatBot A.I chuyên nghiệp cho Cohan Restaurant App.",
    "Trả lời tiếng Việt, thân thiện, ngắn gọn, đúng nghiệp vụ nhà hàng.",
    "Chỉ dùng dữ liệu trong CONTEXT để nói về món ăn, đơn hàng, đặt bàn, coupon hoặc thông tin nhà hàng. Nếu thiếu dữ liệu, hãy nói rõ và gợi ý bước tiếp theo.",
    "Không tự bịa giá, trạng thái đơn, số điện thoại, chính sách hoặc thông tin cá nhân.",
    "Nếu có RESTAURANT_KNOWLEDGE thì ưu tiên thông tin đó hơn suy đoán chung.",
    "Trả về JSON hợp lệ theo schema: {\"answer\": string, \"intent\": string, \"confidence\": number, \"quickReplies\": string[], \"actions\": [{\"type\":\"link|handoff|search\",\"label\": string, \"href\": string}], \"sources\": [{\"type\": string, \"id\": string, \"label\": string}] }.",
    `CONTEXT: ${JSON.stringify(context)}`,
    knowledgeLines.length ? `RESTAURANT_KNOWLEDGE:\n${knowledgeLines.join("\n\n")}` : "",
  ].join("\n");

  try {
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: prompt },
          ...recentHistoryForPrompt(history),
          { role: "user", content: message },
        ],
        temperature: 0.25,
        max_tokens: 500,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    const parsed = safeJsonParse(content);
    return parsed ? normalizeAiResult(parsed, context) : null;
  } catch {
    return null;
  }
};

const fallbackQuickReplies = (intent) => {
  const byIntent = {
    menu: ["Gợi ý món bán chạy", "Có món nào đang giảm giá?", "Tôi muốn đặt món"],
    reservation: ["Tôi muốn đặt bàn", "Chính sách đặt cọc", "Xem sơ đồ bàn"],
    order: ["Kiểm tra đơn hàng", "Tôi muốn thanh toán", "Gọi nhân viên"],
    promotion: ["Mã giảm giá hiện có", "Điều kiện áp dụng", "Gợi ý combo"],
    manager: ["Tóm tắt vận hành", "Cảnh báo tồn kho", "Hiệu suất nhân viên"],
    support: ["Gặp nhân viên hỗ trợ", "Tôi có khiếu nại", "Hướng dẫn sử dụng"],
  };
  return byIntent[intent] || ["Gợi ý món ngon", "Cách đặt bàn", "Kiểm tra đơn hàng"];
};

const fallbackActions = (context) => {
  const restaurantId = context.restaurants?.[0]?.id;
  const actions = [];
  if (context.intent === "reservation" && restaurantId) {
    actions.push({ type: "link", label: "Mở trang đặt bàn", href: `/restaurant/${restaurantId}/layout` });
  }
  if (context.intent === "menu" && restaurantId) {
    actions.push({ type: "link", label: "Xem nhà hàng", href: `/restaurant/${restaurantId}` });
  }
  if (context.intent === "promotion" && restaurantId) {
    actions.push({ type: "link", label: "Xem coupon", href: `/coupons/${restaurantId}` });
  }
  if (context.intent === "order") {
    actions.push({ type: "link", label: "Đơn hàng của tôi", href: "/orders" });
  }
  if (!actions.length) actions.push({ type: "link", label: "Trung tâm hỗ trợ", href: "/contact" });
  return actions;
};

const fallbackSources = (context) => [
  ...(context.restaurants || []).slice(0, 2).map((item) => ({ type: "restaurant", id: item.id, label: item.name })),
  ...(context.menuItems || []).slice(0, 3).map((item) => ({ type: "menuItem", id: item.id, label: item.name })),
  ...(context.coupons || []).slice(0, 2).map((item) => ({ type: "coupon", id: item.id, label: item.code })),
];

const menuFallback = (context) => {
  const items = context.menuItems || [];
  if (!items.length) {
    return "Hiện mình chưa tìm thấy món phù hợp trong dữ liệu menu. Bạn có thể thử hỏi theo tên món, loại món hoặc mở trang nhà hàng để xem đầy đủ menu.";
  }
  const lines = items.slice(0, 4).map((item, index) => {
    const rating = Number(item.rate || 0) > 0 ? `, đánh giá ${item.rate}/5` : "";
    return `${index + 1}. ${item.name} - ${item.formattedPrice}${rating}`;
  });
  return `Mình gợi ý một vài món phù hợp:\n${lines.join("\n")}\nBạn muốn mình gợi ý theo khẩu vị, ngân sách hay món bán chạy không?`;
};

const reservationFallback = (context) => {
  const restaurant = context.restaurants?.[0];
  if (!restaurant) return "Bạn có thể chọn nhà hàng rồi vào mục đặt bàn để xem sơ đồ bàn, thời gian trống và chính sách đặt cọc.";
  const hours = [restaurant.openingHours, restaurant.closingHours].filter(Boolean).join(" - ");
  return `${restaurant.name} ${hours ? `thường hoạt động ${hours}. ` : ""}Bạn có thể đặt bàn bằng nút mở trang đặt bàn; hệ thống sẽ kiểm tra bàn trống, số khách và đặt cọc nếu có.`;
};

const orderFallback = (context) => {
  const order = context.orders?.[0];
  if (!order) return "Mình chưa tìm thấy đơn hàng phù hợp. Bạn hãy gửi mã đơn/mã theo dõi hoặc đăng nhập tài khoản đã đặt đơn để mình kiểm tra chính xác hơn.";
  const eta = order.estimatedDeliveryAt || order.estimatedReadyAt;
  return `Đơn ${order.orderCode} hiện ở trạng thái ${order.publicStatus || order.currentStatus || "đang xử lý"}. Thanh toán: ${order.paymentStatus || "chưa rõ"}. Tổng tiền: ${order.formattedTotal}.${eta ? ` Dự kiến: ${new Date(eta).toLocaleString("vi-VN")}.` : ""}`;
};

const promotionFallback = (context) => {
  const coupons = context.coupons || [];
  if (!coupons.length) return "Hiện mình chưa thấy coupon đang hoạt động phù hợp. Bạn có thể kiểm tra lại trong trang coupon của nhà hàng hoặc hỏi mình gợi ý combo/menu tiết kiệm.";
  const lines = coupons.slice(0, 4).map((coupon) => {
    const value = coupon.discountType === "AMOUNT" ? formatCurrency(coupon.discountValue) : `${coupon.discountValue}%`;
    return `- ${coupon.code}: ${coupon.name} giảm ${value}${coupon.minOrderValue ? `, đơn tối thiểu ${coupon.formattedMinOrder}` : ""}`;
  });
  return `Các ưu đãi có thể dùng:\n${lines.join("\n")}`;
};

const managerFallback = (context) => {
  if (!context.user || !ROLE_MANAGER_LIKE.has(context.user.role)) {
    return "Một số báo cáo quản lý chỉ hiển thị cho tài khoản quản lý/admin. Với vai trò hiện tại, mình có thể hỗ trợ đặt bàn, menu, đơn hàng và coupon.";
  }
  return "Mình có thể hỗ trợ quản lý đọc nhanh tình trạng menu, coupon, đơn hàng gần đây và gợi ý thao tác. Các phân tích sâu như doanh thu, tồn kho, hiệu suất nhân viên có thể mở rộng thêm bằng cách nối chatbot với các resolver dashboard hiện có.";
};

const fallbackAnswer = (context) => {
  const intent = context.intent || "general";
  const answerByIntent = {
    menu: menuFallback,
    reservation: reservationFallback,
    order: orderFallback,
    promotion: promotionFallback,
    manager: managerFallback,
    support: () => "Mình có thể hỗ trợ nhanh về menu, đặt bàn, đơn hàng, coupon. Nếu cần người thật xử lý, bạn có thể mở trung tâm hỗ trợ hoặc gửi yêu cầu cho nhân viên nhà hàng.",
    general: () => "Chào bạn, mình là trợ lý A.I của Cohan Restaurant App. Bạn có thể hỏi mình về món ăn, đặt bàn, đơn hàng, coupon hoặc cách sử dụng hệ thống.",
  };
  return {
    answer: (answerByIntent[intent] || answerByIntent.general)(context),
    intent,
    confidence: intent === "general" ? 0.55 : 0.72,
    quickReplies: fallbackQuickReplies(intent),
    actions: fallbackActions(context),
    sources: fallbackSources(context),
    isFallback: true,
  };
};

export const handleRestaurantChatbotMessage = async ({
  message,
  restaurantId,
  user,
  history = [],
  guestId,
  conversationId,
  clientIp,
} = {}) => {
  const cleanMessage = normalizeMessage(message);
  if (!cleanMessage) {
    const err = new Error("Tin nhắn không được để trống");
    err.statusCode = 400;
    throw err;
  }

  const userObjectId = toObjectId(user?.id || user?._id);
  const restaurantObjectId = toObjectId(restaurantId);
  const normalizedGuestId = normalizeGuestId(guestId);
  const normalizedConversationId = normalizeConversationId(conversationId);
  let aiSettings = mergeWithDefaultAiChatbotSettings({});
  if (restaurantObjectId) {
    const settingsRestaurant = await Restaurant.findById(restaurantObjectId).select("aiChatbotSettings").lean();
    aiSettings = mergeWithDefaultAiChatbotSettings(settingsRestaurant?.aiChatbotSettings || {});
    if (aiSettings.enabled === false) {
      return {
        answer: aiSettings.handoffUnavailableMessage || "Chatbot hiện chưa khả dụng cho nhà hàng này.",
        intent: "general",
        confidence: 1,
        quickReplies: aiSettings.starterQuickReplies || [],
        actions: [],
        sources: [],
        contextSummary: { restaurantCount: 0, menuItemCount: 0, couponCount: 0, orderCount: 0, reservationCount: 0 },
        conversationId: null,
        isFallback: true,
        handoffSuggested: false,
        handoffReason: null,
        handoffMessage: null,
      };
    }
  }

  const askRateResult = consumeAiChatbotRateLimit({
    policy: AI_CHATBOT_RATE_LIMIT_POLICIES.askAiChatbot,
    keyParts: {
      guestId: normalizedGuestId,
      conversationId: normalizedConversationId || "",
      restaurantId: String(restaurantId || ""),
      clientIp,
    },
  });
  if (!askRateResult.allowed) {
    const err = new Error(AI_CHATBOT_RATE_LIMIT_MESSAGE);
    err.code = AI_CHATBOT_RATE_LIMIT_CODE;
    throw err;
  }

  let persistedConversation = null;
  let persistedHistory = [];

  try {
    if (normalizedConversationId) {
      const found = await AiChatConversation.findById(normalizedConversationId);
      if (found && isConversationOwned(found, { userId: userObjectId, guestId: normalizedGuestId })) {
        const sameRestaurant =
          String(found.restaurantId || "") === String(restaurantObjectId || "") ||
          (!found.restaurantId && !restaurantObjectId);
        if (sameRestaurant) persistedConversation = found;
      }
    }

    if (!persistedConversation) {
      const scopeFilter = buildConversationScopeFilter({
        userId: userObjectId,
        guestId: normalizedGuestId,
        restaurantObjectId,
      });
      if (scopeFilter) persistedConversation = await AiChatConversation.findOne(scopeFilter).sort({ updatedAt: -1 });
    }

    if (!persistedConversation && (userObjectId || normalizedGuestId)) {
      persistedConversation = await AiChatConversation.create({
        restaurantId: restaurantObjectId,
        userId: userObjectId,
        guestId: normalizedGuestId || null,
      });
    }

    if (persistedConversation) {
      persistedHistory = await fetchPersistedHistoryForPrompt(persistedConversation._id);

      await AiChatMessage.create({
        conversationId: persistedConversation._id,
        restaurantId: restaurantObjectId,
        userId: userObjectId,
        guestId: normalizedGuestId || null,
        role: "user",
        content: cleanMessage,
      });
    }
  } catch {
    persistedConversation = null;
    persistedHistory = [];
  }

  const context = await buildContext({ message: cleanMessage, restaurantId, user });
  const knowledgeItems = await findRelevantKnowledgeForChatbot({ restaurantId, message: cleanMessage, limit: 4 });
  const aiResult = await callOpenAI({
    message: cleanMessage,
    context,
    history: persistedHistory.length ? persistedHistory : history,
    knowledgeItems,
  });
  const responseData = aiResult || fallbackAnswer(context);
  if (responseData?.isFallback && aiSettings.fallbackMessage) responseData.answer = aiSettings.fallbackMessage;
  const finalResponse = {
    ...responseData,
    contextSummary: {
      restaurantCount: context.restaurants.length,
      menuItemCount: context.menuItems.length,
      couponCount: context.coupons.length,
      orderCount: context.orders.length,
      reservationCount: context.reservations.length,
    },
    conversationId: persistedConversation ? String(persistedConversation._id) : null,
  };
  const handoffDecision = shouldSuggestHandoff({
    message: cleanMessage,
    intent: finalResponse.intent,
    confidence: finalResponse.confidence,
    isFallback: finalResponse.isFallback,
    threshold: aiSettings.lowConfidenceHandoffThreshold,
  });
  finalResponse.handoffSuggested = handoffDecision.suggested;
  finalResponse.handoffReason = handoffDecision.reason;
  finalResponse.handoffMessage = handoffDecision.suggested
    ? "Nếu bạn cần hỗ trợ thêm, bạn có thể bấm 'Gặp nhân viên' để được hỗ trợ bởi người thật."
    : null;

  if (persistedConversation) {
    try {
      await AiChatMessage.create({
        conversationId: persistedConversation._id,
        restaurantId: restaurantObjectId,
        userId: userObjectId,
        guestId: normalizedGuestId || null,
        role: "assistant",
        content: String(finalResponse.answer || ""),
        intent: finalResponse.intent || "",
        confidence: Number.isFinite(Number(finalResponse.confidence)) ? Number(finalResponse.confidence) : null,
        isFallback: Boolean(finalResponse.isFallback),
        quickReplies: finalResponse.quickReplies || [],
        actions: finalResponse.actions || [],
        sources: finalResponse.sources || [],
        contextSummary: finalResponse.contextSummary,
      });

      await AiChatConversation.updateOne(
        { _id: persistedConversation._id },
        {
          $set: {
            lastMessageAt: new Date(),
            lastMessagePreview: String(finalResponse.answer || "").slice(0, 300),
            lastIntent: String(finalResponse.intent || ""),
          },
          $inc: { messageCount: 2 },
        }
      );
    } catch {
      // swallow persistence errors to keep chatbot response working
    }
  }

  return finalResponse;
};

export const __testables = {
  classifyIntent,
  extractLookupCode,
  buildSearchRegex,
  fallbackAnswer,
  normalizeGuestId,
};
