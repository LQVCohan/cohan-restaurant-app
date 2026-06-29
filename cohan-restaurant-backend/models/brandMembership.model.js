import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const BrandMembershipSchema = BaseSchemaModel({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["owner", "admin", "manager", "staff"], default: "staff", index: true },
  restaurantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }],
  status: { type: String, enum: ["active", "inactive", "invited"], default: "active", index: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

BrandMembershipSchema.index({ brandId: 1, userId: 1 }, { unique: true });
BrandMembershipSchema.index({ userId: 1, status: 1 });
BrandMembershipSchema.index({ brandId: 1, role: 1 });

export default mongoose.model("BrandMembership", BrandMembershipSchema);
