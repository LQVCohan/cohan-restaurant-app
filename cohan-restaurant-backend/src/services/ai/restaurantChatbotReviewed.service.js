import mongoose from "mongoose";
import {
  AiChatMessage,
  Coupon,
  MenuItem,
  Restaurant,
} from "../../../models/index.js";
import {
  __testables as baseTestables,
  handleRestaurantChatbotMessage as handleBaseRestaurantChatbotMessage,
} from "./restaurantChatbot.service.js";
import { getPublicAiChatbotSettings } from "./restaurantChatbotSettings.service.js";
import {
  getMenuItemInventoryAvailability,
  MENU_ITEM_INVENTORY_STATUS,
} from "../menuItemInventoryAvailability.service.js";

const ELIGIBLE_RESTAURANT_FILTER = {
  businessStatus: "active",
  publicationStatus: "published",
  "aiChatbotSettings.enabled": { $ne: false },
};

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const toId = (value) => String(value?._id || value?.id || value || "");

const unavailableResponse = () => ({
  answer:
    "Nhà hàng hoặc món ăn này hiện chưa khả dụng. Bạn có thể chọn nhà hàng khác đang hiển thị công khai trên hệ thống.",
  intent: "general",
  confidence: 1,
  quickReplies: [],
  actions: [
    {
      type: "link",
      label: "Chọn nhà hàng",
      href: "/restaurants",
      description: "Xem các nhà hàng đang khả dụng.",
      icon: "restaurant",
      priority: 1,
    },
  ],
  sources: [],
  contextSummary: {
    restaurantCount: 0,
    menuItemCount: 0,
    couponCount: 0,
    orderCount: 0,
    reservationCount: 0,
  },
  conversationId: null,
  answerMessageId: null,
  isFallback: true,
  handoffSuggested: false,
  handoffReason: null,
  handoffMessage: null,
  scopeMode: "global",
  resolvedRestaurantId: null,
  scopeCandidates: [],
});

async function findEligibleRestaurant(id) {
  const objectId = toObjectId(id);
  if (!objectId) return null;
  return Restaurant.findOne({
    ...ELIGIBLE_RESTAURANT_FILTER,
    _id: objectId,
  }).lean();
}

async function validateSelectedMenuItemScope(options = {}) {
  const pageContext = { ...(options.pageContext || {}) };
  const selected = pageContext.selectedMenuItem || null;
  const selectedId = selected?.id || selected?.menuItemId;
  if (!selectedId) return { ok: true, options, selectedItem: null };

  const itemId = toObjectId(selectedId);
  if (!itemId) return { ok: false };
  const item = await MenuItem.findById(itemId).lean();
  if (
    !item?.restaurantId ||
    item.status !== "available" ||
    item.isAvailable === false
  ) {
    return { ok: false };
  }

  const restaurant = await findEligibleRestaurant(item.restaurantId);
  if (!restaurant) return { ok: false };
  const verifiedRestaurantId = toId(restaurant);
  const suppliedRestaurantIds = [
    options.restaurantId,
    pageContext.restaurantId,
    selected?.restaurantId,
  ]
    .filter(Boolean)
    .map(String);

  if (suppliedRestaurantIds.some((id) => id !== verifiedRestaurantId)) {
    return { ok: false };
  }

  return {
    ok: true,
    selectedItem: item,
    options: {
      ...options,
      restaurantId: verifiedRestaurantId,
      pageContext: {
        ...pageContext,
        restaurantId: verifiedRestaurantId,
        selectedMenuItem: {
          ...selected,
          id: toId(item),
          name: item.name || selected?.name || "",
          restaurantId: verifiedRestaurantId,
        },
      },
    },
  };
}

const normalizeForMatch = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

const isSelectedMenuItemAvailabilityQuestion = (message = "") =>
  /(?:het mon|het nguyen lieu|con bao nhieu|so luong con|con lai|ton kho|con hang|co san|dat duoc bao nhieu|out of stock|available)/i.test(
    normalizeForMatch(message),
  );

const buildSelectedMenuItemAvailabilityAnswer = ({ item = {}, availability = {} } = {}) => {
  const name = String(item?.name || "món này").trim() || "món này";
  const status = String(
    availability?.inventoryStatus || item?.inventoryStatus || "",
  ).toUpperCase();
  const maxAvailable = Number(availability?.maxAvailable);
  const hasQuantity = Number.isFinite(maxAvailable) && maxAvailable >= 0;

  if (status === MENU_ITEM_INVENTORY_STATUS.OUT_OF_STOCK) {
    return `Món “${name}” hiện đã hết nguyên liệu, nên số lượng có thể đặt lúc này là 0. Bạn có thể quay lại sau hoặc chọn món khác đang còn hàng.`;
  }

  if (
    [
      MENU_ITEM_INVENTORY_STATUS.IN_STOCK,
      MENU_ITEM_INVENTORY_STATUS.LOW_STOCK,
    ].includes(status) &&
    hasQuantity
  ) {
    const warning =
      status === MENU_ITEM_INVENTORY_STATUS.LOW_STOCK
        ? " Món đang gần hết nên số lượng có thể thay đổi nhanh."
        : " Số lượng thực tế có thể giảm khi khách khác đặt cùng lúc.";
    return `Món “${name}” hiện còn tối đa khoảng ${maxAvailable} phần theo tồn kho nguyên liệu.${warning}`;
  }

  if (status === MENU_ITEM_INVENTORY_STATUS.NOT_TRACKED) {
    return `Nhà hàng chưa theo dõi tồn kho theo công thức cho món “${name}”, nên hệ thống chưa có số lượng còn lại chính xác để hiển thị. Bạn có thể dựa vào trạng thái đặt món trên trang hoặc hỏi nhân viên.`;
  }

  return `Mình chưa lấy được số lượng tồn kho chính xác của món “${name}” lúc này. Bạn có thể thử lại sau hoặc hỏi nhân viên nhà hàng.`;
};

async function enrichSelectedMenuItemAvailabilityResponse(validated, response) {
  const item = validated?.selectedItem;
  const options = validated?.options || {};
  if (!item || !isSelectedMenuItemAvailabilityQuestion(options.message)) {
    return response;
  }

  let availability;
  try {
    availability = await getMenuItemInventoryAvailability({
      restaurantId: toId(item.restaurantId),
      menuItemId: toId(item),
    });
  } catch {
    availability = {
      inventoryStatus: MENU_ITEM_INVENTORY_STATUS.ERROR,
      maxAvailable: 0,
    };
  }

  const inventoryStatus = String(
    availability?.inventoryStatus || item?.inventoryStatus || "",
  ).toUpperCase();
  const itemId = toId(item);
  const selectedSource = {
    type: "menuItem",
    id: itemId,
    label: item.name || "Món đang xem",
    status: item.status || null,
    isAvailable:
      item.status === "available" &&
      item.isAvailable !== false &&
      inventoryStatus !== MENU_ITEM_INVENTORY_STATUS.OUT_OF_STOCK,
    restaurantId: item.restaurantId ? String(item.restaurantId) : null,
    basePrice: Number(item.basePrice || 0),
    currentPrice: Number(item.currentPrice || item.basePrice || 0),
  };

  return {
    ...response,
    answer: buildSelectedMenuItemAvailabilityAnswer({ item, availability }),
    intent: "menuItemStatus",
    confidence: 1,
    quickReplies:
      inventoryStatus === MENU_ITEM_INVENTORY_STATUS.OUT_OF_STOCK
        ? ["Gợi ý món còn hàng", "Xem món khác"]
        : ["Xem món khác"],
    sources: [
      selectedSource,
      ...(Array.isArray(response?.sources) ? response.sources : []).filter(
        (source) => String(source?.id || "") !== itemId,
      ),
    ],
    isFallback: false,
    handoffSuggested: false,
    handoffReason: null,
    handoffMessage: null,
  };
}

const formatCurrency = (value, currency = "VND") => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return currency === "USD" ? "$0.00" : "0đ";
  if (currency === "USD") return `$${amount.toFixed(2)}`;
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
};

const isPromotionQuestion = (message = "", response = {}) =>
  response?.intent === "promotion" ||
  /(coupon|voucher|mã giảm|ma giam|khuyến mãi|khuyen mai|ưu đãi|uu dai|giảm giá|giam gia)/i.test(
    String(message || ""),
  );

async function findPublicCoupons(resolvedRestaurantId = null) {
  const now = new Date();
  const filter = {
    isActive: true,
    $and: [
      {
        $or: [
          { startAt: null },
          { startAt: { $exists: false } },
          { startAt: { $lte: now } },
        ],
      },
      {
        $or: [
          { endAt: null },
          { endAt: { $exists: false } },
          { endAt: { $gte: now } },
        ],
      },
    ],
  };

  if (resolvedRestaurantId) {
    filter.$or = [
      { restaurantId: toObjectId(resolvedRestaurantId) },
      { restaurantId: null },
    ];
  }

  const coupons = await Coupon.find(filter)
    .sort({ discountValue: -1, endAt: 1, updatedAt: -1 })
    .limit(resolvedRestaurantId ? 8 : 24)
    .lean();
  const ownerIds = [
    ...new Set(
      coupons
        .map((coupon) => String(coupon.restaurantId || ""))
        .filter(Boolean),
    ),
  ];
  const owners = ownerIds.length
    ? await Restaurant.find({
        ...ELIGIBLE_RESTAURANT_FILTER,
        _id: { $in: ownerIds.map((id) => toObjectId(id)).filter(Boolean) },
      }).lean()
    : [];
  const ownerMap = new Map(owners.map((owner) => [toId(owner), owner]));

  return coupons
    .filter(
      (coupon) =>
        !coupon.restaurantId || ownerMap.has(String(coupon.restaurantId)),
    )
    .map((coupon) => {
      const owner = coupon.restaurantId
        ? ownerMap.get(String(coupon.restaurantId))
        : null;
      return {
        ...coupon,
        restaurantId: coupon.restaurantId
          ? String(coupon.restaurantId)
          : null,
        restaurantName: owner?.name || null,
        currency: owner?.defaultCurrency || "VND",
      };
    })
    .slice(0, 6);
}

function mergeScopeCandidates(response = {}) {
  const candidateMap = new Map();
  for (const candidate of response.scopeCandidates || []) {
    if (candidate?.restaurantId) {
      candidateMap.set(String(candidate.restaurantId), candidate);
    }
  }
  for (const source of response.sources || []) {
    if (!source?.restaurantId || !source?.restaurantName) continue;
    const restaurantId = String(source.restaurantId);
    if (!candidateMap.has(restaurantId)) {
      candidateMap.set(restaurantId, {
        restaurantId,
        restaurantName: source.restaurantName,
        reason: source.type === "menuItem" ? "menuMatch" : "couponMatch",
      });
    }
  }
  const scopeCandidates = [...candidateMap.values()].slice(0, 6);
  const uniqueRestaurantIds = new Set(
    scopeCandidates.map((candidate) => String(candidate.restaurantId)),
  );
  return {
    ...response,
    scopeCandidates,
    contextSummary: response.contextSummary
      ? {
          ...response.contextSummary,
          restaurantCount:
            response.scopeMode === "restaurant"
              ? Math.max(1, Number(response.contextSummary.restaurantCount || 0))
              : uniqueRestaurantIds.size,
        }
      : response.contextSummary,
  };
}

async function enrichPromotionResponse(options, response) {
  if (!isPromotionQuestion(options.message, response)) return response;
  const coupons = await findPublicCoupons(response.resolvedRestaurantId || null);
  if (!coupons.length) return response;

  const lines = coupons.map((coupon) => {
    const value =
      coupon.discountType === "AMOUNT"
        ? formatCurrency(coupon.discountValue, coupon.currency)
        : `${coupon.discountValue}%`;
    const scope = coupon.restaurantName
      ? ` tại ${coupon.restaurantName}`
      : " trên hệ thống";
    const minimum = coupon.minOrderValue
      ? `, đơn tối thiểu ${formatCurrency(coupon.minOrderValue, coupon.currency)}`
      : "";
    const maximum = coupon.maxDiscount
      ? `, giảm tối đa ${formatCurrency(coupon.maxDiscount, coupon.currency)}`
      : "";
    return `- ${coupon.code}${scope}: ${coupon.name || "Ưu đãi"} giảm ${value}${minimum}${maximum}`;
  });

  const couponSources = coupons.map((coupon) => ({
    type: "coupon",
    id: String(coupon._id || coupon.id),
    label: coupon.restaurantName
      ? `${coupon.code} (${coupon.restaurantName})`
      : coupon.code,
    restaurantId: coupon.restaurantId,
    restaurantName: coupon.restaurantName,
    currency: coupon.currency,
  }));

  return {
    ...response,
    answer: `Các ưu đãi đang hoạt động:\n${lines.join("\n")}`,
    sources: [
      ...(response.sources || []).filter((source) => source?.type !== "coupon"),
      ...couponSources,
    ],
    contextSummary: {
      ...(response.contextSummary || {}),
      couponCount: coupons.length,
    },
  };
}

async function enforceHandoffRules(response = {}) {
  const actions = Array.isArray(response.actions) ? response.actions : [];
  if (response.scopeMode !== "restaurant") {
    return {
      ...response,
      answer:
        response.intent === "support"
          ? "Bạn hãy chọn nhà hàng trước để mình kết nối đúng nhân viên hỗ trợ."
          : response.answer,
      actions:
        response.intent === "support"
          ? [
              ...actions.filter((action) => action?.type !== "handoff"),
              {
                type: "link",
                label: "Chọn nhà hàng",
                href: "/restaurants",
                description: "Chọn nhà hàng trước khi gặp nhân viên.",
                icon: "restaurant",
                priority: 1,
              },
            ]
          : actions.filter((action) => action?.type !== "handoff"),
      handoffSuggested: false,
      handoffReason: null,
      handoffMessage: null,
    };
  }

  const settings = await getPublicAiChatbotSettings({
    restaurantId: response.resolvedRestaurantId,
  });
  if (settings?.handoffEnabled !== false) return response;
  return {
    ...response,
    answer:
      response.intent === "support"
        ? settings.handoffUnavailableMessage ||
          "Nhà hàng này hiện chưa bật hỗ trợ trực tiếp qua chatbot."
        : response.answer,
    actions: actions.filter((action) => action?.type !== "handoff"),
    handoffSuggested: false,
    handoffReason: null,
    handoffMessage: null,
  };
}

async function persistPostprocessedResponse(response = {}) {
  if (!response.answerMessageId) return;
  await AiChatMessage.updateOne(
    { _id: response.answerMessageId },
    {
      $set: {
        content: String(response.answer || ""),
        actions: response.actions || [],
        sources: response.sources || [],
        contextSummary: response.contextSummary || null,
      },
    },
  );
}

export async function handleRestaurantChatbotMessage(options = {}) {
  const validated = await validateSelectedMenuItemScope(options);
  if (!validated.ok) return unavailableResponse();

  let response = await handleBaseRestaurantChatbotMessage(validated.options);
  response = await enrichSelectedMenuItemAvailabilityResponse(validated, response);
  response = await enrichPromotionResponse(validated.options, response);
  response = mergeScopeCandidates(response);
  response = await enforceHandoffRules(response);

  try {
    await persistPostprocessedResponse(response);
  } catch {
    // Keep chatbot responses available when persistence is temporarily unavailable.
  }

  return {
    ...response,
    scopeMode: response.scopeMode || "global",
    resolvedRestaurantId: response.resolvedRestaurantId || null,
    scopeCandidates: Array.isArray(response.scopeCandidates)
      ? response.scopeCandidates
      : [],
  };
}

export const __testables = {
  ...baseTestables,
  validateSelectedMenuItemScope,
  findPublicCoupons,
  mergeScopeCandidates,
  enrichPromotionResponse,
  enforceHandoffRules,
  isSelectedMenuItemAvailabilityQuestion,
  buildSelectedMenuItemAvailabilityAnswer,
  enrichSelectedMenuItemAvailabilityResponse,
};
