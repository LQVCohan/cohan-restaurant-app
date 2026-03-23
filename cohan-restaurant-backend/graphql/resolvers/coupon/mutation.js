import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Coupon, VoucherPackage } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

const toObjId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

const mapCouponInput = (input = {}) => ({
  name: String(input.name || "").trim(),
  code: String(input.code || "").trim().toUpperCase(),
  category: input.category || "order",
  description: input.description || "",
  discountType: input.discountType || "PERCENT",
  discountValue: Number(input.discountValue || 0),
  minOrderValue: Number(input.minOrderValue || 0),
  maxDiscount: Number(input.maxDiscount || 0),
  maxUsage: Number(input.maxUsage || 0),
  constraints: input.constraints || {},
  publishAt: input.publishAt ? new Date(input.publishAt) : null,
  startAt: input.startAt ? new Date(input.startAt) : null,
  endAt: input.endAt ? new Date(input.endAt) : null,
  isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  restaurantId: toObjId(input.restaurantId),
});

const mapPackageInput = (input = {}) => ({
  name: String(input.name || "").trim(),
  code: String(input.code || "").trim().toUpperCase(),
  description: input.description || "",
  voucherIds: Array.isArray(input.voucherIds) ? input.voucherIds.map((id) => toObjId(id)).filter(Boolean) : [],
  startAt: input.startAt ? new Date(input.startAt) : null,
  endAt: input.endAt ? new Date(input.endAt) : null,
  publishAt: input.publishAt ? new Date(input.publishAt) : null,
  isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  conditions: Array.isArray(input.conditions) ? input.conditions : [],
  restaurantId: toObjId(input.restaurantId),
});

export const CouponMutation = {
  async createCoupon(_, { input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    const payload = mapCouponInput(input);
    if (!payload.name || !payload.code || payload.discountValue <= 0) {
      throw new GraphQLError("Invalid coupon input");
    }
    return Coupon.create(payload);
  },
  async updateCoupon(_, { id, input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid coupon id");
    const payload = mapCouponInput(input);
    const updated = await Coupon.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) throw new GraphQLError("Coupon not found");
    return updated;
  },
  async deleteCoupon(_, { id }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid coupon id");
    const rs = await Coupon.deleteOne({ _id: id });
    return rs.deletedCount > 0;
  },
  async toggleCoupon(_, { id, isActive }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid coupon id");
    const updated = await Coupon.findByIdAndUpdate(id, { isActive: Boolean(isActive) }, { new: true });
    if (!updated) throw new GraphQLError("Coupon not found");
    return updated;
  },

  async createVoucherPackage(_, { input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    const payload = mapPackageInput(input);
    if (!payload.name || !payload.code || payload.voucherIds.length === 0) {
      throw new GraphQLError("Invalid voucher package input");
    }
    return VoucherPackage.create(payload);
  },
  async updateVoucherPackage(_, { id, input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid package id");
    const payload = mapPackageInput(input);
    const updated = await VoucherPackage.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) throw new GraphQLError("Voucher package not found");
    return updated;
  },
  async deleteVoucherPackage(_, { id }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid package id");
    const rs = await VoucherPackage.deleteOne({ _id: id });
    return rs.deletedCount > 0;
  },
};
