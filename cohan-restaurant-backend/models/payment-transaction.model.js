import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
const { Types } = mongoose;

const TransactionSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    orderId: { type: Types.ObjectId, ref: "Order" },
    orderIds: [{ type: Types.ObjectId, ref: "Order" }],
    invoiceId: { type: Types.ObjectId, ref: "Invoice" },
    userId: { type: Types.ObjectId, ref: "User" },
    method: {
      type: String,
      enum: ["cash", "card", "transfer", "bank_transfer", "e_wallet", "provider", "momo", "vnpay", "other"],
      required: true,
    },
    paidAmount: { type: Number, required: true },
    changeAmount: { type: Number, default: 0 },
    currency: { type: String, default: "VND" },
    status: {
      type: String,
      enum: ["SUCCESS", "PENDING", "FAILED", "CANCELED"],
      default: "SUCCESS",
    },
    txnRef: { type: String }, // Mã giao dịch từ bên thứ 3 (VD: VNPay)
    externalRef: { type: String },
    note: String,
    createdBy: { type: Types.ObjectId, ref: "User" },
    refundedAmount: { type: Number, default: 0 },
    refundStatus: { type: String, enum: ["none", "partial_refunded", "refunded"], default: "none" },
    refundIds: [{ type: Types.ObjectId, ref: "PaymentRefund" }],
    meta: { type: mongoose.Schema.Types.Mixed },
    paidAt: { type: Date, default: Date.now },
  },
  {}
);

export async function ensurePaymentTransactionCashflow(doc) {
  if (doc.status !== "SUCCESS") return null;

  const orderIds = Array.isArray(doc.orderIds) ? doc.orderIds.filter(Boolean) : [];
  const hasOrders = Boolean(doc.orderId) || orderIds.length > 0;
  const isReservationDeposit =
    !hasOrders && String(doc.note || "").startsWith("Reservation deposit ");
  if (!isReservationDeposit) return null;

  const Cashflow = mongoose.models.Cashflow;
  if (!Cashflow) return null;

  const session = typeof doc.$session === "function" ? doc.$session() : null;
  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    ...(session ? { session } : {}),
  };
  return Cashflow.findOneAndUpdate(
    {
      restaurantId: doc.restaurantId,
      source: "reservation",
      "ref.paymentTransactionId": doc._id,
    },
    {
      $setOnInsert: {
        restaurantId: doc.restaurantId,
        type: "INFLOW",
        amount: doc.paidAmount,
        currency: doc.currency || "VND",
        category: "sale",
        subcategory: "other",
        method: doc.method,
        status: "completed",
        source: "reservation",
        ref: {
          kind: "PaymentTransaction",
          id: doc._id,
          paymentTransactionId: doc._id,
        },
        note: doc.note || "Reservation deposit",
        occurredAt: doc.paidAt || new Date(),
        createdBy: doc.createdBy || doc.userId || null,
      },
    },
    options,
  );
}

TransactionSchema.post("save", ensurePaymentTransactionCashflow);

TransactionSchema.index({ restaurantId: 1, orderId: 1 });
TransactionSchema.index({ restaurantId: 1, orderIds: 1 });
TransactionSchema.index({ paidAt: -1 });
TransactionSchema.index({ restaurantId: 1, txnRef: 1 }, { unique: true, sparse: true });
TransactionSchema.index(
  { restaurantId: 1, userId: 1, method: 1, externalRef: 1 },
  { unique: true, partialFilterExpression: { method: "e_wallet", externalRef: { $type: "string" } } },
);

export default mongoose.models.Transaction ||
  mongoose.model("Transaction", TransactionSchema);
