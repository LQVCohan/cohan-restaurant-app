import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Promotion } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

const toObjId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

const toOptionalDate = (value, fieldName) => {
  if (!value) return null;
  const next = new Date(value);
  if (Number.isNaN(next.getTime())) {
    throw new GraphQLError(`Invalid ${fieldName}`);
  }
  return next;
};

const normalizePromotionType = (value) => {
  const normalized = String(value || "PERCENTAGE").trim().toUpperCase();
  if (["PERCENT", "PERCENTAGE"].includes(normalized)) return "PERCENTAGE";
  if (["AMOUNT", "FIXED"].includes(normalized)) return "FIXED";
  if (["BOGO", "BUY_X_GET_Y", "BUY_GET"].includes(normalized)) return "BOGO";
  if (normalized === "COMBO") return "COMBO";
  if (normalized === "FREESHIP") return "FREESHIP";
  return "PERCENTAGE";
};

const normalizeScope = (value) => {
  const normalized = String(value || "ORDER").trim().toUpperCase();
  if (["CATEGORY", "ITEM", "ORDER"].includes(normalized)) return normalized;
  return "ORDER";
};

const sanitizeInput = (input = {}) => ({
  name: input.name?.trim(),
  code: input.code ? String(input.code).trim().toUpperCase() : null,
  description: input.description || "",
  promotionType: normalizePromotionType(input.promotionType),
  scope: normalizeScope(input.scope),
  restaurantId: toObjId(input.restaurantId),
  categoryId: toObjId(input.categoryId),
  itemId: toObjId(input.itemId),
  giftItemId: toObjId(input.giftItemId),
  discountType: input.discountType || "PERCENT",
  discountValue: Number(input.discountValue || 0),
  buyQuantity: Number(input.buyQuantity || 0),
  getQuantity: Number(input.getQuantity || 0),
  minOrderValue: Number(input.minOrderValue || 0),
  maxDiscount: Number(input.maxDiscount || 0),
  usageLimit: Number(input.usageLimit || 0),
  targetAudience: input.targetAudience || "all",
  conditions: Array.isArray(input.conditions) ? input.conditions : [],
  level: Number(input.level || 1),
  startAt: toOptionalDate(input.startAt, "startAt"),
  endAt: toOptionalDate(input.endAt, "endAt"),
  isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  stacking: Boolean(input.stacking),
});

const validatePromotionPayload = (payload) => {
  if (!payload.name || !payload.restaurantId) {
    throw new GraphQLError("Invalid promotion input");
  }

  const nonNegativeFields = [
    ["discountValue", payload.discountValue],
    ["buyQuantity", payload.buyQuantity],
    ["getQuantity", payload.getQuantity],
    ["minOrderValue", payload.minOrderValue],
    ["maxDiscount", payload.maxDiscount],
    ["usageLimit", payload.usageLimit],
    ["level", payload.level],
  ];

  for (const [fieldName, value] of nonNegativeFields) {
    if (!Number.isFinite(value) || value < 0) {
      throw new GraphQLError(`${fieldName} must be non-negative`);
    }
  }

  if (payload.startAt && payload.endAt && payload.startAt >= payload.endAt) {
    throw new GraphQLError("Promotion endAt must be after startAt");
  }

  if (payload.scope === "CATEGORY" && !payload.categoryId) {
    throw new GraphQLError("CATEGORY promotion requires categoryId");
  }

  if (payload.scope === "ITEM" && !payload.itemId) {
    throw new GraphQLError("ITEM promotion requires itemId");
  }

  if (payload.promotionType === "BOGO") {
    if (!payload.itemId) {
      throw new GraphQLError("BOGO promotion requires itemId");
    }
    if (!payload.giftItemId) {
      throw new GraphQLError("BOGO promotion requires giftItemId");
    }
    if (payload.buyQuantity <= 0 || payload.getQuantity <= 0) {
      throw new GraphQLError("BOGO promotion requires buyQuantity and getQuantity");
    }
    return;
  }

  if (payload.promotionType === "FREESHIP") {
    if (payload.scope !== "ORDER") {
      throw new GraphQLError("FREESHIP promotion requires ORDER scope");
    }
    return;
  }

  if (["PERCENTAGE", "FIXED"].includes(payload.promotionType)) {
    if (payload.discountValue <= 0) {
      throw new GraphQLError(`${payload.promotionType} promotion requires discountValue > 0`);
    }
    if (payload.promotionType === "PERCENTAGE" && payload.discountValue > 100) {
      throw new GraphQLError("PERCENTAGE promotion requires discountValue between 1 and 100");
    }
  }
};

const loadPromotionForOutput = async (id) =>
  Promotion.findById(id).lean({ virtuals: true });

export const PromotionMutation = {
  async createPromotion(_, { input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    const payload = sanitizeInput(input);
    validatePromotionPayload(payload);
    const created = await Promotion.create(payload);
    return (await loadPromotionForOutput(created._id)) || created;
  },

  async updatePromotion(_, { id, input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid promotion id");
    const payload = sanitizeInput(input);
    validatePromotionPayload(payload);
    const updated = await Promotion.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) throw new GraphQLError("Promotion not found");
    return (await loadPromotionForOutput(updated._id)) || updated;
  },

  async deletePromotion(_, { id }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid promotion id");
    const rs = await Promotion.deleteOne({ _id: id });
    return rs.deletedCount > 0;
  },

  async togglePromotion(_, { id, isActive }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid promotion id");
    const updated = await Promotion.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true });
    if (!updated) throw new GraphQLError("Promotion not found");
    return (await loadPromotionForOutput(updated._id)) || updated;
  },
};
