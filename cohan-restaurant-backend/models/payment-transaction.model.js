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
      enum: ["cash", "card", "transfer", "bank_transfer", "e_wallet", "momo", "vnpay", "other"],
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
    refundedAmount: { type: Number, default: 0 },
    refundStatus: { type: String, enum: ["none", "partial_refunded", "refunded"], default: "none" },
    refundIds: [{ type: Types.ObjectId, ref: "PaymentRefund" }],
    meta: { type: mongoose.Schema.Types.Mixed },
    paidAt: { type: Date, default: Date.now },
  },
  {}
);

TransactionSchema.post("save", async function recordReservationDepositCashflow(doc) {
  const hasOrders = Boolean(doc.orderId) || (Array.isArray(doc.orderIds) && doc.orderIds.length > 0);
  const isReservationDeposit = String(doc.note || "").startsWith("Reservation deposit ");
  if (doc.status !== "SUCCESS" || hasOrders || !isReservationDeposit) return;

  const Cashflow = mongoose.models.Cashflow;
  if (!Cashflow) return;

  const session = typeof doc.$session === "function" ? doc.$session() : null;
  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    ...(session ? { session } : {}),
  };
  await Cashflow.findOneAndUpdate(
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
        note: doc.note,
        occurredAt: doc.paidAt || new Date(),
        createdBy: doc.createdBy || doc.userId || null,
      },
    },
    options,
  );
});

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
