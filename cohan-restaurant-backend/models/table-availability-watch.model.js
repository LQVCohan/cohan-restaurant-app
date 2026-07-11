import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Types } = mongoose;

const TableAvailabilityWatchSchema = BaseSchemaModel({
  restaurantId: {
    type: Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  tableId: {
    type: Types.ObjectId,
    ref: "Table",
    required: true,
    index: true,
  },
  tableCode: {
    type: String,
    trim: true,
    uppercase: true,
    required: true,
  },
  userId: {
    type: Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["watching", "notified", "cancelled", "expired"],
    default: "watching",
    index: true,
  },
  notifiedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
});

TableAvailabilityWatchSchema.index({
  tableId: 1,
  status: 1,
  expiresAt: 1,
  createdAt: 1,
});

TableAvailabilityWatchSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 7 },
);

export default mongoose.models.TableAvailabilityWatch ||
  mongoose.model("TableAvailabilityWatch", TableAvailabilityWatchSchema);
