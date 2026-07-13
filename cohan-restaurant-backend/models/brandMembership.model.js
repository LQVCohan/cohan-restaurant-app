import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const normalizeRestaurantIds = (restaurantIds = []) => [...new Set((restaurantIds || []).filter(Boolean).map(String))];

export function validateBrandMembershipScope({ role, restaurantIds = [] } = {}) {
  const ids = normalizeRestaurantIds(restaurantIds);
  if (role === "owner") return [];
  if (role === "admin") return [];
  if (role === "manager" && ids.length !== 1) throw new Error("Manager phải phụ trách đúng 1 nhà hàng");
  if (role === "staff" && ids.length < 1) throw new Error("Staff phải được gán ít nhất 1 nhà hàng");
  return ids;
}

const BrandMembershipSchema = BaseSchemaModel({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["owner", "admin", "manager", "staff"], default: "staff", index: true },
  restaurantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }],
  status: { type: String, enum: ["active", "inactive", "invited"], default: "active", index: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  inviteTokenHash: { type: String, default: null },
  inviteTokenExp: { type: Date, default: null },
  invitedAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  revokedReason: { type: String, trim: true, maxlength: 500, default: null },
  revokedFromStatus: { type: String, enum: ["active", "invited"], default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

BrandMembershipSchema.pre("validate", function validateScope(next) {
  try {
    this.restaurantIds = validateBrandMembershipScope({ role: this.role, restaurantIds: this.restaurantIds });
    next();
  } catch (error) {
    next(error);
  }
});

BrandMembershipSchema.index({ brandId: 1, userId: 1 }, { unique: true });
BrandMembershipSchema.index({ userId: 1, status: 1 });
BrandMembershipSchema.index({ brandId: 1, role: 1 });
BrandMembershipSchema.index(
  { brandId: 1, status: 1, role: 1, restaurantIds: 1, createdAt: -1 },
  { name: "brand_member_directory_filters" },
);
BrandMembershipSchema.index({ inviteTokenHash: 1 }, { sparse: true });
BrandMembershipSchema.index(
  { brandId: 1, role: 1, status: 1, restaurantIds: 1 },
  { partialFilterExpression: { role: "manager", status: "active" } },
);

export default mongoose.model("BrandMembership", BrandMembershipSchema);
