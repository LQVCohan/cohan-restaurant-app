import mongoose from "mongoose";
import { Restaurant } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";

const DEFAULT_SETTINGS = {
  enabled: true,
  welcomeMessage: "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.",
  starterQuickReplies: ["Gợi ý món bán chạy cho tôi", "Tôi muốn đặt bàn", "Có mã giảm giá nào không?"],
  handoffEnabled: true,
  handoffUnavailableMessage: "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.",
  lowConfidenceHandoffThreshold: 0.6,
  fallbackMessage: "",
  updatedAt: null,
  updatedBy: null,
};

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n || 0)));
const normalizeQuickReplies = (arr) => (Array.isArray(arr) ? arr : [])
  .map((s) => String(s || "").trim().slice(0, 80))
  .filter(Boolean)
  .slice(0, 6);

export const mergeWithDefaultAiChatbotSettings = (settings = {}) => ({
  ...DEFAULT_SETTINGS,
  ...(settings || {}),
  starterQuickReplies: normalizeQuickReplies(settings?.starterQuickReplies?.length ? settings.starterQuickReplies : DEFAULT_SETTINGS.starterQuickReplies),
  lowConfidenceHandoffThreshold: Number.isFinite(Number(settings?.lowConfidenceHandoffThreshold))
    ? clamp01(settings.lowConfidenceHandoffThreshold)
    : DEFAULT_SETTINGS.lowConfidenceHandoffThreshold,
});

const ensureAuthenticated = (user) => {
  if (!user?.id && !user?._id) throw Object.assign(new Error("Cần đăng nhập"), { code: "UNAUTHENTICATED" });
};

const ensureRestaurantAccess = async ({ restaurantId, ctx, permissionCode }) => {
  ensureAuthenticated(ctx?.user);
  if (!mongoose.isValidObjectId(restaurantId)) throw Object.assign(new Error("restaurantId không hợp lệ"), { code: "BAD_USER_INPUT" });
  await requireRestaurantPermission(ctx, restaurantId, permissionCode);
  return true;
};

export async function getRestaurantAiChatbotSettings({ restaurantId, ctx }) {
  await ensureRestaurantAccess({ restaurantId, ctx, permissionCode: PERMISSIONS.REPORT_READ });
  const restaurant = await Restaurant.findById(restaurantId).select("aiChatbotSettings").lean();
  return mergeWithDefaultAiChatbotSettings(restaurant?.aiChatbotSettings || {});
}

export async function getPublicAiChatbotSettings({ restaurantId }) {
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    const d = mergeWithDefaultAiChatbotSettings({});
    return { enabled: d.enabled, welcomeMessage: d.welcomeMessage, starterQuickReplies: d.starterQuickReplies, handoffEnabled: d.handoffEnabled, handoffUnavailableMessage: d.handoffUnavailableMessage };
  }
  const restaurant = await Restaurant.findById(restaurantId).select("aiChatbotSettings").lean();
  const d = mergeWithDefaultAiChatbotSettings(restaurant?.aiChatbotSettings || {});
  return { enabled: d.enabled, welcomeMessage: d.welcomeMessage, starterQuickReplies: d.starterQuickReplies, handoffEnabled: d.handoffEnabled, handoffUnavailableMessage: d.handoffUnavailableMessage };
}

export async function updateRestaurantAiChatbotSettings({ input, ctx }) {
  const restaurantId = input?.restaurantId;
  await ensureRestaurantAccess({ restaurantId, ctx, permissionCode: PERMISSIONS.RESTAURANT_WRITE });
  const patch = {
    enabled: input?.enabled ?? undefined,
    welcomeMessage: input?.welcomeMessage == null ? undefined : String(input.welcomeMessage).trim().slice(0, 500),
    starterQuickReplies: input?.starterQuickReplies == null ? undefined : normalizeQuickReplies(input.starterQuickReplies),
    handoffEnabled: input?.handoffEnabled ?? undefined,
    handoffUnavailableMessage: input?.handoffUnavailableMessage == null ? undefined : String(input.handoffUnavailableMessage).trim().slice(0, 500),
    lowConfidenceHandoffThreshold: input?.lowConfidenceHandoffThreshold == null ? undefined : clamp01(input.lowConfidenceHandoffThreshold),
    fallbackMessage: input?.fallbackMessage == null ? undefined : String(input.fallbackMessage).trim().slice(0, 800),
  };
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const restaurant = await Restaurant.findById(restaurantId).select("aiChatbotSettings");
  if (!restaurant) throw Object.assign(new Error("Không tìm thấy nhà hàng"), { code: "NOT_FOUND" });

  const current = mergeWithDefaultAiChatbotSettings(restaurant.aiChatbotSettings || {});
  const merged = mergeWithDefaultAiChatbotSettings({
    ...current,
    ...patch,
    updatedAt: new Date(),
    updatedBy: ctx?.user?.id || ctx?.user?._id || null,
  });

  restaurant.aiChatbotSettings = merged;
  await restaurant.save();
  return mergeWithDefaultAiChatbotSettings(restaurant.aiChatbotSettings || merged);
}
