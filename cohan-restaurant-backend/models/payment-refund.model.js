import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

const RefundAuditSchema = new Schema(
  {
    action: { type: String, required: true },
    actorId: { type: Types.ObjectId, ref: "User" },
    previousStatus: String,
    nextStatus: String,
    note: String,
    reason: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const PaymentRefundSchema = BaseSchemaModel({
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
  orderId: { type: Types.ObjectId, ref: "Order", index: true },
  invoiceId: { type: Types.ObjectId, ref: "Invoice", index: true },
  paymentTransactionId: { type: Types.ObjectId, ref: "PaymentTransaction", index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "VND" },
  reason: { type: String, required: true },
  method: {
    type: String,
    enum: ["cash", "bank_transfer", "e_wallet", "provider", "card", "other"],
    default: "cash",
  },
  status: {
    type: String,
    enum: ["pending", "approved", "processing", "success", "failed", "rejected", "cancelled"],
    default: "pending",
    index: true,
  },
  providerRefundId: String,
  createdBy: { type: Types.ObjectId, ref: "User" },
  approvedBy: { type: Types.ObjectId, ref: "User" },
  approvedAt: Date,
  processedBy: { type: Types.ObjectId, ref: "User" },
  processedAt: Date,
  cashflowId: { type: Types.ObjectId, ref: "Cashflow" },
  auditTrail: { type: [RefundAuditSchema], default: [] },
  meta: { type: Schema.Types.Mixed },
});

PaymentRefundSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
PaymentRefundSchema.index({ paymentTransactionId: 1, status: 1 });

export default mongoose.models.PaymentRefund ||
  mongoose.model("PaymentRefund", PaymentRefundSchema);
