import mongoose from "mongoose";
import {
  AiChatConversation,
  AiChatMessage,
  MenuItem,
  Restaurant,
} from "../../../models/index.js";
import { computeRestaurantAvailability } from "../restaurantAvailability.service.js";
import { handleRestaurantChatbotMessage as handleReviewedRestaurantChatbotMessage } from "./restaurantChatbotReviewed.service.js";

const ELIGIBLE_RESTAURANT_FILTER = {
  businessStatus: "active",
  publicationStatus: "published",
  "aiChatbotSettings.enabled": { $ne: false },
};

const normalizeIntentText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isStrongMenuRecommendationQuestion = (message = "") => {
  const raw = normalizeIntentText(message);
  if (!raw) return false;

  const asksForFood =
    /(?:goi y|de xuat|recommend).*(?:mon|do an|menu)/.test(raw) ||
    /(?:mon nao|mon gi|co mon gi|an gi|chon mon gi)/.test(raw) ||
    /mon.*(?:oke|ok|ngon|hop|phu hop)/.test(raw);
  const entertainmentContext =
    /(?:xem|coi).*(?:bong da|da banh|the thao|phim)/.test(raw) &&
    /(?:mon|do an|an gi|menu)/.test(raw);

  return asksForFood || entertainmentContext;
};

const isRestaurantOrderAvailabilityQuestion = (message = "") => {
  const raw = normalizeIntentText(message);
  if (!raw) return false;

  const mentionsRestaurant = /(?:nha hang|quan an|quan|tiem an)/.test(raw);
  const asksWhetherOrderingIsOpen =
    /(?:dang|con|co).*(?:nhan order|nhan don|nhan dat mon)/.test(raw) ||
    /(?:nha hang|quan an|quan|tiem an).*(?:order duoc|dat mon duoc|co the dat mon)/.test(raw) ||
    /(?:nhan order|nhan don|nhan dat mon).*(?:nha hang|quan an|quan|tiem an)/.test(raw);
  const personalOrderLookup =
    /(?:don hang cua toi|don cua toi|ma don|trang thai don|theo doi don)/.test(raw);

  return mentionsRestaurant && asksWhetherOrderingIsOpen && !personalOrderLookup;
};

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const toId = (value) => String(value?._id || value?.id || value || "");

const formatCurrency = (value, currency = "VND") => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return currency === "USD" ? "$0.00" : "0đ";
  if (currency === "USD") return `$${amount.toFixed(2)}`;
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
};

const menuRecommendationReason = (item = {}) => {
  if (Number(item.orderCounter || 0) > 0) return "được gọi nhiều";
  if (Number(item.rate || 0) > 0) return `đánh giá ${Number(item.rate).toFixed(1)}/5`;
  return "đang có bán";
};

const buildMenuRecommendationAnswer = ({ restaurantName, items = [], message = "" } = {}) => {
  const footballContext = /(?:bong da|da banh|the thao)/.test(normalizeIntentText(message));
  const intro = footballContext
    ? `Đang xem bóng đá thì mình gợi ý các món dễ chọn và tiện ăn tại ${restaurantName || "nhà hàng"}:`
    : `Mình gợi ý các món đang bán tại ${restaurantName || "nhà hàng"}:`;
  const lines = items.map((item, index) => {
    const price = formatCurrency(item.currentPrice || item.basePrice, item.currency || "VND");
    return `${index + 1}. ${item.name} - ${price} (${menuRecommendationReason(item)})`;
  });
  return `${intro}\n${lines.join("\n")}\nBạn có thể bấm vào món bên dưới để xem chi tiết.`;
};

const unavailableOrderReason = (availability = {}, restaurant = {}) => {
  const status = String(availability.openingStatus || restaurant.operationalStatus || "").toLowerCase();
  if (status === "closed") return "đang ngoài giờ nhận đơn";
  if (status === "paused") return "đang tạm dừng nhận đơn";
  if (status === "maintenance") return "đang bảo trì";
  if (status === "holiday") return "đang nghỉ theo lịch";
  if (restaurant?.capabilities?.acceptsOrders === false) return "chưa bật nhận đơn trực tuyến";
  return "hiện chưa thể nhận đơn";
};

const buildRestaurantAvailabilityAnswer = ({ rows = [], scopedRestaurant = null } = {}) => {
  if (scopedRestaurant) {
    const availability = scopedRestaurant.availability || {};
    if (availability.canOrder) {
      return `${scopedRestaurant.name} hiện đang nhận đơn. Bạn có thể mở trang nhà hàng hoặc menu để chọn món.`;
    }
    return `${scopedRestaurant.name} ${unavailableOrderReason(availability, scopedRestaurant)}. Bạn có thể kiểm tra lại sau hoặc chọn nhà hàng khác.`;
  }

  if (!rows.length) {
    return "Hiện mình chưa thấy nhà hàng nào đang nhận đơn theo trạng thái vận hành và giờ mở cửa hiện tại. Bạn có thể kiểm tra lại sau.";
  }

  const lines = rows.map((restaurant, index) => {
    const city = restaurant?.address?.city || restaurant?.address?.district || "";
    return `${index + 1}. ${restaurant.name}${city ? ` - ${city}` : ""}`;
  });
  return `Các nhà hàng đang nhận đơn lúc này:\n${lines.join("\n")}\nBạn có thể chọn một nhà hàng để xem menu và đặt món.`;
};

const buildMenuSources = (items = [], restaurant = {}) =>
  items.map((item) => {
    const currency = restaurant.defaultCurrency || item.currency || "VND";
    const currentPrice = Number(item.currentPrice || item.basePrice || 0);
    return {
      type: "menuItem",
      id: toId(item),
      label: item.name,
      restaurantId: toId(restaurant),
      restaurantName: restaurant.name || null,
      currency,
      formattedPrice: formatCurrency(currentPrice, currency),
      status: item.status || "available",
      isAvailable: item.isAvailable !== false && item.status === "available",
      hasOptions: Array.isArray(item.options) && item.options.length > 0,
      hasVariants:
        (Array.isArray(item.variants) && item.variants.length > 0) ||
        (Array.isArray(item.servingVariants) && item.servingVariants.length > 0),
      servingVariants: Array.isArray(item.servingVariants)
        ? item.servingVariants.slice(0, 4)
        : [],
      basePrice: Number(item.basePrice || 0),
      currentPrice,
      price: currentPrice,
    };
  });

const buildRestaurantSources = (restaurants = []) =>
  restaurants.map((restaurant) => ({
    type: "restaurant",
    id: toId(restaurant),
    label: restaurant.name,
    restaurantId: toId(restaurant),
    restaurantName: restaurant.name,
    currency: restaurant.defaultCurrency || "VND",
    status: restaurant.availability?.openingStatus || restaurant.operationalStatus || null,
    isAvailable: Boolean(restaurant.availability?.canOrder),
  }));

async function persistCorrectedResponse(response = {}) {
  const updates = [];
  if (response.answerMessageId && mongoose.isValidObjectId(response.answerMessageId)) {
    updates.push(
      AiChatMessage.updateOne(
        { _id: response.answerMessageId },
        {
          $set: {
            content: String(response.answer || ""),
            intent: String(response.intent || ""),
            confidence: Number.isFinite(Number(response.confidence))
              ? Number(response.confidence)
              : null,
            isFallback: Boolean(response.isFallback),
            quickReplies: response.quickReplies || [],
            actions: response.actions || [],
            sources: response.sources || [],
            contextSummary: response.contextSummary || null,
          },
        },
      ),
    );
  }
  if (response.conversationId && mongoose.isValidObjectId(response.conversationId)) {
    updates.push(
      AiChatConversation.updateOne(
        { _id: response.conversationId },
        {
          $set: {
            lastMessageAt: new Date(),
            lastMessagePreview: String(response.answer || "").slice(0, 300),
            lastIntent: String(response.intent || ""),
          },
        },
      ),
    );
  }
  if (updates.length) await Promise.all(updates);
}

async function correctMenuRecommendation(options = {}, response = {}) {
  const restaurantId = response.resolvedRestaurantId || options.restaurantId || options.pageContext?.restaurantId;
  const rid = toObjectId(restaurantId);
  if (!rid) return response;

  const [restaurant, items] = await Promise.all([
    Restaurant.findOne({ ...ELIGIBLE_RESTAURANT_FILTER, _id: rid }).lean(),
    MenuItem.find({
      restaurantId: rid,
      status: "available",
      isAvailable: { $ne: false },
      inventoryStatus: { $ne: "OUT_OF_STOCK" },
    })
      .sort({ orderCounter: -1, rate: -1, updatedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  if (!restaurant || !items.length) return response;
  const normalizedItems = items.map((item) => ({
    ...item,
    currency: restaurant.defaultCurrency || "VND",
  }));
  const sources = buildMenuSources(normalizedItems, restaurant);
  const corrected = {
    ...response,
    answer: buildMenuRecommendationAnswer({
      restaurantName: restaurant.name,
      items: normalizedItems,
      message: options.message,
    }),
    intent: "menu",
    confidence: 1,
    quickReplies: ["Món bán chạy", "Món ra nhanh", "Món dưới 100k", "Xem menu"],
    actions: sources.slice(0, 5).map((source, index) => ({
      type: "link",
      label: `Xem ${source.label}`.slice(0, 80),
      href: `/food/${source.id}`,
      description: `${source.formattedPrice} tại ${restaurant.name}`,
      icon: "food",
      priority: index + 1,
    })),
    sources,
    contextSummary: {
      ...(response.contextSummary || {}),
      restaurantCount: 1,
      menuItemCount: sources.length,
    },
    isFallback: false,
    handoffSuggested: false,
    handoffReason: null,
    handoffMessage: null,
    scopeMode: "restaurant",
    resolvedRestaurantId: toId(restaurant),
    scopeCandidates: [
      {
        restaurantId: toId(restaurant),
        restaurantName: restaurant.name,
        reason: "pageRestaurant",
      },
    ],
  };
  await persistCorrectedResponse(corrected);
  return corrected;
}

async function correctRestaurantOrderAvailability(options = {}, response = {}) {
  const requestedRestaurantId = response.resolvedRestaurantId || options.restaurantId || options.pageContext?.restaurantId;
  const rid = toObjectId(requestedRestaurantId);
  const query = rid
    ? { ...ELIGIBLE_RESTAURANT_FILTER, _id: rid }
    : ELIGIBLE_RESTAURANT_FILTER;
  const restaurants = await Restaurant.find(query)
    .sort({ avgRating: -1, reviewCount: -1, updatedAt: -1 })
    .limit(rid ? 1 : 50)
    .lean();

  const evaluated = restaurants.map((restaurant) => ({
    ...restaurant,
    availability: computeRestaurantAvailability(restaurant),
  }));
  const scopedRestaurant = rid ? evaluated[0] || null : null;
  const orderable = evaluated.filter((restaurant) => restaurant.availability?.canOrder).slice(0, 8);
  const sourceRestaurants = scopedRestaurant ? [scopedRestaurant] : orderable;
  const sources = buildRestaurantSources(sourceRestaurants);
  const actions = sourceRestaurants.map((restaurant, index) => ({
    type: "link",
    label: restaurant.availability?.canOrder
      ? `Xem menu ${restaurant.name}`.slice(0, 80)
      : "Chọn nhà hàng khác",
    href: restaurant.availability?.canOrder
      ? `/restaurant/${toId(restaurant)}`
      : "/restaurants",
    description: restaurant.availability?.canOrder
      ? "Nhà hàng đang nhận đơn theo trạng thái hiện tại."
      : unavailableOrderReason(restaurant.availability, restaurant),
    icon: "restaurant",
    priority: index + 1,
  }));

  if (!actions.length) {
    actions.push({
      type: "link",
      label: "Xem danh sách nhà hàng",
      href: "/restaurants",
      description: "Kiểm tra lại trạng thái của các nhà hàng.",
      icon: "restaurant",
      priority: 1,
    });
  }

  const corrected = {
    ...response,
    answer: buildRestaurantAvailabilityAnswer({ rows: orderable, scopedRestaurant }),
    intent: "restaurantOrderAvailability",
    confidence: 1,
    quickReplies: ["Xem nhà hàng", "Gợi ý món", "Món bán chạy"],
    actions,
    sources,
    contextSummary: {
      ...(response.contextSummary || {}),
      restaurantCount: sourceRestaurants.length,
      menuItemCount: 0,
      orderCount: 0,
    },
    isFallback: false,
    handoffSuggested: false,
    handoffReason: null,
    handoffMessage: null,
    scopeMode: scopedRestaurant ? "restaurant" : "global",
    resolvedRestaurantId: scopedRestaurant ? toId(scopedRestaurant) : null,
    scopeCandidates: sourceRestaurants.map((restaurant) => ({
      restaurantId: toId(restaurant),
      restaurantName: restaurant.name,
      reason: restaurant.availability?.canOrder ? "canOrderNow" : "currentRestaurant",
    })),
  };
  await persistCorrectedResponse(corrected);
  return corrected;
}

export async function handleRestaurantChatbotMessage(options = {}) {
  const response = await handleReviewedRestaurantChatbotMessage(options);

  try {
    if (isRestaurantOrderAvailabilityQuestion(options.message)) {
      return await correctRestaurantOrderAvailability(options, response);
    }
    if (
      isStrongMenuRecommendationQuestion(options.message) &&
      response.intent !== "menuItemStatus"
    ) {
      return await correctMenuRecommendation(options, response);
    }
  } catch (error) {
    console.warn("[ai-chatbot] routing guard correction skipped", {
      code: error?.code || "ROUTING_GUARD_ERROR",
    });
  }

  return response;
}

export const __testables = {
  normalizeIntentText,
  isStrongMenuRecommendationQuestion,
  isRestaurantOrderAvailabilityQuestion,
  buildMenuRecommendationAnswer,
  buildRestaurantAvailabilityAnswer,
  unavailableOrderReason,
  buildMenuSources,
  buildRestaurantSources,
};
