// src/models/restaurant.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  ward: String,
  district: String,
  city: String,
  country: String,
});
const restaurantSchema = BaseSchemaModel({
  name: { type: String, required: true },
  avatar: String,
  coverImage: String,
  spaceImages: [String],
  address: addressSchema,
  phone: String,
  email: String,
  featuredMenu: [String],
  amenities: [String],
  seatingCapacity: Number,
  priceRange: String,
  openingHours: String,
  closingHours: String,
  description: String,
  notesOnHours: String,
  notesOnAmenities: String,
  cuisineType: String,
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // bắt buộc có quản lý
  },
});
restaurantSchema.index(
  { managerId: 1 },
  {
    unique: true,
    partialFilterExpression: { managerId: { $type: "objectId" } },
  }
);
export default mongoose.model("Restaurant", restaurantSchema);
