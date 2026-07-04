import mongoose from "mongoose";
import { Restaurant } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  requireAnyRestaurantPermission,
  requireRestaurantPermission,
} from "../auth/authorization.service.js";
import {
  deleteAiChatbotCache,
  getOrSetAiChatbotCache,
} from "./restaurantChatbotCache.service.js";

const SETTINGS_CACHE_TTL_MS = 60 * 1000;
const PRIVATE_SETTINGS_CACHE_PREFIX = "ai:settings:private:";
const PUBLIC_SETTINGS_CACHE_PREFIX = "ai:settings:public:";
const MAX_MESSAGE_LENGTH = 500;
const MAX_QUICK_REPLIES = 8;
const MAX_QUICK_REPLY_LENGTH = 80;
const privateSettingsCacheKey = (restaurantId) =>
  `${PRIVATE_SETTINGS_CACHE_PREFIX}${restaurantId}`;
const publicSettingsCacheKey = (restaurantId) =>
  `${PUBLIC_SETTINGS_CACHE_PREFIX}${restaurantId}`;

// Cache only restaurant-level chatbot settings. Audit user identifiers are intentionally
// omitted from cached values so Phase 26 never stores user/guest identifiers or secrets.
const sanitizeSettingsForCache = (settings) => ({
  ...settings,
  updatedBy: null,
});

const DEFAULT_SETTINGS = {
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
  fallbackMessage: "",
  updatedAt: null,
  updatedBy: null,
};

const PUBLIC_UNAVAILABLE_SETTINGS = {
  enabled: false,
  welcomeMessage:
    "Nhà hàng này hiện chưa khả dụng. Bạn có thể chọn nhà hàng khác đang hiển thị công khai trên hệ thống.",
  starterQuickReplies: [],
  handoffEnabled: false,
  handoffUnavailableMessage:
    "Nhà hàng này hiện chưa khả dụng. Vui lòng chọn nhà hàng khác.",
};

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n || 0)));
const badInput = (message) =>
  Object.assign(new Error(message), { code: "BAD_USER_INPUT" });

const normalizeQuickRepliesForRead = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((s) =>
      String(s || "")
        .trim()
        .slice(0, MAX_QUICK_REPLY_LENGTH),
    )
    .filter(Boolean)
    .slice(0, MAX_QUICK_REPLIES);

const normalizeQuickRepliesForWrite = (arr) => {
  if (!Array.isArray(arr)) return [];

  const cleaned = arr.map((s) => String(s || "").trim()).filter(Boolean);

  if (cleaned.length > MAX_QUICK_REPLIES) {
    throw badInput(`starterQuickReplies tối đa ${MAX_QUICK_REPLIES} mục`);
  }

  cleaned.forEach((item) => {
    if (item.length > MAX_QUICK_REPLY_LENGTH) {
      throw badInput(`Mỗi quick reply tối đa ${MAX_QUICK_REPLY_LENGTH} ký tự`);
    }
  });

  return cleaned;
};

const normalizeTextForWrite = (value, fieldName) => {
  const text = String(value || "").trim();
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw badInput(`${fieldName} tối đa ${MAX_MESSAGE_LENGTH} ký tự`);
  }
  return text;
};

const parseThresholdForWrite = (value) => {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw badInput("lowConfidenceHandoffThreshold phải là số từ 0 đến 1");
  }
  return threshold;
};

export const mergeWithDefaultAiChatbotSettings = (settings = {}) => ({
  ...DEFAULT_SETTINGS,
  ...(settings || {}),
  starterQuickReplies: normalizeQuickRepliesForRead(
    settings?.starterQuickReplies?.length
      ? settings.starterQuickReplies
      : DEFAULT_SETTINGS.starterQuickReplies,
  ),
  lowConfidenceHandoffThreshold: Number.isFinite(
    Number(settings?.lowConfidenceHandoffThreshold),
  )
    ? clamp01(settings.lowConfidenceHandoffThreshold)
    : DEFAULT_SETTINGS.lowConfidenceHandoffThreshold,
});

const ensureAuthenticated = (user) => {
  if (!user?.id && !user?._id)
    throw Object.assign(new Error("Cần đăng nhập"), {
      code: "UNAUTHENTICATED",
    });
};

const ensureRestaurantAccess = async ({
  restaurantId,
  ctx,
  permissionCode,
}) => {
  ensureAuthenticated(ctx?.user);
  if (!mongoose.isValidObjectId(restaurantId))
    throw Object.assign(new Error("restaurantId không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  await requireRestaurantPermission(ctx, restaurantId, permissionCode);
  return true;
};
const ensureAnyRestaurantAccess = async ({
  restaurantId,
  ctx,
  permissionCodes,
}) => {
  ensureAuthenticated(ctx?.user);

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw badInput("restaurantId không hợp lệ");
  }

  await requireAnyRestaurantPermission(ctx, restaurantId, permissionCodes);
  return true;
};
export async function getRestaurantAiChatbotSettings({ restaurantId, ctx }) {
  await ensureAnyRestaurantAccess({
    restaurantId,
    ctx,
    permissionCodes: [
      PERMISSIONS.AI_CHATBOT_READ,
      PERMISSIONS.AI_CHATBOT_WRITE,
    ],
  });
  return getOrSetAiChatbotCache(
    privateSettingsCacheKey(restaurantId),
    async () => {
      const restaurant = await Restaurant.findById(restaurantId)
        .select("aiChatbotSettings")
        .lean();
      return sanitizeSettingsForCache(
        mergeWithDefaultAiChatbotSettings(restaurant?.aiChatbotSettings || {}),
      );
    },
    SETTINGS_CACHE_TTL_MS,
  );
}

export async function getPublicAiChatbotSettings({ restaurantId }) {
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    if (restaurantId) return PUBLIC_UNAVAILABLE_SETTINGS;
    const d = mergeWithDefaultAiChatbotSettings({});
    return {
      enabled: d.enabled,
      welcomeMessage: d.welcomeMessage,
      starterQuickReplies: d.starterQuickReplies,
      handoffEnabled: d.handoffEnabled,
      handoffUnavailableMessage: d.handoffUnavailableMessage,
    };
  }
  return getOrSetAiChatbotCache(
    publicSettingsCacheKey(restaurantId),
    async () => {
      const restaurant = await Restaurant.findById(restaurantId)
        .select("businessStatus publicationStatus aiChatbotSettings")
        .lean();
      if (
        !restaurant ||
        restaurant.businessStatus !== "active" ||
        restaurant.publicationStatus !== "published" ||
        restaurant.aiChatbotSettings?.enabled === false
      ) {
        return PUBLIC_UNAVAILABLE_SETTINGS;
      }
      const d = mergeWithDefaultAiChatbotSettings(
        restaurant?.aiChatbotSettings || {},
      );
      return {
        enabled: d.enabled,
        welcomeMessage: d.welcomeMessage,
        starterQuickReplies: d.starterQuickReplies,
        handoffEnabled: d.handoffEnabled,
        handoffUnavailableMessage: d.handoffUnavailableMessage,
      };
    },
    SETTINGS_CACHE_TTL_MS,
  );
}

export async function updateRestaurantAiChatbotSettings({ input, ctx }) {
  const restaurantId = input?.restaurantId;
  await ensureRestaurantAccess({
    restaurantId,
    ctx,
    permissionCode: PERMISSIONS.AI_CHATBOT_WRITE,
  });
  const patch = {
    enabled: input?.enabled ?? undefined,
    welcomeMessage:
      input?.welcomeMessage == null
        ? undefined
        : normalizeTextForWrite(input.welcomeMessage, "welcomeMessage"),
    starterQuickReplies:
      input?.starterQuickReplies == null
        ? undefined
        : normalizeQuickRepliesForWrite(input.starterQuickReplies),
    handoffEnabled: input?.handoffEnabled ?? undefined,
    handoffUnavailableMessage:
      input?.handoffUnavailableMessage == null
        ? undefined
        : normalizeTextForWrite(
            input.handoffUnavailableMessage,
            "handoffUnavailableMessage",
          ),
    lowConfidenceHandoffThreshold:
      input?.lowConfidenceHandoffThreshold == null
        ? undefined
        : parseThresholdForWrite(input.lowConfidenceHandoffThreshold),
    fallbackMessage:
      input?.fallbackMessage == null
        ? undefined
        : normalizeTextForWrite(input.fallbackMessage, "fallbackMessage"),
  };
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const restaurant =
    await Restaurant.findById(restaurantId).select("aiChatbotSettings");
  if (!restaurant)
    throw Object.assign(new Error("Không tìm thấy nhà hàng"), {
      code: "NOT_FOUND",
    });

  const current = mergeWithDefaultAiChatbotSettings(
    restaurant.aiChatbotSettings || {},
  );
  const merged = mergeWithDefaultAiChatbotSettings({
    ...current,
    ...patch,
    updatedAt: new Date(),
    updatedBy: ctx?.user?.id || ctx?.user?._id || null,
  });

  restaurant.aiChatbotSettings = merged;
  await restaurant.save();
  deleteAiChatbotCache(privateSettingsCacheKey(restaurantId));
  deleteAiChatbotCache(publicSettingsCacheKey(restaurantId));
  return mergeWithDefaultAiChatbotSettings(
    restaurant.aiChatbotSettings || merged,
  );
}
