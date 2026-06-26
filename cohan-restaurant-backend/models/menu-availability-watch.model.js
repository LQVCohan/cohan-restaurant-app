import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

const MenuAvailabilityWatchSchema = BaseSchemaModel({
  restaurantId: {
    type: Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  menuItemId: {
    type: Types.ObjectId,
    ref: "MenuItem",
    required: true,
    index: true,
  },
  servingKey: {
    type: String,
    trim: true,
    default: "portion",
    index: true,
  },
  desiredQuantity: {
    type: Number,
    min: 1,
    default: 1,
  },
  userId: {
    type: Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  tableId: {
    type: Types.ObjectId,
    ref: "Table",
    default: null,
    index: true,
  },
  tableCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
    index: true,
  },
  source: {
    type: String,
    enum: ["online", "dine_in", "pos", "staff_remote", "other"],
    default: "other",
    index: true,
  },
  status: {
    type: String,
    enum: ["watching", "notified", "cancelled", "expired"],
    default: "watching",
    index: true,
  },
  reason: {
    type: String,
    trim: true,
    default: "out_of_stock",
  },
  note: {
    type: String,
    trim: true,
    default: "",
  },
  lastOutOfStockAt: {
    type: Date,
    default: Date.now,
  },
  notifiedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  clientMeta: {
    type: Schema.Types.Mixed,
    default: null,
  },
});

MenuAvailabilityWatchSchema.index({
  restaurantId: 1,
  menuItemId: 1,
  servingKey: 1,
  status: 1,
  createdAt: 1,
});

MenuAvailabilityWatchSchema.index({
  userId: 1,
  status: 1,
  expiresAt: 1,
});

MenuAvailabilityWatchSchema.index({
  restaurantId: 1,
  tableId: 1,
  tableCode: 1,
  status: 1,
});

MenuAvailabilityWatchSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 7 },
);

export default mongoose.models.MenuAvailabilityWatch ||
  mongoose.model("MenuAvailabilityWatch", MenuAvailabilityWatchSchema);
