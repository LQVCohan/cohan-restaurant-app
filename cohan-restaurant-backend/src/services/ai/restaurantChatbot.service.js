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
import { callLocalChatProvider } from "./localAiProvider.service.js";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_HISTORY_MESSAGES = 8;
const MAX_KNOWLEDGE_CHARS = 1800;

const INTENTS = {
  identity: ["tôi là ai", "toi la ai", "biết tôi", "biet toi", "who am i", "tài khoản của tôi", "tai khoan cua toi"],
  navigation: ["ở đâu", "o dau", "mở trang", "mo trang", "đi tới", "di toi", "tìm ở đâu", "tim o dau", "chỗ nào", "cho nao"],
  cart: ["giỏ", "gio", "cart", "giỏ hàng", "gio hang"],
  checkout: ["checkout", "thanh toán", "thanh toan", "trả tiền", "tra tien", "làm sao đặt món", "lam sao dat mon", "hướng dẫn đặt món", "huong dan dat mon", "tôi muốn gọi món", "toi muon goi mon", "cách thêm món", "cach them mon"],
  reservationHelp: ["đặt bàn", "dat ban", "booking", "bàn", "ban", "giữ chỗ", "giu cho", "đặt chỗ", "dat cho", "bàn trống", "ban trong", "reservation", "reserve"],
  orderHelp: ["đơn", "order", "mã đơn", "trạng thái", "giao", "ship", "đơn hàng", "don hang"],
  profileHelp: ["hồ sơ", "ho so", "profile", "tài khoản", "tai khoan", "account"],
  managerFeatureHelp: ["doanh thu", "tồn kho", "nhân viên", "hiệu suất", "ca làm", "quản lý", "kpi", "manager", "dashboard"],
  restaurantInfo: ["mở cửa", "mo cua", "giờ mở", "gio mo", "opening hours", "open hours", "mấy giờ", "may gio", "địa chỉ", "dia chi"],
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

const toIdString = (value) => String(value?._id || value?.id || value || "");
const runQuery = async (query) => {
  if (!query) return query;
  if (typeof query.lean === "function") return query.lean();
  return query;
};
const selectLean = async (query, fields = "") => {
  if (!query) return query;
  let next = query;
  if (fields && typeof next.select === "function") next = next.select(fields);
  if (typeof next.lean === "function") return next.lean();
  return next;
};
const isChatbotEnabled = (restaurant = {}) => restaurant?.aiChatbotSettings?.enabled !== false;
const ELIGIBLE_RESTAURANT_FILTER = {
  businessStatus: "active",
  publicationStatus: "published",
  "aiChatbotSettings.enabled": { $ne: false },
};
const isEligibleRestaurant = (restaurant = {}) => Boolean(
  restaurant &&
  restaurant.businessStatus === "active" &&
  restaurant.publicationStatus === "published" &&
  isChatbotEnabled(restaurant)
);

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
    defaultCurrency: restaurant.defaultCurrency || "VND",
    aiChatbotSettings: restaurant.aiChatbotSettings || {},
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

const getItemRestaurantMeta = (item = {}, fallbackRestaurant = null) => {
  const owner = item.restaurant && typeof item.restaurant === "object" ? item.restaurant : fallbackRestaurant;
  const restaurantId = item.restaurantId ? String(item.restaurantId) : owner ? toIdString(owner) : null;
  return {
    restaurantId: restaurantId || null,
    restaurantName: owner?.name || item.restaurantName || null,
    currency: owner?.defaultCurrency || item.currency || fallbackRestaurant?.defaultCurrency || "VND",
  };
};

const serializeMenuItem = (item, currency = "VND", fallbackRestaurant = null) => {
  const ownerMeta = getItemRestaurantMeta(item, fallbackRestaurant);
  const itemCurrency = ownerMeta.currency || currency || "VND";
  return {
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
    formattedPrice: formatCurrency(item.currentPrice || item.basePrice, itemCurrency),
    currency: itemCurrency,
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
    restaurantId: ownerMeta.restaurantId,
    restaurantName: ownerMeta.restaurantName,
    hasVariants: (Array.isArray(item.variants) && item.variants.length > 0) || (Array.isArray(item.servingVariants) && item.servingVariants.length > 0),
    hasOptions: Array.isArray(item.options) && item.options.length > 0,
    isVegetarian: Boolean(item.isVegetarian),
    isVegan: Boolean(item.isVegan),
    allergens: Array.isArray(item.allergens) ? item.allergens : [],
    calories: item.calories ?? null,
  };
};

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

const serializeCoupon = (coupon, currency = "VND", restaurantLookup = new Map()) => {
  const restaurantId = coupon.restaurantId ? String(coupon.restaurantId) : null;
  const owner = restaurantId ? restaurantLookup.get(restaurantId) : null;
  const couponCurrency = owner?.defaultCurrency || currency || "VND";
  return {
    id: String(coupon._id || coupon.id),
    code: coupon.code,
    name: coupon.name,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderValue: coupon.minOrderValue,
    maxDiscount: coupon.maxDiscount,
    formattedMinOrder: formatCurrency(coupon.minOrderValue, couponCurrency),
    formattedMaxDiscount: coupon.maxDiscount ? formatCurrency(coupon.maxDiscount, couponCurrency) : null,
    endAt: coupon.endAt,
    restaurantId,
    restaurantName: owner?.name || null,
    scope: restaurantId ? "restaurant" : "global",
    currency: couponCurrency,
  };
};

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

// User profile context is built in real time and never cached because it contains
// user-specific identity/role fields that must stay privacy-safe and fresh.
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

const SAFE_FEATURE_ACTION_TYPES = new Set(["link", "search", "handoff", "openCart"]);

const isSafeInternalPath = (path = "") => {
  const value = String(path || "").trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) return false;
  if (/[\u0000-\u001F\u007F]/.test(value)) return false;
  try {
    const parsed = new URL(value, "https://cohan.local");
    return parsed.origin === "https://cohan.local" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
};

const sanitizeFeatureMatches = (featureMatches = [], role = "guest") => (Array.isArray(featureMatches) ? featureMatches : [])
  .slice(0, 12)
  .map((item) => {
    const actionType = String(item?.actionType || "link").slice(0, 40);
    const path = String(item?.path || item?.href || "").trim().slice(0, 240);
    return {
      key: String(item?.key || "").slice(0, 80),
      label: String(item?.label || "").slice(0, 120),
      intent: String(item?.intent || "navigation").slice(0, 80),
      path,
      actionType,
      description: String(item?.description || "").slice(0, 240),
      managerOnly: Boolean(item?.managerOnly),
    };
  })
  .filter((item) => item.key && item.label && SAFE_FEATURE_ACTION_TYPES.has(item.actionType))
  .filter((item) => item.actionType === "openCart" || isSafeInternalPath(item.path))
  .filter((item) => !item.managerOnly || ROLE_MANAGER_LIKE.has(String(role || "").toLowerCase()))
  .slice(0, 6);

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

const buildConversationScopeFilter = ({ userId, guestId, scopeRestaurantObjectId }) => {
  const filter = { status: "open" };
  if (scopeRestaurantObjectId) filter.restaurantId = scopeRestaurantObjectId;
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

// Persisted conversation history is intentionally fetched in real time and never
// cached because AiChatConversation/AiChatMessage data includes guest/user identifiers.
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


const sortRestaurants = (restaurants = []) => [...restaurants].sort((a, b) =>
  Number(b.avgRating || 0) - Number(a.avgRating || 0) ||
  Number(b.reviewCount || 0) - Number(a.reviewCount || 0) ||
  new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
);

const fetchEligibleRestaurantById = async (restaurantId) => {
  const rid = toObjectId(restaurantId);
  if (!rid) return null;
  const restaurant = await selectLean(Restaurant.findById(rid));
  return isEligibleRestaurant(restaurant) ? restaurant : null;
};

const findEligibleRestaurantsByMessage = async (message, limit = 6) => {
  const regex = buildSearchRegex(message);
  const filter = { ...ELIGIBLE_RESTAURANT_FILTER };
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
  const query = Restaurant.find(filter);
  if (typeof query.sort === "function") return query.sort({ avgRating: -1, reviewCount: -1, updatedAt: -1 }).limit(limit).lean();
  const rows = await runQuery(query);
  return sortRestaurants(Array.isArray(rows) ? rows.filter(isEligibleRestaurant) : []).slice(0, limit);
};

const fetchEligibleRestaurantsByIds = async (ids = []) => {
  const uniqueIds = [...new Set(ids.map(String).filter((id) => mongoose.isValidObjectId(id)))];
  if (!uniqueIds.length) return [];
  const objectIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
  const query = Restaurant.find({ ...ELIGIBLE_RESTAURANT_FILTER, _id: { $in: objectIds } });
  const rows = typeof query.lean === "function" ? await query.lean() : await runQuery(query);
  return Array.isArray(rows) ? rows.filter(isEligibleRestaurant) : [];
};

const findVerifiedMenuItemOwner = async (selectedMenuItem = null) => {
  const itemId = selectedMenuItem?.id || selectedMenuItem?.menuItemId;
  const oid = toObjectId(itemId);
  if (!oid) return { menuItem: null, restaurant: null };
  const item = await selectLean(MenuItem.findById ? MenuItem.findById(oid) : null);
  if (!item?.restaurantId) return { menuItem: item || null, restaurant: null };
  const restaurant = await fetchEligibleRestaurantById(item.restaurantId);
  return restaurant ? { menuItem: item, restaurant } : { menuItem: item, restaurant: null };
};

const candidateDto = (restaurant, reason = "candidate") => ({
  restaurantId: toIdString(restaurant),
  restaurantName: String(restaurant?.name || "Nhà hàng"),
  reason,
});

const resolveRestaurantScope = async ({ restaurantId, message, pageContext, user }) => {
  const currentPage = normalizePageContext(pageContext, restaurantId, user);
  const directCandidate = restaurantId || currentPage.restaurantId;
  if (directCandidate) {
    const restaurant = await fetchEligibleRestaurantById(directCandidate);
    if (!restaurant) {
      return { mode: "global", restaurantId: null, restaurant: null, reason: "unavailable", candidates: [], isResolved: false, currentPage };
    }
    return { mode: "restaurant", restaurantId: toIdString(restaurant), restaurant, reason: restaurantId ? "inputRestaurantId" : "pageContextRestaurantId", candidates: [candidateDto(restaurant, "resolved")], isResolved: true, currentPage: { ...currentPage, restaurantId: toIdString(restaurant) } };
  }

  const verifiedSelection = await findVerifiedMenuItemOwner(currentPage.selectedMenuItem);
  if (verifiedSelection.restaurant) {
    const restaurant = verifiedSelection.restaurant;
    return { mode: "restaurant", restaurantId: toIdString(restaurant), restaurant, reason: "verifiedSelectedMenuItem", candidates: [candidateDto(restaurant, "selectedMenuItem")], isResolved: true, currentPage: { ...currentPage, restaurantId: toIdString(restaurant), selectedMenuItem: { ...currentPage.selectedMenuItem, restaurantId: toIdString(restaurant) } } };
  }

  const restaurantMatches = await findEligibleRestaurantsByMessage(message, 6);
  if (restaurantMatches.length === 1) {
    const restaurant = restaurantMatches[0];
    return { mode: "restaurant", restaurantId: toIdString(restaurant), restaurant, reason: "uniqueRestaurantName", candidates: [candidateDto(restaurant, "uniqueName")], isResolved: true, currentPage: { ...currentPage, restaurantId: toIdString(restaurant) } };
  }
  return { mode: "global", restaurantId: null, restaurant: null, reason: restaurantMatches.length > 1 ? "ambiguousRestaurantName" : "global", candidates: restaurantMatches.map((r) => candidateDto(r, "nameMatch")), isResolved: false, currentPage: { ...currentPage, restaurantId: null } };
};

const fetchRestaurants = async ({ scope, message }) => {
  if (scope?.mode === "restaurant" && scope.restaurant) return [scope.restaurant];
  const candidates = await findEligibleRestaurantsByMessage(message, 4);
  return candidates;
};

const fetchMenuItems = async ({ scope, message, limit = 8, perRestaurantLimit = 3 }) => {
  const regex = buildSearchRegex(message);
  const filter = { status: "available" };
  if (scope?.mode === "restaurant" && scope.restaurantId) {
    filter.restaurantId = toObjectId(scope.restaurantId);
  }
  if (regex) {
    filter.$or = [
      { name: regex },
      { description: regex },
      { labels: regex },
      { code: regex },
    ];
  }
  let items = [];
  const query = MenuItem.find(filter);
  if (typeof query.sort === "function") items = await query.sort({ orderCounter: -1, rate: -1, sortOrder: 1 }).limit(Math.max(limit * 3, limit)).lean();
  else items = await runQuery(query);
  items = Array.isArray(items) ? items : [];

  if (!items.length && scope?.mode === "restaurant" && scope.restaurantId) {
    const fallbackQuery = MenuItem.find({ restaurantId: toObjectId(scope.restaurantId), status: "available" });
    items = typeof fallbackQuery.sort === "function"
      ? await fallbackQuery.sort({ orderCounter: -1, rate: -1, sortOrder: 1 }).limit(limit).lean()
      : await runQuery(fallbackQuery);
    items = Array.isArray(items) ? items : [];
  }

  if (scope?.mode === "restaurant") return items.slice(0, limit).map((item) => ({ ...item, restaurant: scope.restaurant }));

  const ownerIds = items.map((item) => item.restaurantId).filter(Boolean).map(String);
  const owners = await fetchEligibleRestaurantsByIds(ownerIds);
  const ownerMap = new Map(owners.map((r) => [toIdString(r), r]));
  const counts = new Map();
  const output = [];
  for (const item of items) {
    const rid = String(item.restaurantId || "");
    const owner = ownerMap.get(rid);
    if (!owner) continue;
    const count = counts.get(rid) || 0;
    if (count >= perRestaurantLimit) continue;
    counts.set(rid, count + 1);
    output.push({ ...item, restaurant: owner });
    if (output.length >= limit) break;
  }
  return output;
};

const fetchCoupons = async ({ scope, eligibleRestaurants = [] }) => {
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
  } else {
    const eligibleIds = eligibleRestaurants.map((r) => toObjectId(r?._id || r?.id)).filter(Boolean);
    filter.$or = [{ restaurantId: null }, ...(eligibleIds.length ? [{ restaurantId: { $in: eligibleIds } }] : [])];
  }
  const query = Coupon.find(filter);
  if (typeof query.sort === "function") return query.sort({ discountValue: -1, endAt: 1, updatedAt: -1 }).limit(6).lean();
  const rows = await runQuery(query);
  return Array.isArray(rows) ? rows : [];
};

// Phase 26 deliberately does not cache order/cart/reservation/profile context:
// these records are user-specific, privacy-sensitive, and must remain fresh per request.
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
    const scoreText = Number.isFinite(Number(item?._score)) ? ` | score: ${Number(item._score).toFixed(3)}` : "";
    const row = `- title: ${item.title || ""} | sourceType: ${item.sourceType || "manual"} | category: ${item.category || "N/A"}${scoreText} | tags: ${Array.isArray(item.tags) ? item.tags.join(", ") : ""}
${String(item.content || "").slice(0, 500)}`.trim();
    if (!row) continue;
    if (used + row.length > MAX_KNOWLEDGE_CHARS) break;
    lines.push(row);
    used += row.length;
  }
  return lines;
};

const buildContext = async ({ message, user, pageContext = {}, scope }) => {
  const intent = classifyIntent(message);
  const menuPreferences = extractMenuPreferences(message);
  const isMenuAssistant = isMenuAssistantRequest(message, intent, menuPreferences);
  const currentPage = scope?.currentPage || normalizePageContext(pageContext, scope?.restaurantId, user);
  const restaurants = await fetchRestaurants({ scope, message });
  const restaurantLookup = new Map(restaurants.map((r) => [toIdString(r), r]));
  const [menuItems, coupons, orders, reservations, cart] = await Promise.all([
    fetchMenuItems({ scope, message, limit: isMenuAssistant ? 30 : 8 }),
    fetchCoupons({ scope, eligibleRestaurants: restaurants }),
    fetchOrders({ restaurantId: scope?.restaurantId, message, user }),
    fetchReservations({ restaurantId: scope?.restaurantId, message, user }),
    fetchCart({ user }),
  ]);

  for (const item of menuItems || []) {
    if (item?.restaurant) restaurantLookup.set(toIdString(item.restaurant), item.restaurant);
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
    scopeCandidates: Array.isArray(scope?.candidates) ? scope.candidates : [],
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
    coupons: coupons.map((coupon) => serializeCoupon(coupon, scope?.restaurant?.defaultCurrency || "VND", restaurantLookup)).slice(0, 3),
    orders: orders.map((order) => serializeOrder(order, scope?.restaurant?.defaultCurrency || "VND")),
    reservations: reservations.map((reservation) => serializeReservation(reservation, scope?.restaurant?.defaultCurrency || "VND")),
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
    restaurantId: item.restaurantId || null,
    restaurantName: item.restaurantName || null,
    currency: item.currency || null,
    basePrice: item.basePrice,
    currentPrice: item.currentPrice,
    price: item.currentPrice ?? item.basePrice,
  };
};

const isForbiddenAction = (action = {}) => {
  const text = `${action?.type || ""} ${action?.label || ""} ${action?.href || ""} ${action?.description || ""}`.toLowerCase();
  return /payment|auto[-_ ]?submit|place[-_ ]?order|reserve[-_ ]?table|delete|destroy|destructive|add_to_cart_candidate|add-to-cart|addtocart/.test(text);
};

const normalizeActionPriority = (priority) => {
  const value = Number(priority);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 50;
};

const normalizeAiAction = (action, allowedItemIds = new Set()) => {
  if (!action || isForbiddenAction(action)) return null;
  const type = String(action.type || "link").trim();
  if (!["link", "handoff", "search", "openCart"].includes(type)) return null;
  const href = String(action.href || "").trim();
  if ((type === "link" || type === "search") && !href) return null;
  if (type === "openCart" && href && href !== "/cart") return null;
  if (type === "handoff" && href && href !== "/contact") return null;
  if (/^(?:javascript|data|mailto|tel):/i.test(href) || href.startsWith("//")) return null;
  if (type !== "search" && href && href.startsWith("/") && !isSafeInternalPath(href)) return null;
  if (type !== "search" && href && !href.startsWith("/") && !/^https?:\/\//i.test(href)) return null;
  if (href.startsWith("/food/")) {
    const itemId = href.replace("/food/", "").split(/[/?#]/)[0];
    if (allowedItemIds.size && !allowedItemIds.has(itemId)) return null;
  }
  const label = String(action.label || "").trim().slice(0, 80) || (type === "openCart" ? "Mở giỏ hàng" : type === "handoff" ? "Gặp nhân viên" : "Mở liên kết");
  return {
    type,
    label,
    href: type === "openCart" ? "" : href,
    description: String(action.description || "").trim().slice(0, 180) || null,
    icon: String(action.icon || "").trim().slice(0, 40) || null,
    priority: normalizeActionPriority(action.priority),
  };
};

const actionKey = (action) => (action?.type === "openCart" || action?.href ? `${action?.type || ""}:${action?.href || ""}` : `${action?.type || ""}:${String(action?.label || "").toLowerCase()}`);

const mergeAiActions = (deterministic = [], provider = [], context = {}, limit = 6) => {
  const allowedItemIds = new Set([...(context.recommendedMenuItems || []), ...(context.menuItems || [])].map((x) => String(x.id)));
  const seen = new Set();
  const output = [];
  for (const action of [...deterministic, ...provider]) {
    const normalized = normalizeAiAction(action, allowedItemIds);
    if (!normalized) continue;
    const key = actionKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
};

const pushAction = (actions, action) => {
  if (action) actions.push(action);
};

const buildDeterministicActions = (context = {}) => {
  const actions = [];
  const role = String(context.userSafeProfile?.role || context.user?.role || "guest").toLowerCase();
  const isLoggedIn = Boolean(context.userSafeProfile?.authenticated || context.user?.authenticated);
  const restaurantId = context.scopeMode === "restaurant" ? context.resolvedRestaurantId : null;
  const items = (context.recommendedMenuItems?.length ? context.recommendedMenuItems : context.menuItems) || [];

  for (const entry of context.matchedFeatureMapEntries || []) {
    if (entry.managerOnly && !ROLE_MANAGER_LIKE.has(role)) continue;
    pushAction(actions, {
      type: entry.actionType === "openCart" || entry.key === "cart" ? "openCart" : entry.actionType,
      label: entry.label,
      href: entry.actionType === "openCart" ? "" : entry.path,
      description: entry.description,
      icon: entry.key,
      priority: 5,
    });
  }

  if (["cart", "checkout"].includes(context.intent)) {
    pushAction(actions, { type: "openCart", label: context.intent === "checkout" ? "Mở giỏ hàng" : "Giỏ hàng của tôi", href: "", description: "Kiểm tra món, số lượng và ghi chú trước khi xác nhận.", icon: "cart", priority: 1 });
    pushAction(actions, { type: "link", label: "Xem menu", href: "/cus-menu", description: "Chọn món qua trang menu hiện có.", icon: "menu", priority: 2 });
    if (!isLoggedIn) pushAction(actions, { type: "link", label: "Đăng nhập", href: "/login", description: "Đăng nhập để xem giỏ/đơn hàng đã lưu của tài khoản.", icon: "login", priority: 3 });
    if (context.intent === "checkout" && isLoggedIn && Number(context.cartSummary?.totalQuantity || 0) > 0) {
      pushAction(actions, { type: "link", label: "Đi tới thanh toán", href: "/checkout", description: "Mở luồng checkout hiện có; bạn vẫn cần tự xác nhận.", icon: "checkout", priority: 3 });
    }
  }

  if (context.intent === "reservationHelp") {
    if (restaurantId) pushAction(actions, { type: "link", label: "Mở trang đặt bàn", href: `/restaurant/${restaurantId}/layout`, description: "Chọn ngày giờ, số người và bàn trong luồng đặt bàn hiện có.", icon: "table", priority: 1 });
    else pushAction(actions, { type: "link", label: "Chọn nhà hàng", href: "/restaurants", description: "Chọn nhà hàng trước khi xem sơ đồ bàn.", icon: "restaurant", priority: 1 });
    pushAction(actions, { type: "link", label: "Xem menu", href: "/cus-menu", description: "Tham khảo món trước khi đặt bàn.", icon: "menu", priority: 4 });
  }

  if (context.intent === "orderHelp" && isLoggedIn) pushAction(actions, { type: "link", label: "Đơn hàng của tôi", href: "/orders", description: "Xem đơn hàng của chính tài khoản hiện tại.", icon: "orders", priority: 1 });
  if (["profileHelp", "identity"].includes(context.intent) && isLoggedIn) pushAction(actions, { type: "link", label: "Hồ sơ của tôi", href: "/profile", description: "Mở hồ sơ tài khoản trong app.", icon: "profile", priority: 1 });

  if (context.intent === "menu") {
    pushAction(actions, { type: "link", label: "Xem menu", href: "/cus-menu", description: "Mở trang menu khách hàng.", icon: "menu", priority: 1 });
    for (const item of items.slice(0, 3)) {
      pushAction(actions, { type: "link", label: `Xem ${item.name || "món gợi ý"}`.slice(0, 80), href: `/food/${item.id}`, description: item.formattedPrice ? `Món trong dữ liệu hiện có: ${item.formattedPrice}` : "Mở chi tiết món trong app.", icon: "food", priority: 2 });
    }
  }

  if (context.intent === "managerFeatureHelp" && ROLE_MANAGER_LIKE.has(role)) {
    pushAction(actions, { type: "link", label: "Mở dashboard quản lý", href: "/manager", description: "Truy cập khu vực quản lý theo quyền hiện có.", icon: "manager", priority: 1 });
    pushAction(actions, { type: "link", label: "Đơn hàng quản lý", href: "/manager#orders", description: "Mở khu vực đơn hàng trong dashboard.", icon: "orders", priority: 2 });
  }

  if (context.intent === "support" && context.scopeMode === "restaurant") pushAction(actions, { type: "handoff", label: "Gặp nhân viên", href: "/contact", description: "Gửi yêu cầu để nhân viên hỗ trợ trong luồng handoff hiện có.", icon: "support", priority: 1 });
  if (context.intent === "support" && context.scopeMode !== "restaurant") pushAction(actions, { type: "link", label: "Chọn nhà hàng", href: "/restaurants", description: "Chọn nhà hàng trước khi gặp nhân viên.", icon: "restaurant", priority: 1 });

  if (isLoggedIn && ["identity", "profileHelp", "navigation"].includes(context.intent)) {
    pushAction(actions, { type: "openCart", label: "Giỏ hàng của tôi", href: "", description: "Mở giỏ hàng hiện tại.", icon: "cart", priority: 4 });
    pushAction(actions, { type: "link", label: "Đơn hàng của tôi", href: "/orders", description: "Xem đơn hàng của tài khoản hiện tại.", icon: "orders", priority: 5 });
  }

  return mergeAiActions(actions.sort((a, b) => normalizeActionPriority(a.priority) - normalizeActionPriority(b.priority)), [], context, 6);
};

const normalizeAiResult = (parsed, context) => {
  const providerActions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  const actions = mergeAiActions(buildDeterministicActions(context), providerActions, context, 6);
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
  scopeMode: context.scopeMode || "global",
  resolvedRestaurantId: context.resolvedRestaurantId || null,
  scopeCandidates: context.scopeCandidates?.slice(0, 4) || [],
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
    "Bạn là AI App Assistant for Cohan Restaurant App, hỗ trợ nhà hàng, menu, đặt món, đặt bàn, hồ sơ, đơn hàng và điều hướng trong ứng dụng.",
    "Trả lời tiếng Việt, thân thiện, ngắn gọn, đúng nghiệp vụ nhà hàng.",
    "Không bịa món, giá, trạng thái món, coupon, chính sách, số điện thoại, thông tin cá nhân hoặc chính sách nhà hàng.",
    "Chỉ sử dụng userSafeProfile đã được làm sạch: displayName, email hiển thị, role/userType; không yêu cầu hoặc tiết lộ mật khẩu, token, secret, API key, internal id.",
    "Chỉ trả lời đơn hàng/đặt bàn trong CONTEXT.orders và CONTEXT.reservations vì đó là dữ liệu thuộc người dùng hiện tại.",
    "Từ chối dữ liệu người dùng khác và dữ liệu quản lý nếu userSafeProfile.role không phải manager/admin.",
    "Chỉ dùng dữ liệu trong CONTEXT để nói về món ăn, đơn hàng, đặt bàn, coupon hoặc thông tin nhà hàng. Nếu thiếu dữ liệu, hãy nói rõ và gợi ý bước tiếp theo.",
    "Chỉ recommend món có trong CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems.",
    "Nếu có RESTAURANT_KNOWLEDGE thì ưu tiên thông tin đó hơn suy đoán chung.",
    "Chỉ trả lời từ CONTEXT và RESTAURANT_KNOWLEDGE; nếu thiếu dữ liệu, nói chưa rõ và gợi ý liên hệ nhân viên.",
    "Không bịa chính sách, menu, đơn hàng; không tiết lộ trường riêng tư hoặc internal id.",
    "Không tạo đơn hàng, thanh toán, đặt bàn hoặc cập nhật hồ sơ; chỉ hướng dẫn người dùng tự thao tác trong app.",
    "Nếu khách hỏi món không có trong context, nói không thấy trong dữ liệu hiện tại.",
    "Không đưa lời khuyên y tế chắc chắn; nếu khách dị ứng hãy nhắc xác nhận với nhân viên.",
    "Không tự đặt món/thanh toán; không tạo action checkout/payment/add_to_cart_candidate.",
    "Trả về JSON hợp lệ đúng schema: {\"answer\": string, \"intent\": string, \"confidence\": number, \"quickReplies\": string[], \"actions\": [{\"type\":\"link|handoff|search|openCart\",\"label\": string, \"href\": string, \"description\": string, \"icon\": string, \"priority\": number}], \"sources\": [{\"type\": string, \"id\": string, \"label\": string}] }.",
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

const callLocal = async ({ message, context, history, knowledgeItems = [] }) => {
  const knowledgeLines = buildKnowledgePrompt(knowledgeItems);
  const systemInstruction = [
    "Bạn là AI App Assistant for Cohan Restaurant App, hỗ trợ nhà hàng, menu, đặt món, đặt bàn, hồ sơ, đơn hàng và điều hướng trong ứng dụng.",
    "Trả lời tiếng Việt, thân thiện, ngắn gọn, đúng nghiệp vụ nhà hàng.",
    "Chỉ trả lời từ CONTEXT và RESTAURANT_KNOWLEDGE; nếu thiếu dữ liệu, nói chưa rõ và gợi ý liên hệ nhân viên.",
    "Không bịa món, giá, trạng thái món, coupon, chính sách, số điện thoại, thông tin cá nhân hoặc chính sách nhà hàng.",
    "Chỉ sử dụng userSafeProfile đã được làm sạch; không yêu cầu hoặc tiết lộ mật khẩu, token, secret, API key, internal id.",
    "Chỉ trả lời đơn hàng/đặt bàn trong CONTEXT.orders và CONTEXT.reservations vì đó là dữ liệu thuộc người dùng hiện tại.",
    "Không tạo đơn hàng, thanh toán, đặt bàn hoặc cập nhật hồ sơ; không tạo action checkout/payment/add_to_cart_candidate.",
    "Trả về JSON hợp lệ đúng schema: {\"answer\": string, \"intent\": string, \"confidence\": number, \"quickReplies\": string[], \"actions\": [{\"type\":\"link|handoff|search|openCart\",\"label\": string, \"href\": string, \"description\": string, \"icon\": string, \"priority\": number}], \"sources\": [{\"type\": string, \"id\": string, \"label\": string}] }.",
    "Không dùng markdown code fence; chỉ trả JSON, không thêm giải thích ngoài JSON.",
    `CONTEXT: ${JSON.stringify(buildProviderPromptContext(context))}`,
    knowledgeLines.length ? `RESTAURANT_KNOWLEDGE:\n${knowledgeLines.join("\n\n")}` : "",
  ].join("\n");
  const result = await callLocalChatProvider({
    systemInstruction,
    messages: [...recentHistoryForPrompt(history), { role: "user", content: message }],
    temperature: 0.25,
    maxTokens: 800,
  });
  const parsed = safeJsonParse(result?.content);
  return parsed ? normalizeAiResult(parsed, context) : null;
};

const normalizeProviderName = (value) => String(value || "").trim().toLowerCase();
const uniqueProviders = (providers) => {
  const out = [];
  for (const provider of providers.map(normalizeProviderName).filter(Boolean)) {
    if (["gemini", "openai", "local"].includes(provider) && !out.includes(provider)) out.push(provider);
  }
  return out;
};

const callAiProvider = async (args) => {
  const primary = normalizeProviderName(args?.provider || process.env.AI_PROVIDER || "openai");
  const configuredFallback = normalizeProviderName(process.env.AI_FALLBACK_PROVIDER || "");
  const providers = uniqueProviders([
    primary,
    configuredFallback,
    !configuredFallback && primary === "gemini" ? "openai" : "",
  ]);
  for (const provider of providers.length ? providers : ["openai"]) {
    let result = null;
    if (provider === "gemini") result = await callGemini(args);
    else if (provider === "local") result = await callLocal(args);
    else result = await callOpenAI(args);
    if (result) return result;
  }
  return fallbackAnswer(args.context || {});
};

const callOpenAI = async ({ message, context, history, knowledgeItems = [] }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.AI_CHATBOT_MODEL || process.env.AI_MODEL || "gpt-5";
  const knowledgeLines = buildKnowledgePrompt(knowledgeItems);
  const prompt = [
    "Bạn là AI App Assistant for Cohan Restaurant App, hỗ trợ nhà hàng, menu, đặt món, đặt bàn, hồ sơ, đơn hàng và điều hướng trong ứng dụng.",
    "Trả lời tiếng Việt, thân thiện, ngắn gọn, đúng nghiệp vụ nhà hàng.",
    "Không bịa món, giá, trạng thái món, coupon, chính sách, số điện thoại, thông tin cá nhân hoặc chính sách nhà hàng.",
    "Chỉ sử dụng userSafeProfile đã được làm sạch: displayName, email hiển thị, role/userType; không yêu cầu hoặc tiết lộ mật khẩu, token, secret, API key, internal id.",
    "Chỉ trả lời đơn hàng/đặt bàn trong CONTEXT.orders và CONTEXT.reservations vì đó là dữ liệu thuộc người dùng hiện tại.",
    "Từ chối dữ liệu người dùng khác và dữ liệu quản lý nếu userSafeProfile.role không phải manager/admin.",
    "Chỉ dùng dữ liệu trong CONTEXT để nói về món ăn, đơn hàng, đặt bàn, coupon hoặc thông tin nhà hàng. Nếu thiếu dữ liệu, hãy nói rõ và gợi ý bước tiếp theo.",
    "Chỉ recommend món có trong CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems.",
    "Nếu có RESTAURANT_KNOWLEDGE thì ưu tiên thông tin đó hơn suy đoán chung.",
    "Chỉ trả lời từ CONTEXT và RESTAURANT_KNOWLEDGE; nếu thiếu dữ liệu, nói chưa rõ và gợi ý liên hệ nhân viên.",
    "Không bịa chính sách, menu, đơn hàng; không tiết lộ trường riêng tư hoặc internal id.",
    "Không tạo đơn hàng, thanh toán, đặt bàn hoặc cập nhật hồ sơ; chỉ hướng dẫn người dùng tự thao tác trong app.",
    "Nếu khách hỏi món không có trong context, nói không thấy trong dữ liệu hiện tại.",
    "Không đưa lời khuyên y tế chắc chắn; nếu khách dị ứng hãy nhắc xác nhận với nhân viên.",
    "Không tự đặt món/thanh toán; không tạo action checkout/payment/add_to_cart_candidate.",
    "Trả về JSON hợp lệ đúng schema: {\"answer\": string, \"intent\": string, \"confidence\": number, \"quickReplies\": string[], \"actions\": [{\"type\":\"link|handoff|search|openCart\",\"label\": string, \"href\": string, \"description\": string, \"icon\": string, \"priority\": number}], \"sources\": [{\"type\": string, \"id\": string, \"label\": string}] }.",
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
    restaurantInfo: ["Giờ mở cửa", "Địa chỉ nhà hàng", "Gợi ý món"],
  };
  return byIntent[intent] || ["Gợi ý món ngon", "Cách đặt bàn", "Kiểm tra đơn hàng"];
};

const fallbackActions = (context) => {
  const restaurantId = context.scopeMode === "restaurant" ? context.resolvedRestaurantId : null;
  const topItemId = context.currentPage?.selectedMenuItem?.id || context.recommendedMenuItems?.[0]?.id || context.menuItems?.[0]?.id;
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
  if (context.intent === "restaurantInfo") actions.push({ type: "link", label: restaurantId ? "Xem nhà hàng" : "Chọn nhà hàng", href: restaurantId ? `/restaurant/${restaurantId}` : "/restaurants" });
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
  ...((context.recommendedMenuItems?.length ? context.recommendedMenuItems : context.menuItems) || []).slice(0, 5).map((item) => ({ type: "menuItem", id: item.id, label: item.name, formattedPrice: item.formattedPrice, status: item.status, isAvailable: item.isAvailable, hasOptions: Boolean(item.options?.length), hasVariants: Boolean(item.variants?.length || item.servingVariants?.length || item.hasVariants), servingVariants: Array.isArray(item.servingVariants) ? item.servingVariants : [], restaurantId: item.restaurantId || null, restaurantName: item.restaurantName || null, currency: item.currency || null, basePrice: item.basePrice, currentPrice: item.currentPrice, price: item.currentPrice ?? item.basePrice })),
  ...(context.coupons || []).slice(0, 2).map((item) => ({ type: "coupon", id: item.id, label: item.restaurantName ? `${item.code} (${item.restaurantName})` : item.code, restaurantId: item.restaurantId || null, restaurantName: item.restaurantName || null })),
];

const menuFallback = (context) => {
  const items = context.recommendedMenuItems?.length ? context.recommendedMenuItems : (context.menuItems || []);
  if (!items.length) {
    return "Hiện mình chưa tìm thấy món phù hợp trong dữ liệu menu. Bạn có thể thử hỏi theo tên món, loại món hoặc mở trang nhà hàng để xem đầy đủ menu.";
  }
  const lines = items.slice(0, 5).map((item, index) => {
    const rating = Number(item.rate || 0) > 0 ? `, đánh giá ${item.rate}/5` : "";
    const owner = item.restaurantName ? ` tại ${item.restaurantName}` : "";
    return `${index + 1}. ${item.name}${owner} - ${item.formattedPrice}${rating} (${item.recommendationReason || "dựa trên dữ liệu hiện có"})`;
  });
  return `Mình chỉ thấy các món sau trong dữ liệu hiện có:\n${lines.join("\n")}\nBạn muốn lọc theo ngân sách, món chay hay món ra nhanh không?`;
};

const orderingWorkflowFallback = () => [
  "Bạn có thể đặt món theo các bước:",
  "1. Chọn nhà hàng hoặc mở menu của nhà hàng.",
  "2. Chọn món muốn đặt.",
  "3. Chọn khẩu phần/tùy chọn nếu món có biến thể.",
  "4. Bấm thêm vào giỏ hàng.",
  "5. Mở giỏ hàng.",
  "6. Kiểm tra số lượng, ghi chú và giá tạm tính.",
  "7. Thanh toán/xác nhận đơn khi thông tin đã đúng.",
].join("\n");

const reservationFallback = (context) => {
  const reservation = context.reservations?.[0];
  if (context.userSafeProfile?.authenticated && reservation) {
    return `Đặt bàn ${reservation.orderCode || "gần nhất"} tại ${reservation.restaurantName || context.restaurants?.[0]?.name || "nhà hàng"} cho ${reservation.partySize || "nhiều"} người hiện ở trạng thái ${reservation.status || "đang xử lý"}.${reservation.timeTo ? ` Thời gian: ${new Date(reservation.timeTo).toLocaleString("vi-VN")}.` : ""} Bạn có thể theo dõi trạng thái trong mục đặt bàn/đơn đặt chỗ.`;
  }
  const restaurant = context.scopeMode === "restaurant" ? context.restaurants?.[0] : null;
  const prefix = restaurant ? `${restaurant.name}: ` : "Bạn hãy chọn nhà hàng trước. ";
  return `${prefix}Bạn có thể đặt bàn theo các bước:
1. Chọn nhà hàng.
2. Vào khu vực đặt bàn/sơ đồ bàn.
3. Chọn ngày giờ.
4. Chọn số người.
5. Chọn bàn/phòng nếu có.
6. Xác nhận đặt bàn.
7. Theo dõi trạng thái trong mục đặt bàn/đơn đặt chỗ.`;
};

const orderFallback = (context) => {
  if (!context.userSafeProfile?.authenticated) return "Bạn hiện là khách. Vui lòng đăng nhập bằng tài khoản đã đặt đơn để mình kiểm tra đơn hàng thuộc về bạn.";
  const order = context.orders?.[0];
  if (!order) return "Mình chưa tìm thấy đơn hàng phù hợp trong dữ liệu của bạn. Bạn hãy gửi mã đơn/mã theo dõi hoặc kiểm tra lại tài khoản đã đặt đơn.";
  const eta = order.estimatedDeliveryAt || order.estimatedReadyAt;
  return `Đơn ${order.orderCode} hiện ở trạng thái ${order.publicStatus || order.currentStatus || "đang xử lý"}. Thanh toán: ${order.paymentStatus || "chưa rõ"}. Tổng tiền: ${order.formattedTotal}.${eta ? ` Dự kiến: ${new Date(eta).toLocaleString("vi-VN")}.` : ""}`;
};

const promotionFallback = (context) => {
  const coupons = context.coupons || [];
  if (!coupons.length) return "Hiện mình chưa thấy coupon đang hoạt động phù hợp. Bạn có thể kiểm tra lại trong trang coupon của nhà hàng hoặc hỏi mình gợi ý combo/menu tiết kiệm.";
  const lines = coupons.slice(0, 4).map((coupon) => {
    const value = coupon.discountType === "AMOUNT" ? formatCurrency(coupon.discountValue) : `${coupon.discountValue}%`;
    const scope = coupon.restaurantName ? ` tại ${coupon.restaurantName}` : " trên hệ thống";
    return `- ${coupon.code}${scope}: ${coupon.name} giảm ${value}${coupon.minOrderValue ? `, đơn tối thiểu ${coupon.formattedMinOrder}` : ""}`;
  });
  return `Các ưu đãi có thể dùng:\n${lines.join("\n")}`;
};



const restaurantInfoFallback = (context) => {
  const restaurant = context.scopeMode === "restaurant" ? context.restaurants?.[0] : null;
  if (!restaurant) return "Mình chưa thấy nhà hàng cụ thể trong ngữ cảnh. Bạn có thể chọn nhà hàng rồi hỏi lại giờ mở cửa, địa chỉ hoặc trạng thái nhận đơn.";
  const hours = restaurant.openingHours || restaurant.closingHours
    ? `Giờ mở cửa: ${restaurant.openingHours || "chưa rõ"} - ${restaurant.closingHours || "chưa rõ"}.`
    : "Mình chưa thấy giờ mở cửa trong dữ liệu hiện có.";
  const status = restaurant.operationalStatus ? ` Trạng thái: ${restaurant.operationalStatus}.` : "";
  const address = restaurant.address ? ` Địa chỉ: ${restaurant.address}.` : "";
  return `${restaurant.name}: ${hours}${status}${address}`;
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
  if (context.intent === "checkout") return orderingWorkflowFallback(context);
  if (context.intent === "cart") {
    if (!context.userSafeProfile?.authenticated) return "Bạn hiện là khách. Hãy đăng nhập nếu muốn mình kiểm tra giỏ hàng đã lưu; bạn vẫn có thể mở giỏ hàng trên giao diện để xem các món trong phiên hiện tại.";
    const cart = context.cartSummary;
    if (cart?.totalQuantity) return `Giỏ hàng của bạn có ${cart.totalQuantity} món, tạm tính ${cart.formattedTotal}. Bạn có thể mở giỏ để kiểm tra số lượng, ghi chú rồi thanh toán/xác nhận đơn.`;
    return "Giỏ hàng hiện chưa có món nào trong dữ liệu mình thấy. Bạn có thể mở menu, chọn món rồi thêm vào giỏ.";
  }
  const entries = context.matchedFeatureMapEntries || [];
  if (entries.length) {
    const lines = entries.slice(0, 3).map((entry) => `- ${entry.label}: ${entry.path || "mở bằng nút trong giao diện"}`).join("\n");
    return `Bạn có thể mở các mục sau trong ứng dụng:\n${lines}`;
  }
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
  const asksManagerData = /(doanh thu|revenue|hiệu suất nhân viên|hieu suat nhan vien|lương|luong|payroll|tồn kho|ton kho|inventory|kpi|báo cáo quản lý|bao cao quan ly)/.test(raw);
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
    support: () => "Mình có thể hỗ trợ nhanh về menu, đặt bàn, đơn hàng, coupon. Nếu cần người thật xử lý, bạn có thể bấm Gặp nhân viên để người thật hỗ trợ trực tiếp.",
    restaurantInfo: restaurantInfoFallback,
    general: () => "Chào bạn, mình là trợ lý A.I của Cohan Restaurant App. Bạn có thể hỏi mình về món ăn, đặt bàn, đơn hàng, coupon hoặc cách sử dụng hệ thống.",
  };
  return {
    answer: (answerByIntent[intent] || answerByIntent.general)(context),
    intent,
    confidence: intent === "general" ? 0.55 : 0.72,
    quickReplies: fallbackQuickReplies(intent),
    actions: buildDeterministicActions(context),
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
  const normalizedGuestId = normalizeGuestId(guestId);
  const normalizedConversationId = normalizeConversationId(conversationId);
  const scope = await resolveRestaurantScope({ restaurantId, message: cleanMessage, pageContext, user });
  const scopeRestaurantObjectId = toObjectId(scope.restaurantId);
  if (scope.reason === "unavailable") {
    return {
      answer: "Nhà hàng này hiện chưa khả dụng. Bạn có thể chọn nhà hàng khác đang hiển thị công khai trên hệ thống.",
      intent: "general",
      confidence: 1,
      quickReplies: [],
      actions: [{ type: "link", label: "Chọn nhà hàng", href: "/restaurants", description: "Xem các nhà hàng đang khả dụng.", icon: "restaurant", priority: 1 }],
      sources: [],
      contextSummary: { restaurantCount: 0, menuItemCount: 0, couponCount: 0, orderCount: 0, reservationCount: 0 },
      conversationId: null,
      answerMessageId: null,
      isFallback: true,
      handoffSuggested: false,
      handoffReason: null,
      handoffMessage: null,
      scopeMode: "global",
      resolvedRestaurantId: null,
      scopeCandidates: [],
    };
  }
  let aiSettings = mergeWithDefaultAiChatbotSettings(scope.restaurant?.aiChatbotSettings || {});
  if (scope.mode !== "restaurant") {
    aiSettings = { ...aiSettings, handoffEnabled: false };
  }

  const askRateResult = consumeAiChatbotRateLimit({
    policy: AI_CHATBOT_RATE_LIMIT_POLICIES.askAiChatbot,
    keyParts: {
      guestId: normalizedGuestId,
      conversationId: normalizedConversationId || "",
      restaurantId: String(scope.restaurantId || restaurantId || ""),
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
          String(found.restaurantId || "") === String(scopeRestaurantObjectId || "") ||
          (!found.restaurantId && !scopeRestaurantObjectId);
        if (sameRestaurant) persistedConversation = found;
      }
    }

    if (!persistedConversation) {
      const scopeFilter = buildConversationScopeFilter({
        userId: userObjectId,
        guestId: normalizedGuestId,
        scopeRestaurantObjectId,
      });
      if (scopeFilter) persistedConversation = await AiChatConversation.findOne(scopeFilter).sort({ updatedAt: -1 });
    }

    if (!persistedConversation && (userObjectId || normalizedGuestId)) {
      persistedConversation = await AiChatConversation.create({
        restaurantId: scopeRestaurantObjectId,
        userId: userObjectId,
        guestId: normalizedGuestId || null,
      });
    }

    if (persistedConversation) {
      persistedHistory = await fetchPersistedHistoryForPrompt(persistedConversation._id);

      await AiChatMessage.create({
        conversationId: persistedConversation._id,
        restaurantId: scopeRestaurantObjectId,
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

  const safetyEval = await evaluateRestaurantAiChatbotSafety({ restaurantId: scope.restaurantId, message: cleanMessage });
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
      scopeMode: scope.mode,
      resolvedRestaurantId: scope.restaurantId,
      scopeCandidates: scope.candidates || [],
    };
  }

  const context = await buildContext({ message: cleanMessage, user, pageContext, scope });
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
      scopeMode: context.scopeMode,
      resolvedRestaurantId: context.resolvedRestaurantId,
      scopeCandidates: context.scopeCandidates || [],
    };
  }
  const knowledgeItems = await findRelevantKnowledgeForChatbot({ restaurantId: scope.restaurantId, message: cleanMessage, limit: 4 });
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
    scopeMode: context.scopeMode,
    resolvedRestaurantId: context.resolvedRestaurantId,
    scopeCandidates: context.scopeCandidates || [],
  };
  const handoffDecision = shouldSuggestHandoff({
    message: cleanMessage,
    intent: finalResponse.intent,
    confidence: finalResponse.confidence,
    isFallback: finalResponse.isFallback,
    threshold: aiSettings.lowConfidenceHandoffThreshold,
  });
  finalResponse.handoffSuggested = scope.mode === "restaurant" && handoffDecision.suggested;
  finalResponse.handoffReason = scope.mode === "restaurant" ? handoffDecision.reason : null;
  finalResponse.handoffMessage = finalResponse.handoffSuggested
    ? "Nếu bạn cần hỗ trợ thêm, bạn có thể bấm 'Gặp nhân viên' để được hỗ trợ bởi người thật."
    : null;

  const shouldRecordKnowledgeGap = Boolean(
    shouldRecordSuggestions && aiSettings.enabled && scope.restaurantId && cleanMessage && (
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
        restaurantId: scope.restaurantId,
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
        restaurantId: scopeRestaurantObjectId,
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
  buildDeterministicActions,
  normalizeAiAction,
  mergeAiActions,
  fallbackSources,
  normalizeGuestId,
  normalizeAiResult,
  enrichMenuItemSource,
  callAiProvider,
  callGemini,
  callLocal,
  buildUserSafeProfile,
  normalizePageContext,
  sanitizeFeatureMatches,
  isSafeInternalPath,
  buildProviderPromptContext,
  shouldRefuseRequest,
  resolveRestaurantScope,
  fetchMenuItems,
  isEligibleRestaurant,
};
