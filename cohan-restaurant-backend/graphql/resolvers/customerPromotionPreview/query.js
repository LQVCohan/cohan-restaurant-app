import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { getPublicRestaurantOrThrow } from "../shared/restaurantCapabilityGuards.js";
import { calculateCustomerPromotionPricing } from "../../../src/services/customerPromotionPricing.service.js";
import {
  loadCustomerRankContext,
  resolveCustomerRankAliasesForRestaurant,
} from "../../../src/services/customerRankSetting.service.js";

const normalizePromotionIds = (promotionIds = []) =>
  Array.isArray(promotionIds)
    ? promotionIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

const normalizePaymentMethod = (value) => {
  const method = String(value || "").trim().toLowerCase();
  return method || undefined;
};

const normalizeOrderType = (value) => {
  const orderType = String(value || "dine_in").trim().toLowerCase();
  if (!["dine_in", "takeaway", "delivery"].includes(orderType)) {
    throw new GraphQLError("Loại đơn hàng không hợp lệ.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return orderType;
};

export const CustomerPromotionPreviewQuery = {
  async customerPromotionPreview(_, { input }, ctx) {
    const restaurantId = String(input?.restaurantId || "").trim();
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("restaurantId không hợp lệ.", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    await getPublicRestaurantOrThrow(
      restaurantId,
      "Nhà hàng hiện không khả dụng để kiểm tra ưu đãi.",
    );

    const items = Array.isArray(input?.items) ? input.items : [];
    if (!items.length) {
      throw new GraphQLError("Giỏ hàng chưa có món để kiểm tra ưu đãi.", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const userId = mongoose.isValidObjectId(ctx?.user?.id)
      ? String(ctx.user.id)
      : null;
    const userRankContext = userId
      ? await loadCustomerRankContext(userId)
      : null;
    const customerRanks = userRankContext
      ? await resolveCustomerRankAliasesForRestaurant({
          userContext: userRankContext,
          restaurantId,
        })
      : [];

    const { breakdown } = await calculateCustomerPromotionPricing({
      restaurantId,
      items,
      pricing: {
        taxRate: input?.pricing?.taxRate,
        serviceRate: input?.pricing?.serviceRate,
        shippingFee: input?.pricing?.shippingFee,
        voucherCode: input?.pricing?.voucherCode,
      },
      promotionIds: normalizePromotionIds(input?.promotionIds),
      userId,
      orderType: normalizeOrderType(input?.orderType),
      paymentMethod: normalizePaymentMethod(input?.paymentMethod),
      customerRanks,
    });

    return breakdown;
  },
};
