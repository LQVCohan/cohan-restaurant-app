import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import OrderItemSchema from "./order-item.schema.js";

const { Schema, Types, model } = mongoose;

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
    note: String,
  },
  { _id: false }
);

const OrderSchema = BaseSchemaModel({
  orderCode: { type: String, index: true }, // cùng code cho các đơn gộp
  userId: { type: Types.ObjectId, ref: "User" },
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
  reservationId: { type: Types.ObjectId, ref: "Reservation" },
  orderType: {
    type: String,
    enum: ["dine_in", "takeaway", "delivery", "preorder"],
    default: "dine_in",
  },
  shipping: { type: Schema.Types.Mixed }, // snapshot shipping (fullName, phone, email, address, ...)
  items: { type: [OrderItemSchema], default: [] },
  totals: {
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    service: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  payment: {
    method: String, // cash | bank_transfer | e_wallet | card
    paidAmount: Number,
    currency: { type: String, default: "VND" },
    status: String, // paid | pending | refunded ...
    txnRef: String,
    paidAt: Date,
  },
  statusTimeline: [StatusEventSchema],
  currentStatus: { type: String, default: "draft", required: true },
  note: String,
});

OrderSchema.index({ restaurantId: 1, createdAt: -1 });

export default model("Order", OrderSchema);
