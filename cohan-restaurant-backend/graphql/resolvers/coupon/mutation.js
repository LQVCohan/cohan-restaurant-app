import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Coupon, VoucherPackage } from "../../../models/index.js";
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
  publishAt: toOptionalDate(input.publishAt, "publishAt"),
  startAt: toOptionalDate(input.startAt, "startAt"),
  endAt: toOptionalDate(input.endAt, "endAt"),
  isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  restaurantId: toObjId(input.restaurantId),
});

const mapPackageInput = (input = {}) => ({
  name: String(input.name || "").trim(),
  code: String(input.code || "").trim().toUpperCase(),
  description: input.description || "",
  voucherIds: Array.isArray(input.voucherIds) ? input.voucherIds.map((id) => toObjId(id)).filter(Boolean) : [],
  startAt: toOptionalDate(input.startAt, "startAt"),
  endAt: toOptionalDate(input.endAt, "endAt"),
  publishAt: toOptionalDate(input.publishAt, "publishAt"),
  isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  conditions: Array.isArray(input.conditions) ? input.conditions : [],
  restaurantId: toObjId(input.restaurantId),
});

const assertValidDateRange = (payload) => {
  if (payload.startAt && payload.endAt && payload.startAt >= payload.endAt) {
    throw new GraphQLError("endAt must be after startAt");
  }
};

const assertValidCouponPayload = (payload) => {
  if (!payload.name || !payload.code) {
    throw new GraphQLError("name and code are required");
  }
  if (payload.discountValue <= 0) {
    throw new GraphQLError("discountValue must be greater than 0");
  }
  if (payload.discountType === "PERCENT" && (payload.discountValue < 1 || payload.discountValue > 100)) {
    throw new GraphQLError("PERCENT discountValue must be between 1 and 100");
  }
  if (payload.discountType === "AMOUNT" && payload.discountValue <= 0) {
    throw new GraphQLError("AMOUNT discountValue must be greater than 0");
  }
  if (payload.minOrderValue < 0 || payload.maxDiscount < 0 || payload.maxUsage < 0) {
    throw new GraphQLError("minOrderValue, maxDiscount, and maxUsage must not be negative");
  }
};

const loadCouponForOutput = async (id) =>
  Coupon.findById(id).lean({ virtuals: true });

const loadPackageForOutput = async (id) =>
  VoucherPackage.findById(id).lean({ virtuals: true });

export const CouponMutation = {
  async createCoupon(_, { input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    const payload = mapCouponInput(input);
    assertValidDateRange(payload);
    assertValidCouponPayload(payload);
    const created = await Coupon.create(payload);
    return (await loadCouponForOutput(created._id)) || created;
  },
  async updateCoupon(_, { id, input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid coupon id");
    const payload = mapCouponInput(input);
    assertValidDateRange(payload);
    assertValidCouponPayload(payload);
    const updated = await Coupon.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) throw new GraphQLError("Coupon not found");
    return (await loadCouponForOutput(updated._id)) || updated;
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
    return (await loadCouponForOutput(updated._id)) || updated;
  },

  async createVoucherPackage(_, { input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    const payload = mapPackageInput(input);
    assertValidDateRange(payload);
    if (!payload.name || !payload.code || payload.voucherIds.length === 0) {
      throw new GraphQLError("Invalid voucher package input");
    }
    const created = await VoucherPackage.create(payload);
    return (await loadPackageForOutput(created._id)) || created;
  },
  async updateVoucherPackage(_, { id, input }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid package id");
    const payload = mapPackageInput(input);
    assertValidDateRange(payload);
    const updated = await VoucherPackage.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) throw new GraphQLError("Voucher package not found");
    return (await loadPackageForOutput(updated._id)) || updated;
  },
  async deleteVoucherPackage(_, { id }, { user }) {
    requireRole(user, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid package id");
    const rs = await VoucherPackage.deleteOne({ _id: id });
    return rs.deletedCount > 0;
  },
};
