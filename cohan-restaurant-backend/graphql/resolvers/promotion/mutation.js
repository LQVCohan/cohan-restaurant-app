import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Promotion } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

const toObjId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

const sanitizeInput = (input = {}) => ({
  name: input.name?.trim(),
  code: input.code ? String(input.code).trim().toUpperCase() : null,
  description: input.description || "",
  scope: input.scope || "ORDER",
  restaurantId: toObjId(input.restaurantId),
  categoryId: toObjId(input.categoryId),
  itemId: toObjId(input.itemId),
  discountType: input.discountType || "PERCENT",
  discountValue: Number(input.discountValue || 0),
  minOrderValue: Number(input.minOrderValue || 0),
  maxDiscount: Number(input.maxDiscount || 0),
  usageLimit: Number(input.usageLimit || 0),
  targetAudience: input.targetAudience || "all",
  conditions: Array.isArray(input.conditions) ? input.conditions : [],
  level: Number(input.level || 1),
  startAt: input.startAt ? new Date(input.startAt) : null,
  endAt: input.endAt ? new Date(input.endAt) : null,
  isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  stacking: Boolean(input.stacking),
});

export const PromotionMutation = {
  async createPromotion(_, { input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    const payload = sanitizeInput(input);
    if (!payload.name || !payload.restaurantId || payload.discountValue <= 0) {
      throw new GraphQLError("Invalid promotion input");
    }
    return Promotion.create(payload);
  },

  async updatePromotion(_, { id, input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid promotion id");
    const payload = sanitizeInput(input);
    const updated = await Promotion.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) throw new GraphQLError("Promotion not found");
    return updated;
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
    return updated;
  },
};
