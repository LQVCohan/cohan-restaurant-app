import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  ward: String,
  district: String,
  city: String,
  country: { type: String, default: "Vietnam" },
  postalCode: String,
  lat: Number,
  lng: Number,
}, { _id: false });

const BrandSchema = BaseSchemaModel({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  description: String,
  logoUrl: String,
  coverImage: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  businessName: String,
  businessTaxCode: String,
  businessEmail: String,
  businessPhone: String,
  address: addressSchema,
  status: { type: String, enum: ["active", "inactive", "suspended"], default: "active", index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

BrandSchema.index({ slug: 1 }, { unique: true });
BrandSchema.index({ ownerId: 1, createdAt: -1 });
BrandSchema.index({ status: 1 });

export default mongoose.model("Brand", BrandSchema);
