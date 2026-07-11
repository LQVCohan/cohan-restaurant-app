import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

const CashflowSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    type: { type: String, enum: ["INFLOW", "OUTFLOW"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "VND" },
    category: {
      type: String,
      enum: ["sale", "refund", "payroll", "inventory", "operations", "supplier_payment", "adjustment", "other"],
      default: "other",
      index: true,
    },
    subcategory: {
      type: String,
      enum: ["labor", "cogs", "rent", "utility", "maintenance", "marketing", "bank_fee", "tax", "etc", "other"],
      default: "other",
      index: true,
    },
    method: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "e_wallet", "transfer", "provider", "momo", "vnpay", "other"],
      default: "cash",
    },
    status: {
      type: String,
      enum: ["draft", "pending", "completed", "voided"],
      default: "completed",
      index: true,
    },
    source: {
      type: String,
      enum: ["order", "reservation", "payroll", "inventory", "manual", "bank", "refund", "system"],
      default: "system",
      index: true,
    },
    ref: {
      kind: String,
      id: { type: Types.ObjectId },
      orderId: { type: Types.ObjectId },
      orderIds: [{ type: Types.ObjectId }],
      invoiceId: { type: Types.ObjectId },
      payrollPaymentId: { type: Types.ObjectId },
      stockMovementId: { type: Types.ObjectId },
      reconciliationId: { type: Types.ObjectId },
      paymentTransactionId: { type: Types.ObjectId },
      refundId: { type: Types.ObjectId },
    },
    evidenceAttachments: { type: [Schema.Types.Mixed], default: [] },
    note: String,
    meta: { type: Object, default: {} },
    createdBy: { type: Types.ObjectId, ref: "User" },
    approvedBy: { type: Types.ObjectId, ref: "User" },
    approvedAt: Date,
    voidedBy: { type: Types.ObjectId, ref: "User" },
    voidedAt: Date,
    voidReason: String,
    occurredAt: { type: Date, default: Date.now },
  },
  {},
);

CashflowSchema.pre("validate", async function normalizeCashflowClassification() {
  if (!String(this.category || "").trim()) {
    this.category = this.type === "INFLOW" ? "sale" : "other";
  }
  if (!String(this.subcategory || "").trim()) {
    this.subcategory = "other";
  }

  const refKind = String(this.ref?.kind || "").trim().toLowerCase();
  const invoiceId =
    this.ref?.invoiceId || (refKind === "invoice" ? this.ref?.id : null);
  const shouldEnrichInvoiceCashflow =
    this.type === "INFLOW" &&
    invoiceId &&
    this.category === "other" &&
    this.source === "system";

  if (!shouldEnrichInvoiceCashflow) return;

  this.category = "sale";
  this.source = "order";
  this.ref.invoiceId = invoiceId;

  const session = typeof this.$session === "function" ? this.$session() : null;
  let invoiceQuery = mongoose
    .model("Invoice")
    .findById(invoiceId)
    .select("refTransactionId");
  if (session) invoiceQuery = invoiceQuery.session(session);
  const invoice = await invoiceQuery.lean();
  if (!invoice?.refTransactionId) return;

  this.ref.paymentTransactionId = invoice.refTransactionId;
  let transactionQuery = mongoose
    .model("Transaction")
    .findById(invoice.refTransactionId)
    .select("method");
  if (session) transactionQuery = transactionQuery.session(session);
  const transaction = await transactionQuery.lean();
  if (transaction?.method) this.method = transaction.method;
});

CashflowSchema.index({ restaurantId: 1, occurredAt: -1 });
CashflowSchema.index({ restaurantId: 1, source: 1, status: 1 });
CashflowSchema.index({ restaurantId: 1, category: 1, subcategory: 1, occurredAt: -1 });
CashflowSchema.index({ "ref.kind": 1, "ref.id": 1 });
CashflowSchema.index(
  { "ref.refundId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "ref.refundId": { $type: "objectId" },
      source: "refund",
    },
  },
);
CashflowSchema.index(
  { "ref.paymentTransactionId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "ref.paymentTransactionId": { $type: "objectId" },
      source: "reservation",
    },
  },
);
CashflowSchema.index(
  { "ref.paymentTransactionId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "ref.paymentTransactionId": { $type: "objectId" },
      source: "order",
    },
  },
);

export default mongoose.models.Cashflow ||
  mongoose.model("Cashflow", CashflowSchema);
