import mongoose from "mongoose";
import process from "process";
import { AI_CHATBOT_RATE_LIMIT_POLICIES, consumeAiChatbotRateLimit, AI_CHATBOT_RATE_LIMIT_CODE, AI_CHATBOT_RATE_LIMIT_MESSAGE } from "./restaurantChatbotRateLimit.service.js";
import {
  Cart,
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
import { recordKnowledgeGapSuggestion } from "./restaurantChatbotKnowledgeSuggestion.service.js";
import { evaluateRestaurantAiChatbotSafety } from "./restaurantChatbotSafety.service.js";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_HISTORY_MESSAGES = 8;
const MAX_KNOWLEDGE_CHARS = 1800;

const INTENTS = {
  identity: ["tôi là ai", "toi la ai", "biết tôi", "biet toi", "who am i", "tài khoản của tôi", "tai khoan cua toi"],
  navigation: ["ở đâu", "o dau", "mở trang", "mo trang", "đi tới", "di toi", "tìm ở đâu", "tim o dau", "chỗ nào", "cho nao"],
  cart: ["giỏ", "gio", "cart", "giỏ hàng", "gio hang"],
  checkout: ["checkout", "thanh toán", "thanh toan", "trả tiền", "tra tien"],
  reservationHelp: ["đặt bàn", "booking", "bàn", "giữ chỗ", "đặt chỗ", "reservation", "reserve"],
  orderHelp: ["đơn", "order", "mã đơn", "trạng thái", "giao", "ship", "đơn hàng", "don hang"],
  profileHelp: ["hồ sơ", "ho so", "profile", "tài khoản", "tai khoan", "account"],
  managerFeatureHelp: ["doanh thu", "tồn kho", "nhân viên", "hiệu suất", "ca làm", "quản lý", "kpi", "manager", "dashboard"],
  support: ["hỗ trợ", "liên hệ", "khiếu nại", "phàn nàn", "gặp nhân viên", "support"],
  menu: ["món", "menu", "ăn", "đồ ăn", "giá", "recommend", "gợi ý", "ngon", "bán chạy"],
  promotion: ["coupon", "voucher", "mã giảm", "khuyến mãi", "ưu đãi", "giảm giá"],
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
const INTENT_ALIASES = { reservation: "reservationHelp", order: "orderHelp", manager: "managerFeatureHelp" };

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

const maybeCategoryName = (item = {}) => {
  if (typeof item?.categoryName === "string" && item.categoryName.trim()) return item.categoryName.trim();
  if (typeof item?.category === "string" && item.category.trim()) return item.category.trim();
  if (item?.category && typeof item.category === "object" && typeof item.category.name === "string" && item.category.name.trim()) {
    return item.category.name.trim();
  }
  return null;
};

const serializeMenuItem = (item, currency = "VND") => ({
  id: String(item._id || item.id),
  name: item.name,
  description: item.description,
  labels: Array.isArray(item.labels) ? item.labels : [],
  tags: Array.isArray(item.tags) ? item.tags : [],
  category: maybeCategoryName(item),
  categoryName: maybeCategoryName(item),
  image: item.image || (Array.isArray(item.images) ? item.images[0] : null) || null,
  images: Array.isArray(item.images) ? item.images.slice(0, 3) : [],
  basePrice: Number(item.basePrice || 0),
  currentPrice: Number(item.currentPrice || item.basePrice || 0),
  discount: item.discount || null,
  formattedPrice: formatCurrency(item.currentPrice || item.basePrice, currency),
  status: item.status || (item.isAvailable ? "available" : "unavailable"),
  isAvailable: item.isAvailable ?? item.status === "available",
  rate: item.rate,
  orderCounter: item.orderCounter,
  avgPrepTimeMin: item.avgPrepTimeMin || item.preparationTime || null,
  preparationTime: item.preparationTime || item.avgPrepTimeMin || null,
  variants: Array.isArray(item.variants) ? item.variants.slice(0, 4) : [],
  options: Array.isArray(item.options) ? item.options.slice(0, 4) : [],
  servingVariants: Array.isArray(item.servingVariants) ? item.servingVariants.slice(0, 4) : [],
  spicyLevel: item.spicyLevel ?? null,
  restaurantId: item.restaurantId ? String(item.restaurantId) : null,
  hasVariants: (Array.isArray(item.variants) && item.variants.length > 0) || (Array.isArray(item.servingVariants) && item.servingVariants.length > 0),
  hasOptions: Array.isArray(item.options) && item.options.length > 0,
  isVegetarian: Boolean(item.isVegetarian),
  isVegan: Boolean(item.isVegan),
  allergens: Array.isArray(item.allergens) ? item.allergens : [],
  calories: item.calories ?? null,
});

const parseBudgetMax = (message = "") => {
  const raw = asLower(message);
  if (!/(dưới|duoi|tầm|tam|khoảng|khoang|under|below)/.test(raw)) return null;
  const budgetMatch = raw.match(/(?:dưới|duoi|tầm|tam|khoảng|khoang|under|below)\s*(\d[\d.,]*)\s*(k|nghìn|nghin|vnd|đ|d)?/i);
  if (!budgetMatch) return null;
  const numericRaw = String(budgetMatch[1] || "");
  const unit = String(budgetMatch[2] || "").toLowerCase();
  const normalized = numericRaw.replace(/[^\d.,]/g, "");
  let amount = 0;
  if (normalized.includes(".") && normalized.includes(",")) {
    amount = Number(normalized.replace(/[.,]/g, ""));
  } else if (normalized.includes(".")) {
    const parts = normalized.split(".");
    amount = parts[parts.length - 1].length === 3 ? Number(parts.join("")) : Number(normalized);
  } else if (normalized.includes(",")) {
    const parts = normalized.split(",");
    amount = parts[parts.length - 1].length === 3 ? Number(parts.join("")) : Number(normalized.replace(",", "."));
  } else {
    amount = Number(normalized);
  }
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (/k|nghìn|nghin/.test(unit)) amount *= 1000;
  return Math.round(amount);
};

const extractMenuPreferences = (message = "") => {
  const raw = asLower(message);
  const preferences = { taste: [], dietary: [], mealType: [], intentSubtype: [] };
  const budgetMax = parseBudgetMax(message);
  if (budgetMax) preferences.budgetMax = budgetMax;
  const partyMatch = raw.match(/(?:nhóm|nhom|cho)?\s*(\d{1,2})\s*(?:người|nguoi)/i);
  if (partyMatch) preferences.partySize = Number(partyMatch[1]);
  if (/(không cay|khong cay)/.test(raw)) preferences.taste.push("nonSpicy");
  if (/\bcay\b/.test(raw)) preferences.taste.push("spicy");
  if (/(ít dầu|it dau)/.test(raw)) preferences.taste.push("lowOil");
  if (/(thanh đạm|thanh dam)/.test(raw)) preferences.taste.push("light");
  if (/(ngọt|ngot)/.test(raw)) preferences.taste.push("sweet");
  if (/(mặn|man)/.test(raw)) preferences.taste.push("salty");
  if (/(chay|vegetarian)/.test(raw)) preferences.dietary.push("vegetarian");
  if (/\bvegan\b/.test(raw)) preferences.dietary.push("vegan");
  if (/(không hải sản|khong hai san|no seafood)/.test(raw)) preferences.dietary.push("noSeafood");
  if (/(không bò|khong bo|no beef)/.test(raw)) preferences.dietary.push("noBeef");
  if (/(không gà|khong ga|no chicken)/.test(raw)) preferences.dietary.push("noChicken");
  if (/(ăn nhẹ|an nhe|snack)/.test(raw)) preferences.mealType.push("snack");
  if (/(ăn no|an no|main)/.test(raw)) preferences.mealType.push("main");
  if (/(tráng miệng|trang mieng|dessert)/.test(raw)) preferences.mealType.push("dessert");
  if (/(nước uống|do uong|drink|beverage)/.test(raw)) preferences.mealType.push("drink");
  if (/\bcombo\b/.test(raw)) preferences.mealType.push("combo");
  if (/(so sánh|compare)/.test(raw)) preferences.intentSubtype.push("compare");
  if (preferences.budgetMax) preferences.intentSubtype.push("budget");
  if (preferences.dietary.includes("vegetarian") || preferences.dietary.includes("vegan")) preferences.intentSubtype.push("vegetarian");
  if (/(bán chạy|ban chay|best seller|best-seller)/.test(raw)) preferences.intentSubtype.push("bestSeller");
  if (/(nhanh|gấp|gap|quick)/.test(raw)) preferences.intentSubtype.push("quickPrep");
  if (/\bcombo\b/.test(raw)) preferences.intentSubtype.push("combo");
  if (/(kèm|them|upsell)/.test(raw)) preferences.intentSubtype.push("upsell");
  if (!preferences.intentSubtype.length) preferences.intentSubtype.push("recommend");
  return preferences;
};

const isMenuAssistantRequest = (message = "", intent = "general", preferences = {}) => {
  if (intent === "menu") return true;
  const raw = asLower(message);
  const menuKeyword = /(món|menu|ăn|combo|giá|chay|bán chạy|do uong|nước|tráng miệng|dessert|drink)/.test(raw);
  if (menuKeyword) return true;
  const hasStrongSubtype = (preferences.intentSubtype || []).some((x) => ["bestSeller", "quickPrep", "combo", "vegetarian", "budget"].includes(x));
  if (hasStrongSubtype) return true;
  if (preferences.dietary?.length || preferences.mealType?.length || preferences.budgetMax) return true;
  if (preferences.partySize && menuKeyword) return true;
  return false;
};

const scoreMenuItemForPreferences = (item, preferences = {}) => {
  const haystack = asLower(`${item.name || ""} ${item.description || ""} ${(item.labels || []).join(" ")} ${(item.tags || []).join(" ")}`);
  let score = 0;
  if (!item.isAvailable && item.status !== "available") score -= 100;
  if (preferences.intentSubtype?.includes("bestSeller")) score += Number(item.orderCounter || 0) / 10 + Number(item.rate || 0) * 2;
  if (preferences.budgetMax) score += Number(item.currentPrice || item.basePrice || 0) <= preferences.budgetMax ? 25 : -10;
  if (preferences.intentSubtype?.includes("quickPrep")) score += Math.max(0, 20 - Number(item.avgPrepTimeMin || 30));
  if (preferences.taste?.includes("spicy") && /(cay|spicy)/.test(haystack)) score += 8;
  if (preferences.taste?.includes("nonSpicy") && /(không cay|khong cay|non spicy)/.test(haystack)) score += 8;
  if (preferences.dietary?.includes("vegetarian")) score += (item.isVegetarian || /\bchay\b|vegetarian/.test(haystack)) ? 20 : -15;
  if (preferences.dietary?.includes("vegan")) score += (item.isVegan || /\bvegan\b/.test(haystack)) ? 20 : -15;
  if (preferences.dietary?.includes("noSeafood") && /(hải sản|hai san|seafood|shrimp|fish|crab)/.test(haystack)) score -= 20;
  if (preferences.mealType?.includes("drink") && /(drink|nước|trà|tea|coffee)/.test(`${haystack} ${asLower(item.categoryName)}`)) score += 10;
  if (preferences.mealType?.includes("dessert") && /(dessert|tráng miệng|cake|kem)/.test(`${haystack} ${asLower(item.categoryName)}`)) score += 10;
  return score;
};

const rankMenuRecommendations = (menuItems = [], preferences = {}, limit = 6) =>
  menuItems
    .map((item) => {
      const score = scoreMenuItemForPreferences(item, preferences);
      const reason = preferences.budgetMax && Number(item.currentPrice || item.basePrice || 0) <= preferences.budgetMax
        ? "Phù hợp ngân sách của bạn"
        : preferences.intentSubtype?.includes("bestSeller")
          ? "Ưu tiên theo dữ liệu bán chạy/đánh giá"
          : preferences.intentSubtype?.includes("quickPrep")
            ? "Thời gian chuẩn bị nhanh"
            : "Phù hợp theo tiêu chí bạn yêu cầu";
      return { ...item, score, recommendationReason: reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

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



const publicRole = (user) => user ? (roleSlug(user) || user?.roleName || user?.userType || "customer") : "guest";

const buildUserSafeProfile = (user) => {
  if (!user) return { authenticated: false, displayName: "Khách", role: "guest", summary: "Người dùng hiện là khách chưa đăng nhập." };
  const displayName = String(user.fullName || user.name || user.displayName || user.email || "Người dùng").slice(0, 120);
  const email = user.email ? String(user.email).slice(0, 160) : null;
  const role = publicRole(user);
  return {
    authenticated: true,
    displayName,
    email,
    role,
    userType: String(user.userType || role || "customer"),
    summary: `${displayName}${email ? ` (${email})` : ""}, vai trò ${role || "customer"}.`,
  };
};

const normalizePageContext = (pageContext = {}, fallbackRestaurantId = null, user = null) => {
  const safe = pageContext && typeof pageContext === "object" ? pageContext : {};
  const selected = safe.selectedMenuItem && typeof safe.selectedMenuItem === "object" ? safe.selectedMenuItem : null;
  return {
    pathname: String(safe.pathname || "").slice(0, 240),
    restaurantId: String(safe.restaurantId || fallbackRestaurantId || "").slice(0, 80) || null,
    selectedMenuItem: selected ? {
      id: String(selected.id || selected.menuItemId || "").slice(0, 80),
      name: String(selected.name || selected.label || "").slice(0, 160),
      restaurantId: String(selected.restaurantId || safe.restaurantId || fallbackRestaurantId || "").slice(0, 80) || null,
    } : null,
    userRole: String(safe.userRole || publicRole(user) || "guest").slice(0, 80),
  };
};

const sanitizeFeatureMatches = (featureMatches = [], role = "guest") => (Array.isArray(featureMatches) ? featureMatches : [])
  .slice(0, 6)
  .map((item) => ({
    key: String(item?.key || "").slice(0, 80),
    label: String(item?.label || "").slice(0, 120),
    intent: String(item?.intent || "navigation").slice(0, 80),
    path: String(item?.path || item?.href || "").slice(0, 240),
    actionType: String(item?.actionType || "link").slice(0, 40),
    description: String(item?.description || "").slice(0, 240),
    managerOnly: Boolean(item?.managerOnly),
  }))
  .filter((item) => item.key && item.label && (item.actionType === "openCart" || item.path.startsWith("/")))
  .filter((item) => !item.managerOnly || ROLE_MANAGER_LIKE.has(String(role || "").toLowerCase()));

const serializeCart = (cart, currency = "VND") => {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const totalQuantity = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  const total = items.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0), 0);
  return {
    status: cart?.status || "active",
    totalQuantity,
    formattedTotal: formatCurrency(total, currency),
    items: items.slice(0, 5).map((item) => ({ name: item.name, quantity: item.quantity, price: item.price, formattedPrice: formatCurrency(item.price, currency), restaurantId: item.restaurantId ? String(item.restaurantId) : null })),
  };
};

const classifyIntent = (message) => {
  const raw = asLower(message);
  let best = { intent: "general", score: 0 };
  Object.entries(INTENTS).forEach(([intent, keywords]) => {
    const score = keywords.reduce((sum, keyword) => sum + (raw.includes(keyword) ? 1 : 0), 0);
    if (score > best.score) best = { intent, score };
  });
  return INTENT_ALIASES[best.intent] || best.intent;
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

const fetchMenuItems = async ({ restaurantId, message, limit = 8 }) => {
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
    .limit(limit)
    .lean();

  if (!items.length && rid) {
    items = await MenuItem.find({ restaurantId: rid, status: "available" })
      .sort({ orderCounter: -1, rate: -1, sortOrder: 1 })
      .limit(limit)
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
  if (!uid) return [];
  const filter = { userId: uid };
  if (rid) filter.restaurantId = rid;
  if (code) filter.$or = [{ orderCode: code }, { trackingCode: code }];

  return Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(code ? 3 : 5)
    .lean();
};

const fetchCart = async ({ user }) => {
  const uid = toObjectId(user?.id || user?._id);
  if (!uid) return null;
  return Cart.findOne({ userId: uid, status: "active" }).sort({ updatedAt: -1 }).lean();
};

const fetchReservations = async ({ restaurantId, message, user }) => {
  const code = extractLookupCode(message);
  const rid = toObjectId(restaurantId);
  const uid = toObjectId(user?.id || user?._id);
  const filter = {};
  if (rid) filter.restaurantId = rid;
  if (!uid) return [];
  filter.userId = uid;
  if (code) filter.orderCode = code;

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

const buildContext = async ({ message, restaurantId, user, pageContext = {} }) => {
  const intent = classifyIntent(message);
  const menuPreferences = extractMenuPreferences(message);
  const isMenuAssistant = isMenuAssistantRequest(message, intent, menuPreferences);
  const currentPage = normalizePageContext(pageContext, restaurantId, user);
  const effectiveRestaurantId = restaurantId || currentPage.restaurantId;
  const restaurants = await fetchRestaurants({ restaurantId: effectiveRestaurantId, message });
  const primaryRestaurant = restaurants[0] || null;
  const currency = primaryRestaurant?.defaultCurrency || "VND";

  const [menuItems, coupons, orders, reservations, cart] = await Promise.all([
    fetchMenuItems({ restaurantId: effectiveRestaurantId || primaryRestaurant?._id, message, limit: isMenuAssistant && (effectiveRestaurantId || primaryRestaurant?._id) ? 30 : 8 }),
    fetchCoupons({ restaurantId: effectiveRestaurantId || primaryRestaurant?._id }),
    fetchOrders({ restaurantId: effectiveRestaurantId || primaryRestaurant?._id, message, user }),
    fetchReservations({ restaurantId: effectiveRestaurantId || primaryRestaurant?._id, message, user }),
    fetchCart({ user }),
  ]);

  const serializedMenuItems = menuItems.map((item) => serializeMenuItem(item, currency));
  const recommendedMenuItems = rankMenuRecommendations(serializedMenuItems, menuPreferences, 10);
  const userSafeProfile = buildUserSafeProfile(user);
  const matchedFeatureMapEntries = sanitizeFeatureMatches(pageContext?.featureMatches || [], currentPage.userRole || userSafeProfile.role);
  return {
    intent,
    user: userSafeProfile,
    userSafeProfile,
    currentPage,
    matchedFeatureMapEntries,
    cartSummary: cart ? serializeCart(cart, currency) : null,
    restaurants: restaurants.map(serializeRestaurant),
    menuItems: (isMenuAssistant ? recommendedMenuItems : serializedMenuItems).slice(0, 10),
    recommendedMenuItems: recommendedMenuItems.slice(0, 10),
    menuPreferences,
    coupons: coupons.map((coupon) => serializeCoupon(coupon, currency)).slice(0, 3),
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


const buildMenuItemLookup = (context = {}) => {
  const map = new Map();
  for (const item of [...(context.recommendedMenuItems || []), ...(context.menuItems || [])]) {
    if (item?.id) map.set(String(item.id), item);
  }
  return map;
};

const enrichMenuItemSource = (source, context = {}, menuItemLookup = buildMenuItemLookup(context)) => {
  if (source?.type !== "menuItem") return source;
  const item = menuItemLookup.get(String(source?.id || ""));
  if (!item) return null;
  return {
    ...source,
    label: source?.label || item.name,
    formattedPrice: item.formattedPrice,
    status: item.status,
    isAvailable: item.isAvailable,
    hasOptions: Boolean(item.options?.length || item.hasOptions),
    hasVariants: Boolean(item.variants?.length || item.servingVariants?.length || item.hasVariants),
    servingVariants: Array.isArray(item.servingVariants) ? item.servingVariants : [],
    restaurantId: item.restaurantId || context.restaurants?.[0]?.id || null,
    basePrice: item.basePrice,
    currentPrice: item.currentPrice,
    price: item.currentPrice ?? item.basePrice,
  };
};

const isForbiddenAction = (action = {}) => {
  const text = `${action?.type || ""} ${action?.label || ""} ${action?.href || ""}`.toLowerCase();
  return /checkout|payment|add_to_cart_candidate|add-to-cart|addtocart|thanh toán|thanh\s*toan/.test(text);
};

const normalizeAiAction = (action, allowedItemIds) => {
  if (!action || isForbiddenAction(action)) return null;
  const type = String(action.type || "link").trim();
  if (!["link", "handoff", "search", "openCart"].includes(type)) return null;
  const href = String(action.href || "").trim();
  if (type !== "openCart" && !href) return null;
  if (href && !href.startsWith("/") && !/^https?:\/\//i.test(href)) return null;
  if (href.startsWith("/food/")) {
    const itemId = href.replace("/food/", "").split(/[/?#]/)[0];
    if (!allowedItemIds.has(itemId)) return null;
  }
  return {
    type,
    label: String(action.label || "").trim() || (type === "openCart" ? "Mở giỏ hàng" : "Mở liên kết"),
    href,
  };
};

const normalizeAiResult = (parsed, context) => {
  const allowedItemIds = new Set([...(context.recommendedMenuItems || []), ...(context.menuItems || [])].map((x) => String(x.id)));
  const actions = Array.isArray(parsed?.actions)
    ? parsed.actions
      .map((action) => normalizeAiAction(action, allowedItemIds))
      .filter(Boolean)
      .slice(0, 4)
    : fallbackActions(context);
  const menuItemLookup = buildMenuItemLookup(context);
  const sources = Array.isArray(parsed?.sources)
    ? parsed.sources
      .slice(0, 8)
      .map((source) => enrichMenuItemSource(source, context, menuItemLookup))
      .filter(Boolean)
    : fallbackSources(context);
  const answer = String(parsed?.answer || "").trim() || fallbackAnswer(context).answer;
  const hasUnknownPrice = context.intent === "menu" && /đ|vnd|k\b/i.test(answer) && !sources.some((s) => s.type === "menuItem");
  return {
    answer: hasUnknownPrice ? menuFallback(context) : answer,
    intent: parsed?.intent || context.intent || "general",
    confidence: Math.max(0, Math.min(1, Number(parsed?.confidence ?? 0.7))),
    quickReplies: Array.isArray(parsed?.quickReplies) && parsed.quickReplies.length
      ? parsed.quickReplies.map(String).slice(0, 4)
      : fallbackQuickReplies(parsed?.intent || context.intent),
    actions,
    sources,
    isFallback: false,
  };
};


const buildProviderPromptContext = (context = {}) => ({
  userSafeProfile: context.userSafeProfile || context.user || { authenticated: false, role: "guest" },
  currentPage: context.currentPage || {},
  restaurants: context.restaurants?.slice(0, 2) || [],
  menuPreferences: context.menuPreferences || {},
  recommendedMenuItems: context.recommendedMenuItems?.slice(0, 8) || [],
  menuItems: context.menuItems?.slice(0, 8) || [],
  coupons: context.coupons?.slice(0, 3) || [],
  cartSummary: context.cartSummary || null,
  orders: context.orders?.slice(0, 5) || [],
  reservations: context.reservations?.slice(0, 5) || [],
  matchedFeatureMapEntries: context.matchedFeatureMapEntries?.slice(0, 6) || [],
  intent: context.intent,
});

const callGemini = async ({ message, context, history, knowledgeItems = [] }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.AI_CHATBOT_MODEL || process.env.AI_MODEL || "gemini-1.5-flash";
  const endpoint = `${GEMINI_ENDPOINT_BASE}/${model}:generateContent?key=${apiKey}`;

  const knowledgeLines = buildKnowledgePrompt(knowledgeItems);
  const systemInstruction = [
    "Bạn là AI Menu Assistant cho nhà hàng trong Cohan Restaurant App.",
    "Trả lời tiếng Việt, thân thiện, ngắn gọn, đúng nghiệp vụ nhà hàng.",
    "Không bịa món, giá, trạng thái món, coupon, chính sách, số điện thoại, thông tin cá nhân hoặc chính sách nhà hàng.",
    "Chỉ sử dụng userSafeProfile đã được làm sạch: displayName, email hiển thị, role/userType; không yêu cầu hoặc tiết lộ mật khẩu, token, secret, API key, internal id.",
    "Chỉ trả lời đơn hàng/đặt bàn trong CONTEXT.orders và CONTEXT.reservations vì đó là dữ liệu thuộc người dùng hiện tại.",
    "Từ chối dữ liệu người dùng khác và dữ liệu quản lý nếu userSafeProfile.role không phải manager/admin.",
    "Chỉ dùng dữ liệu trong CONTEXT để nói về món ăn, đơn hàng, đặt bàn, coupon hoặc thông tin nhà hàng. Nếu thiếu dữ liệu, hãy nói rõ và gợi ý bước tiếp theo.",
    "Chỉ recommend món có trong CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems.",
    "Nếu có RESTAURANT_KNOWLEDGE thì ưu tiên thông tin đó hơn suy đoán chung.",
    "Nếu khách hỏi món không có trong context, nói không thấy trong dữ liệu hiện tại.",
    "Không đưa lời khuyên y tế chắc chắn; nếu khách dị ứng hãy nhắc xác nhận với nhân viên.",
    "Không tự đặt món/thanh toán; không tạo action checkout/payment/add_to_cart_candidate.",
    "Trả về JSON hợp lệ đúng schema: {\"answer\": string, \"intent\": string, \"confidence\": number, \"quickReplies\": string[], \"actions\": [{\"type\":\"link|handoff|search\",\"label\": string, \"href\": string}], \"sources\": [{\"type\": string, \"id\": string, \"label\": string}] }.",
    "Không dùng markdown code fence; chỉ trả JSON, không thêm giải thích ngoài JSON.",
    `CONTEXT: ${JSON.stringify(buildProviderPromptContext(context))}`,
    knowledgeLines.length ? `RESTAURANT_KNOWLEDGE:\n${knowledgeLines.join("\n\n")}` : "",
  ].join("\n");

  const contents = recentHistoryForPrompt(history).map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));

  const finalContents = [];
  for (const item of contents) {
    if (finalContents.length > 0 && finalContents[finalContents.length - 1].role === item.role) {
      finalContents[finalContents.length - 1].parts[0].text += `\n${item.parts[0].text}`;
    } else {
      finalContents.push(item);
    }
  }

  if (finalContents.length > 0 && finalContents[finalContents.length - 1].role === "user") {
    finalContents[finalContents.length - 1].parts[0].text += `\n${message}`;
  } else {
    finalContents.push({ role: "user", parts: [{ text: message }] });
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: finalContents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 800,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const parsed = safeJsonParse(content);
    return parsed ? normalizeAiResult(parsed, context) : null;
  } catch {
    return null;
  }
};

const callAiProvider = async (args) => {
  const provider = String(args?.provider || process.env.AI_PROVIDER || "openai").toLowerCase();
  if (provider === "gemini") {
    const geminiResult = await callGemini(args);
    if (geminiResult) return geminiResult;
    const openAiFallback = await callOpenAI(args);
    return openAiFallback || fallbackAnswer(args.context || {});
  }
  const openAiResult = await callOpenAI(args);
  return openAiResult || fallbackAnswer(args.context || {});
};

const callOpenAI = async ({ message, context, history, knowledgeItems = [] }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.AI_CHATBOT_MODEL || process.env.AI_MODEL || "gpt-5";
  const knowledgeLines = buildKnowledgePrompt(knowledgeItems);
  const prompt = [
    "Bạn là AI Menu Assistant cho nhà hàng trong Cohan Restaurant App.",
    "Trả lời tiếng Việt, thân thiện, ngắn gọn, đúng nghiệp vụ nhà hàng.",
    "Không bịa món, giá, trạng thái món, coupon, chính sách, số điện thoại, thông tin cá nhân hoặc chính sách nhà hàng.",
    "Chỉ sử dụng userSafeProfile đã được làm sạch: displayName, email hiển thị, role/userType; không yêu cầu hoặc tiết lộ mật khẩu, token, secret, API key, internal id.",
    "Chỉ trả lời đơn hàng/đặt bàn trong CONTEXT.orders và CONTEXT.reservations vì đó là dữ liệu thuộc người dùng hiện tại.",
    "Từ chối dữ liệu người dùng khác và dữ liệu quản lý nếu userSafeProfile.role không phải manager/admin.",
    "Chỉ dùng dữ liệu trong CONTEXT để nói về món ăn, đơn hàng, đặt bàn, coupon hoặc thông tin nhà hàng. Nếu thiếu dữ liệu, hãy nói rõ và gợi ý bước tiếp theo.",
    "Chỉ recommend món có trong CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems.",
    "Nếu có RESTAURANT_KNOWLEDGE thì ưu tiên thông tin đó hơn suy đoán chung.",
    "Nếu khách hỏi món không có trong context, nói không thấy trong dữ liệu hiện tại.",
    "Không đưa lời khuyên y tế chắc chắn; nếu khách dị ứng hãy nhắc xác nhận với nhân viên.",
    "Không tự đặt món/thanh toán; không tạo action checkout/payment/add_to_cart_candidate.",
    "Trả về JSON hợp lệ đúng schema: {\"answer\": string, \"intent\": string, \"confidence\": number, \"quickReplies\": string[], \"actions\": [{\"type\":\"link|handoff|search\",\"label\": string, \"href\": string}], \"sources\": [{\"type\": string, \"id\": string, \"label\": string}] }.",
    "Không dùng markdown code fence; chỉ trả JSON, không thêm giải thích ngoài JSON.",
    `CONTEXT: ${JSON.stringify(buildProviderPromptContext(context))}`,
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
        model,
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
    menu: ["Gợi ý combo cho 2 người", "Món dưới 100k", "Món bán chạy", "Món chay"],
    reservationHelp: ["Tôi muốn đặt bàn", "Chính sách đặt cọc", "Xem sơ đồ bàn"],
    cart: ["Mở giỏ hàng", "Cách thanh toán", "Gợi ý món thêm"],
    checkout: ["Cách thanh toán", "Mở giỏ hàng", "Kiểm tra đơn"],
    orderHelp: ["Kiểm tra đơn hàng", "Đơn hàng của tôi", "Gọi nhân viên"],
    profileHelp: ["Mở hồ sơ", "Đơn hàng của tôi", "Đặt bàn của tôi"],
    navigation: ["Mở giỏ hàng", "Đơn hàng ở đâu", "Hồ sơ ở đâu"],
    promotion: ["Mã giảm giá hiện có", "Điều kiện áp dụng", "Gợi ý combo"],
    managerFeatureHelp: ["Tóm tắt vận hành", "Cảnh báo tồn kho", "Hiệu suất nhân viên"],
    support: ["Gặp nhân viên hỗ trợ", "Tôi có khiếu nại", "Hướng dẫn sử dụng"],
  };
  return byIntent[intent] || ["Gợi ý món ngon", "Cách đặt bàn", "Kiểm tra đơn hàng"];
};

const fallbackActions = (context) => {
  const restaurantId = context.restaurants?.[0]?.id;
  const topItemId = context.recommendedMenuItems?.[0]?.id || context.menuItems?.[0]?.id;
  const actions = [];
  for (const entry of context.matchedFeatureMapEntries || []) {
    if (entry.managerOnly && !ROLE_MANAGER_LIKE.has(String(context.userSafeProfile?.role || context.user?.role || "").toLowerCase())) continue;
    actions.push({ type: entry.actionType === "openCart" || entry.key === "cart" ? "openCart" : "link", label: entry.label, href: entry.path || "" });
    if (actions.length >= 3) return actions;
  }
  if (context.intent === "cart") actions.push({ type: "openCart", label: "Mở giỏ hàng", href: "" });
  if (context.intent === "checkout") actions.push({ type: "openCart", label: "Kiểm tra giỏ hàng", href: "" });
  if (context.intent === "profileHelp") actions.push({ type: "link", label: "Hồ sơ của tôi", href: "/profile" });
  if (context.intent === "navigation") actions.push({ type: "link", label: "Trang chủ", href: "/" });
  if (context.intent === "reservationHelp" && restaurantId) {
    actions.push({ type: "link", label: "Mở trang đặt bàn", href: `/restaurant/${restaurantId}/layout` });
  }
  if (context.intent === "menu" && restaurantId) {
    actions.push({ type: "link", label: "Xem menu", href: `/restaurant/${restaurantId}` });
    if (topItemId) {
      actions.push({ type: "link", label: "Xem món gợi ý", href: `/food/${topItemId}` });
    }
  }
  if (context.intent === "promotion" && restaurantId) {
    actions.push({ type: "link", label: "Xem coupon", href: `/coupons/${restaurantId}` });
  }
  if (context.intent === "orderHelp") {
    actions.push({ type: "link", label: "Đơn hàng của tôi", href: "/orders" });
  }
  if (!actions.length) actions.push({ type: "link", label: "Trung tâm hỗ trợ", href: "/contact" });
  return actions;
};

const fallbackSources = (context) => [
  ...(context.restaurants || []).slice(0, 2).map((item) => ({ type: "restaurant", id: item.id, label: item.name })),
  ...((context.recommendedMenuItems?.length ? context.recommendedMenuItems : context.menuItems) || []).slice(0, 5).map((item) => ({ type: "menuItem", id: item.id, label: item.name, formattedPrice: item.formattedPrice, status: item.status, isAvailable: item.isAvailable, hasOptions: Boolean(item.options?.length), hasVariants: Boolean(item.variants?.length || item.servingVariants?.length || item.hasVariants), servingVariants: Array.isArray(item.servingVariants) ? item.servingVariants : [], restaurantId: item.restaurantId || context.restaurants?.[0]?.id || null, basePrice: item.basePrice, currentPrice: item.currentPrice, price: item.currentPrice ?? item.basePrice })),
  ...(context.coupons || []).slice(0, 2).map((item) => ({ type: "coupon", id: item.id, label: item.code })),
];

const menuFallback = (context) => {
  const items = context.recommendedMenuItems?.length ? context.recommendedMenuItems : (context.menuItems || []);
  if (!items.length) {
    return "Hiện mình chưa tìm thấy món phù hợp trong dữ liệu menu. Bạn có thể thử hỏi theo tên món, loại món hoặc mở trang nhà hàng để xem đầy đủ menu.";
  }
  const lines = items.slice(0, 5).map((item, index) => {
    const rating = Number(item.rate || 0) > 0 ? `, đánh giá ${item.rate}/5` : "";
    return `${index + 1}. ${item.name} - ${item.formattedPrice}${rating} (${item.recommendationReason || "dựa trên dữ liệu hiện có"})`;
  });
  return `Mình chỉ thấy các món sau trong dữ liệu hiện có:\n${lines.join("\n")}\nBạn muốn lọc theo ngân sách, món chay hay món ra nhanh không?`;
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


const identityFallback = (context) => {
  const profile = context.userSafeProfile || context.user;
  if (!profile?.authenticated) return "Bạn hiện đang dùng chatbot với tư cách khách (guest). Nếu đăng nhập, mình có thể hỗ trợ thông tin tài khoản, đơn hàng và đặt bàn của chính bạn.";
  const bits = [`Bạn là ${profile.displayName || "người dùng đã đăng nhập"}`];
  if (profile.email) bits.push(`email ${profile.email}`);
  if (profile.role) bits.push(`vai trò ${profile.role}`);
  return `${bits.join(", ")}. Mình chỉ dùng các thông tin hiển thị an toàn này, không truy cập hay tiết lộ mật khẩu, token hoặc bí mật nội bộ.`;
};

const navigationFallback = (context) => {
  const entries = context.matchedFeatureMapEntries || [];
  if (entries.length) {
    const lines = entries.slice(0, 3).map((entry) => `- ${entry.label}: ${entry.path}`).join("\n");
    return `Bạn có thể mở các mục sau trong ứng dụng:\n${lines}`;
  }
  if (context.intent === "cart") return "Bạn có thể mở Giỏ hàng bằng nút giỏ hàng trên giao diện hoặc vào /cart để xem món đã chọn trước khi thanh toán.";
  if (context.intent === "checkout") return "Để đặt món, hãy chọn món trong menu, thêm vào giỏ, mở Giỏ hàng rồi bấm thanh toán/checkout để xác nhận đơn.";
  if (context.intent === "profileHelp") return "Bạn có thể vào Hồ sơ/Tài khoản để xem thông tin cá nhân an toàn; đơn hàng ở /orders và đặt bàn ở khu vực Reservations/đặt bàn.";
  return "Mình có thể chỉ đường trong app: Trang chủ, nhà hàng, menu, món ăn, giỏ hàng, thanh toán, đơn hàng, đặt bàn, hồ sơ và hỗ trợ.";
};

const shouldRefuseRequest = ({ message, context }) => {
  const raw = asLower(message);
  if (/(password|mật khẩu|mat khau|token|secret|api key|apikey|credential|credentials|refresh token|access token|jwt|khóa bí mật|khoa bi mat)/.test(raw)) {
    return { refused: true, reason: "credential_request", answer: "Mình không thể cung cấp hoặc truy xuất mật khẩu, token, API key, secret hay thông tin đăng nhập. Nếu bạn cần hỗ trợ tài khoản, hãy dùng chức năng đặt lại mật khẩu hoặc liên hệ hỗ trợ." };
  }
  if (/(người dùng khác|nguoi dung khac|tài khoản khác|tai khoan khac|email của khách|email cua khach|số điện thoại khách|so dien thoai khach|another user|other user)/.test(raw)) {
    return { refused: true, reason: "other_user_data", answer: "Mình chỉ có thể hỗ trợ dữ liệu thuộc về chính bạn trong ngữ cảnh hiện tại. Mình không thể tiết lộ thông tin của người dùng khác." };
  }
  const asksManagerData = /(doanh thu|revenue|nhân viên|nhan vien|lương|luong|payroll|tồn kho|ton kho|inventory|kpi|báo cáo quản lý|bao cao quan ly)/.test(raw);
  const role = context?.userSafeProfile?.role || context?.user?.role;
  if (asksManagerData && !ROLE_MANAGER_LIKE.has(String(role || "").toLowerCase())) {
    return { refused: true, reason: "manager_only", answer: "Nội dung quản lý như doanh thu, tồn kho, nhân viên hoặc KPI chỉ dành cho tài khoản manager/admin. Với vai trò hiện tại, mình có thể hỗ trợ menu, đặt món, đặt bàn, đơn hàng của bạn và hỗ trợ chung." };
  }
  return { refused: false };
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
    identity: identityFallback,
    menu: menuFallback,
    reservationHelp: reservationFallback,
    cart: navigationFallback,
    checkout: navigationFallback,
    navigation: navigationFallback,
    orderHelp: orderFallback,
    profileHelp: navigationFallback,
    promotion: promotionFallback,
    managerFeatureHelp: managerFallback,
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
  persist = true,
  recordSuggestions = true,
  evaluationMode = false,
  pageContext = {},
} = {}) => {
  const cleanMessage = normalizeMessage(message);
  const shouldPersist = Boolean(persist && !evaluationMode);
  const shouldRecordSuggestions = Boolean(recordSuggestions && !evaluationMode);
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

  if (shouldPersist) try {
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

  const safetyEval = await evaluateRestaurantAiChatbotSafety({ restaurantId, message: cleanMessage });
  if (safetyEval.blocked) {
    const blockedAnswer = String(safetyEval.blockedMessage || aiSettings.fallbackMessage || "Xin lỗi, mình chưa thể hỗ trợ nội dung này. Vui lòng liên hệ nhân viên để được hỗ trợ thêm.");
    return {
      answer: blockedAnswer,
      intent: "safety",
      confidence: 1,
      quickReplies: aiSettings.starterQuickReplies || [],
      actions: [],
      sources: [],
      knowledgeMatches: [],
      safetyResult: {
        blocked: true,
        outOfScope: Boolean(safetyEval?.outOfScope),
        disclaimers: Array.isArray(safetyEval?.disclaimers) ? safetyEval.disclaimers : [],
        handoffSuggested: Boolean(safetyEval?.handoffSuggested),
        matchedRuleIds: Array.isArray(safetyEval?.matchedRules) ? safetyEval.matchedRules.map((r) => String(r?._id || r?.id || "")).filter(Boolean) : [],
      },
      evaluationMode: Boolean(evaluationMode),
      contextSummary: { restaurantCount: 0, menuItemCount: 0, couponCount: 0, orderCount: 0, reservationCount: 0 },
      conversationId: persistedConversation ? String(persistedConversation._id) : null,
      answerMessageId: null,
      isFallback: true,
      handoffSuggested: Boolean(aiSettings.handoffEnabled && safetyEval.handoffSuggested),
      handoffReason: safetyEval.outOfScope ? "out_of_scope" : "blocked_topic",
      handoffMessage: aiSettings.handoffEnabled && safetyEval.handoffSuggested ? (safetyEval.handoffMessage || "Nội dung này cần nhân viên hỗ trợ. Bạn có thể bấm 'Gặp nhân viên'.") : null,
    };
  }

  const context = await buildContext({ message: cleanMessage, restaurantId, user, pageContext });
  const refusal = shouldRefuseRequest({ message: cleanMessage, context });
  if (refusal.refused) {
    return {
      answer: refusal.answer,
      intent: context.intent || "support",
      confidence: 1,
      quickReplies: fallbackQuickReplies(context.intent),
      actions: [],
      sources: [],
      knowledgeMatches: [],
      safetyResult: { blocked: true, outOfScope: false, disclaimers: [], handoffSuggested: false, matchedRuleIds: [] },
      evaluationMode: Boolean(evaluationMode),
      contextSummary: { restaurantCount: context.restaurants.length, menuItemCount: context.menuItems.length, couponCount: context.coupons.length, orderCount: context.orders.length, reservationCount: context.reservations.length },
      conversationId: persistedConversation ? String(persistedConversation._id) : null,
      answerMessageId: null,
      isFallback: true,
      handoffSuggested: false,
      handoffReason: refusal.reason,
      handoffMessage: null,
    };
  }
  const knowledgeItems = await findRelevantKnowledgeForChatbot({ restaurantId, message: cleanMessage, limit: 4 });
  const aiResult = await callAiProvider({
    message: cleanMessage,
    context,
    history: persistedHistory.length ? persistedHistory : history,
    knowledgeItems,
  });
  const responseData = aiResult || fallbackAnswer(context);
  if (responseData?.isFallback && aiSettings.fallbackMessage) responseData.answer = aiSettings.fallbackMessage;
  if (Array.isArray(safetyEval?.disclaimers) && safetyEval.disclaimers.length) {
    responseData.answer = `${String(responseData.answer || "").trim()}

${safetyEval.disclaimers.map((d) => `Lưu ý: ${d}`).join("\n")}`.trim();
  }
  if (safetyEval?.handoffSuggested && aiSettings.handoffEnabled) {
    responseData.handoffSuggested = true;
    responseData.handoffReason = responseData.handoffReason || "handoff_topic";
    responseData.handoffMessage = responseData.handoffMessage || safetyEval.handoffMessage || "Chủ đề này phù hợp để nhân viên hỗ trợ trực tiếp.";
  }
  const finalResponse = {
    ...responseData,
    knowledgeMatches: knowledgeItems.map((item) => ({
      id: String(item?._id || item?.id || ""),
      title: String(item?.title || ""),
      category: String(item?.category || ""),
      sourceType: String(item?.sourceType || ""),
      score: Number.isFinite(Number(item?._score)) ? Number(item._score) : null,
    })),
    safetyResult: {
      blocked: Boolean(safetyEval?.blocked),
      outOfScope: Boolean(safetyEval?.outOfScope),
      disclaimers: Array.isArray(safetyEval?.disclaimers) ? safetyEval.disclaimers : [],
      handoffSuggested: Boolean(safetyEval?.handoffSuggested),
      matchedRuleIds: Array.isArray(safetyEval?.matchedRules) ? safetyEval.matchedRules.map((r) => String(r?._id || r?.id || "")).filter(Boolean) : [],
    },
    evaluationMode: Boolean(evaluationMode),
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

  const shouldRecordKnowledgeGap = Boolean(
    shouldRecordSuggestions && aiSettings.enabled && restaurantId && cleanMessage && (
      finalResponse.isFallback ||
      (Number.isFinite(Number(finalResponse.confidence)) && Number(finalResponse.confidence) < Number(aiSettings.lowConfidenceHandoffThreshold || 0.6)) ||
      !knowledgeItems.length ||
      finalResponse.handoffSuggested
    )
  );

  if (shouldRecordKnowledgeGap) {
    try {
      let triggerType = "fallback";
      if (!knowledgeItems.length) triggerType = "no_knowledge_match";
      else if (finalResponse.handoffSuggested) triggerType = "handoff";
      else if (Number.isFinite(Number(finalResponse.confidence)) && Number(finalResponse.confidence) < Number(aiSettings.lowConfidenceHandoffThreshold || 0.6)) triggerType = "low_confidence";

      await recordKnowledgeGapSuggestion({
        restaurantId,
        question: cleanMessage,
        triggerType,
        confidence: finalResponse.confidence,
        conversationId: persistedConversation ? String(persistedConversation._id) : null,
      });
    } catch (err) {
      console.warn("[ai-chatbot] record knowledge suggestion failed", err?.message || err);
    }
  }

  let answerMessageId = null;
  if (shouldPersist && persistedConversation) {
    try {
      const assistantMessage = await AiChatMessage.create({
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

      answerMessageId = String(assistantMessage?._id || "");
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

  return {
    ...finalResponse,
    quickReplies: Array.isArray(finalResponse.quickReplies) ? finalResponse.quickReplies : [],
    actions: Array.isArray(finalResponse.actions) ? finalResponse.actions : [],
    sources: Array.isArray(finalResponse.sources) ? finalResponse.sources : [],
    knowledgeMatches: Array.isArray(finalResponse.knowledgeMatches) ? finalResponse.knowledgeMatches : [],
    answerMessageId: answerMessageId || null,
    conversationId: finalResponse.conversationId ? String(finalResponse.conversationId) : null,
  };
};

export const __testables = {
  classifyIntent,
  extractLookupCode,
  buildSearchRegex,
  fallbackAnswer,
  extractMenuPreferences,
  parseBudgetMax,
  isMenuAssistantRequest,
  maybeCategoryName,
  serializeMenuItem,
  scoreMenuItemForPreferences,
  rankMenuRecommendations,
  menuFallback,
  fallbackQuickReplies,
  fallbackActions,
  fallbackSources,
  normalizeGuestId,
  normalizeAiResult,
  enrichMenuItemSource,
  callAiProvider,
  callGemini,
  buildUserSafeProfile,
  normalizePageContext,
  buildProviderPromptContext,
  shouldRefuseRequest,
};
