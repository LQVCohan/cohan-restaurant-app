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



const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            Number.isFinite(value[0]) &&
            Number.isFinite(value[1]) &&
            value[0] >= -180 &&
            value[0] <= 180 &&
            value[1] >= -90 &&
            value[1] <= 90
          );
        },
        message: "location.coordinates must be [lng, lat]",
      },
    },
  },
  { _id: false }
);

function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

const paymentProviderConfigSchema = new mongoose.Schema({
  provider: { type: String, enum: ["momo", "vnpay"], required: true },
  label: { type: String, default: "" },
  active: { type: Boolean, default: true },
  priority: { type: Number, default: 0 },
  mode: { type: String, enum: ["sandbox", "production"], default: "sandbox" },
}, { _id: false });

const paymentSettingsSchema = new mongoose.Schema({
  defaultProvider: { type: String, enum: ["momo", "vnpay"], default: "momo" },
  providers: {
    type: [paymentProviderConfigSchema],
    default: () => ([
      { provider: "momo", label: "MoMo", active: true, priority: 1, mode: "sandbox" },
      { provider: "vnpay", label: "VNPAY", active: true, priority: 2, mode: "sandbox" },
    ]),
  },
}, { _id: false });

const reservationSettingsSchema = new mongoose.Schema({
  baseDepositAmount: { type: Number, default: 0, min: 0 },
  menuDepositPercent: { type: Number, default: 50, min: 0, max: 100 },
  changeTimeFee: { type: Number, default: 0, min: 0 },
  changeTableFee: { type: Number, default: 0, min: 0 },
  vatRate: { type: Number, default: 0, min: 0, max: 1 },
  serviceFee: { type: Number, default: 0, min: 0 },
}, { _id: false });

const AI_CHATBOT_DEFAULT_WELCOME = "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.";
const AI_CHATBOT_DEFAULT_QUICK_REPLIES = [
  "Gợi ý món bán chạy cho tôi",
  "Tôi muốn đặt bàn",
  "Có mã giảm giá nào không?",
];

const aiChatbotSettingsSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  welcomeMessage: { type: String, default: AI_CHATBOT_DEFAULT_WELCOME, trim: true, maxlength: 500 },
  starterQuickReplies: {
    type: [String],
    default: () => [...AI_CHATBOT_DEFAULT_QUICK_REPLIES],
    validate: {
      validator: (items) => Array.isArray(items) && items.length <= 6,
      message: "starterQuickReplies must have at most 6 items",
    },
  },
  handoffEnabled: { type: Boolean, default: true },
  handoffUnavailableMessage: { type: String, default: "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.", trim: true, maxlength: 500 },
  lowConfidenceHandoffThreshold: { type: Number, default: 0.6, min: 0, max: 1 },
  fallbackMessage: { type: String, default: "", trim: true, maxlength: 800 },
  updatedAt: { type: Date, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { _id: false });

aiChatbotSettingsSchema.path("starterQuickReplies").set((items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => String(item || "").trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 6);
});

const restaurantSchema = BaseSchemaModel({
  name: { type: String, required: true },
  avatar: String,
  coverImage: String,
  spaceImages: [String],
  vrTourUrl: String,
  address: addressSchema,
  location: locationSchema,
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
  // Deprecated: legacy lifecycle field, keep for backward compatibility
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  businessStatus: { type: String, enum: ["active", "inactive", "suspended", "archived"], default: "active" },
  publicationStatus: { type: String, enum: ["draft", "published", "hidden"], default: "published" },
  operationalStatus: { type: String, enum: ["normal", "paused", "maintenance", "holiday"], default: "normal" },
  timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
  weeklyOpeningHours: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  specialHours: { type: [mongoose.Schema.Types.Mixed], default: () => [] },
  capabilities: { type: mongoose.Schema.Types.Mixed, default: () => ({ acceptsReservations: true, acceptsOrders: true, acceptsTableOrders: true, acceptsDelivery: false, acceptsPickup: false }) },
  reservationPolicy: { type: mongoose.Schema.Types.Mixed, default: () => ({ allowWhenClosed: true, minAdvanceMinutes: 30, maxAdvanceDays: 30 }) },
  orderPolicy: { type: mongoose.Schema.Types.Mixed, default: () => ({ allowWhenClosed: false, minAdvanceMinutes: 0 }) },
  reviewCount: { type: Number, default: 0, min: 0 },
  reservationSettings: { type: reservationSettingsSchema, default: () => ({}) },
  aiChatbotSettings: { type: aiChatbotSettingsSchema, default: () => ({}) },
  paymentSettings: { type: paymentSettingsSchema, default: () => ({}) },
  defaultCurrency: { type: String, enum: ["VND", "USD"], default: "VND" },
  manualUsdToVndRate: { type: Number, default: 26000, min: 1 },

  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", index: true },
});

restaurantSchema.index({ status: 1, avgRating: -1 });
restaurantSchema.index({ businessStatus: 1, publicationStatus: 1, operationalStatus: 1 });
restaurantSchema.index({ reviewCount: -1 });
restaurantSchema.index({ managerId: 1 });
restaurantSchema.index({ brandId: 1, createdAt: -1 });
restaurantSchema.index({ "address.city": 1, "address.district": 1 });
restaurantSchema.index({ "address.ward": 1, "address.postalCode": 1 });
restaurantSchema.index({ cuisineType: 1 });
restaurantSchema.index({ "address.lat": 1, "address.lng": 1 });
restaurantSchema.index({ location: "2dsphere" });


restaurantSchema.pre("validate", function syncLocationFromAddress(next) {
  const lat = Number(this?.address?.lat);
  const lng = Number(this?.address?.lng);
  if (isValidLatLng(lat, lng)) {
    this.location = { type: "Point", coordinates: [lng, lat] };
  } else {
    this.location = undefined;
  }
  next();
});

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
