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

export async function ensureSuccessfulRefundCashflow(refund) {
  if (refund.status !== "success" || refund.cashflowId) return null;

  const Cashflow = mongoose.models.Cashflow;
  if (!Cashflow) return null;

  const session = typeof refund.$session === "function" ? refund.$session() : null;
  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    ...(session ? { session } : {}),
  };
  const cashflow = await Cashflow.findOneAndUpdate(
    {
      restaurantId: refund.restaurantId,
      source: "refund",
      "ref.refundId": refund._id,
    },
    {
      $setOnInsert: {
        restaurantId: refund.restaurantId,
        type: "OUTFLOW",
        amount: refund.amount,
        currency: refund.currency || "VND",
        category: "refund",
        subcategory: "other",
        method: refund.method || "cash",
        status: "completed",
        source: "refund",
        ref: {
          kind: "PaymentRefund",
          id: refund._id,
          orderId: refund.orderId || null,
          invoiceId: refund.invoiceId || null,
          paymentTransactionId: refund.paymentTransactionId || null,
          refundId: refund._id,
        },
        note: refund.reason,
        occurredAt: refund.processedAt || new Date(),
        createdBy: refund.processedBy || refund.createdBy || null,
      },
    },
    options,
  );

  if (cashflow?._id) {
    refund.cashflowId = cashflow._id;
    const RefundModel = refund.constructor;
    await RefundModel.updateOne(
      { _id: refund._id, cashflowId: null },
      { $set: { cashflowId: cashflow._id } },
      session ? { session } : undefined,
    );
  }
  return cashflow;
}

PaymentRefundSchema.post("save", ensureSuccessfulRefundCashflow);
PaymentRefundSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
PaymentRefundSchema.index({ paymentTransactionId: 1, status: 1 });

export default mongoose.models.PaymentRefund ||
  mongoose.model("PaymentRefund", PaymentRefundSchema);
