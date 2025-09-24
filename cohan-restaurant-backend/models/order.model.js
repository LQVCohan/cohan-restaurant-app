// models/order.model.js (ESM)
import mongoose from "mongoose";
import OrderItemSchema from "./order-item.schema.js"; // lưu ý: ESM cần .js
const { Schema, model, Types } = mongoose;

const StatusEventSchema = new Schema(
  {
    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
      required: true,
    },
    at: { type: Date, default: Date.now },
    byUserId: { type: Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    reservationId: { type: Types.ObjectId, ref: "Reservation" },
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },
    orderType: {
      type: String,
      enum: ["dine_in", "takeaway", "delivery", "preorder"],
      default: "dine_in",
    },
    items: [OrderItemSchema],
    totals: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      service: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },
    statusTimeline: [StatusEventSchema],
    currentStatus: { type: String, default: "draft" },
    note: String,
  },
  { timestamps: true }
);

OrderSchema.index({ restaurantId: 1, createdAt: -1 });

export default model("Order", OrderSchema);
