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
  postalCode: String,
  lat: Number,
  lng: Number,
});

const reservationSettingsSchema = new mongoose.Schema({
  baseDepositAmount: { type: Number, default: 0, min: 0 },
  menuDepositPercent: { type: Number, default: 50, min: 0, max: 100 },
  changeTimeFee: { type: Number, default: 0, min: 0 },
  changeTableFee: { type: Number, default: 0, min: 0 },
  vatRate: { type: Number, default: 0, min: 0, max: 1 },
  serviceFee: { type: Number, default: 0, min: 0 },
}, { _id: false });

const restaurantSchema = BaseSchemaModel({
  name: { type: String, required: true },
  avatar: String,
  coverImage: String,
  spaceImages: [String],
  vrTourUrl: String,
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
  avgRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  reservationSettings: { type: reservationSettingsSchema, default: () => ({}) },

  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
});

restaurantSchema.index({ status: 1, avgRating: -1 });
restaurantSchema.index({ "address.city": 1, "address.district": 1 });
restaurantSchema.index({ "address.ward": 1, "address.postalCode": 1 });
restaurantSchema.index({ cuisineType: 1 });
restaurantSchema.index({ "address.lat": 1, "address.lng": 1 });

/** 🔍 TEXT INDEX cho search nhà hàng + location */
restaurantSchema.index({
  name: "text",
  description: "text",
  cuisineType: "text",
  "address.line1": "text",
  "address.ward": "text",
  "address.district": "text",
  "address.city": "text",
  "address.postalCode": "text",
});

export default mongoose.model("Restaurant", restaurantSchema);
