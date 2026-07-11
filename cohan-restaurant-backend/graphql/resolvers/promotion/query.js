import mongoose from "mongoose";
import { Invoice, Promotion } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function toObjectIdString(value) {
  if (!value) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  if (typeof value === "object" && value.id) return String(value.id);
  return String(value);
}

function serializePromotion(promotion) {
  if (!promotion) return null;
  const row = typeof promotion.toObject === "function"
    ? promotion.toObject({ virtuals: true })
    : promotion;
  const id = toObjectIdString(row._id || row.id);
  if (!id) return null;

  return {
    ...row,
    id,
    restaurantId: row.restaurantId ? toObjectIdString(row.restaurantId) : null,
    categoryId: row.categoryId ? toObjectIdString(row.categoryId) : null,
    itemId: row.itemId ? toObjectIdString(row.itemId) : null,
    giftItemId: row.giftItemId ? toObjectIdString(row.giftItemId) : null,
    comboItems: Array.isArray(row.comboItems)
      ? row.comboItems.map((item) => ({
          itemId: toObjectIdString(item?.itemId),
          quantity: Number(item?.quantity || 1),
        })).filter((item) => item.itemId)
      : [],
  };
}

function getPromotionStatus(promotion, now) {
  if (!promotion?.isActive) return "draft";
  const startAt = promotion.startAt ? new Date(promotion.startAt).getTime() : null;
  const endAt = promotion.endAt ? new Date(promotion.endAt).getTime() : null;

  if (Number.isFinite(startAt) && startAt > now.getTime()) return "scheduled";
  if (Number.isFinite(endAt) && endAt < now.getTime()) return "expired";
  return "active";
}

function addToBucket(map, key, usageDelta, discountDelta) {
  const safeKey = String(key || "");
  const current = map.get(safeKey) || { usageCount: 0, totalDiscount: 0 };
  current.usageCount += usageDelta;
  current.totalDiscount += discountDelta;
  map.set(safeKey, current);
}

export const PromotionQuery = {
  async promotionAnalyticsByRestaurant(_, { restaurantId }, ctx) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    const rid = new mongoose.Types.ObjectId(restaurantId);
    await requireRestaurantPermission(ctx, rid, PERMISSIONS.PROMOTION_READ);

    const now = new Date();
    const promotions = await Promotion.find({ restaurantId: rid })
      .select("_id name code promotionType isActive startAt endAt")
      .lean();

    const promotionMap = new Map(
      (promotions || []).map((promotion) => [toObjectIdString(promotion._id || promotion.id), promotion]),
    );

    const statusCounts = (promotions || []).reduce(
      (counts, promotion) => {
        const status = getPromotionStatus(promotion, now);
        if (status === "active") counts.activePromotions += 1;
        if (status === "scheduled") counts.scheduledPromotions += 1;
        if (status === "expired") counts.expiredPromotions += 1;
        return counts;
      },
      { activePromotions: 0, scheduledPromotions: 0, expiredPromotions: 0 }
    );

    const invoices = await Invoice.find({
      restaurantId: rid,
      status: "PAID",
      "meta.appliedPromotions": { $exists: true, $ne: [] },
    })
      .select("meta")
      .lean();

    let totalRedemptions = 0;
    let totalPromotionDiscount = 0;
    let totalShippingDiscount = 0;
    const topPromotionMap = new Map();
    const byTypeMap = new Map();

    for (const invoice of invoices || []) {
      const meta = invoice?.meta || {};
      const appliedPromotionIds = Array.isArray(meta.appliedPromotions)
        ? meta.appliedPromotions.map(toObjectIdString).filter(Boolean)
        : [];
      if (!appliedPromotionIds.length) continue;

      const promotionDiscount = Math.max(0, Number(meta.promotionDiscount || 0));
      const shippingDiscount = Math.max(0, Number(meta.shippingDiscount || 0));
      totalPromotionDiscount += promotionDiscount;
      totalShippingDiscount += shippingDiscount;

      const exactBreakdown = Array.isArray(meta.appliedPromotionBreakdown)
        ? meta.appliedPromotionBreakdown
            .map((row) => ({
              promotionId: toObjectIdString(row?.promotionId),
              promotionType: String(row?.promotionType || ""),
              discountAmount: Math.max(0, Number(row?.discountAmount || 0)),
            }))
            .filter((row) => row.promotionId)
        : [];

      if (exactBreakdown.length > 0) {
        const uniqueUsage = new Set(exactBreakdown.map((row) => row.promotionId));
        totalRedemptions += uniqueUsage.size;

        for (const promotionId of uniqueUsage) {
          addToBucket(topPromotionMap, promotionId, 1, 0);
          const promotion = promotionMap.get(promotionId);
          addToBucket(byTypeMap, promotion?.promotionType || "", 1, 0);
        }

        for (const row of exactBreakdown) {
          const promotion = promotionMap.get(row.promotionId);
          const promotionType = row.promotionType || promotion?.promotionType || "";
          addToBucket(topPromotionMap, row.promotionId, 0, row.discountAmount);
          addToBucket(byTypeMap, promotionType, 0, row.discountAmount);
        }
        continue;
      }

      totalRedemptions += appliedPromotionIds.length;
      const shippingPromotionIds = appliedPromotionIds.filter((promotionId) => {
        const promotionType = String(promotionMap.get(promotionId)?.promotionType || "").toUpperCase();
        return promotionType === "FREESHIP";
      });
      const nonShippingPromotionIds = appliedPromotionIds.filter(
        (promotionId) => !shippingPromotionIds.includes(promotionId),
      );

      const promotionShare = nonShippingPromotionIds.length
        ? promotionDiscount / nonShippingPromotionIds.length
        : promotionDiscount / appliedPromotionIds.length;
      const shippingShare = shippingPromotionIds.length
        ? shippingDiscount / shippingPromotionIds.length
        : 0;

      for (const promotionId of appliedPromotionIds) {
        const promotion = promotionMap.get(promotionId);
        const promotionType = promotion?.promotionType || "";
        const discountShare = shippingPromotionIds.includes(promotionId)
          ? shippingShare
          : promotionShare;

        addToBucket(topPromotionMap, promotionId, 1, discountShare);
        addToBucket(byTypeMap, promotionType, 1, discountShare);
      }
    }

    const topPromotions = Array.from(topPromotionMap.entries())
      .map(([promotionId, row]) => {
        const promotion = promotionMap.get(promotionId);
        return {
          promotionId,
          promotionName: promotion?.name || "",
          promotionCode: promotion?.code || "",
          promotionType: promotion?.promotionType || "",
          usageCount: Number(row.usageCount || 0),
          totalDiscount: Number(row.totalDiscount || 0),
        };
      })
      .sort((a, b) => b.usageCount - a.usageCount || b.totalDiscount - a.totalDiscount)
      .slice(0, 5);

    const byType = Array.from(byTypeMap.entries())
      .map(([promotionType, row]) => ({
        promotionType,
        usageCount: Number(row.usageCount || 0),
        totalDiscount: Number(row.totalDiscount || 0),
      }))
      .sort((a, b) => b.usageCount - a.usageCount || b.totalDiscount - a.totalDiscount);

    const totalPromotions = promotions?.length || 0;
    const totalDiscountAmount = totalPromotionDiscount + totalShippingDiscount;

    return {
      totalPromotions,
      ...statusCounts,
      totalRedemptions,
      totalPromotionDiscount,
      totalShippingDiscount,
      totalDiscountAmount,
      usageRate: totalPromotions ? Math.round((totalRedemptions / totalPromotions) * 100) : 0,
      topPromotions,
      byType,
    };
  },

  async promotionsByRestaurant(
    _,
    { restaurantId, activeOnly = true, limit = 20, offset = 0, now },
    ctx
  ) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    const safeLimit = clamp(limit, 1, activeOnly ? 100 : 500);
    const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));

    const rid = new mongoose.Types.ObjectId(restaurantId);
    if (!activeOnly) {
      await requireRestaurantPermission(ctx, rid, PERMISSIONS.PROMOTION_READ);
    }

    const query = { restaurantId: rid };

    if (activeOnly) {
      query.isActive = true;
      const nowDate = now ? new Date(now) : new Date();
      if (Number.isNaN(nowDate.getTime())) {
        throw new Error("Invalid now");
      }
      query.$and = [
        {
          $or: [
            { startAt: { $exists: false } },
            { startAt: null },
            { startAt: { $lte: nowDate } },
          ],
        },
        {
          $or: [
            { endAt: { $exists: false } },
            { endAt: null },
            { endAt: { $gte: nowDate } },
          ],
        },
      ];
    }

    const rows = await Promotion.find(query)
      .sort({ startAt: -1, _id: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean();

    return rows.map(serializePromotion).filter(Boolean);
  },
};
