import mongoose from "mongoose";

const paymentReconciliationSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant" },
  paymentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "payment_session" },
  provider: { type: String },
  expectedAmount: { type: Number },
  receivedAmount: { type: Number },
  varianceAmount: { type: Number },
  status: { type: String, enum: ["matched", "amount_mismatch", "unmatched", "duplicate", "resolved", "ignored"], required: true },
  bankTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "bank_transaction" },
  paymentReference: { type: String },
  matchedBy: { type: String, default: "webhook" },
  matchedAt: { type: Date },
  raw: { type: mongoose.Schema.Types.Mixed },
  note: { type: String },
  matchConfidence: { type: Number, default: 0 },
  matchReason: { type: String },
  candidatePaymentSessionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "payment_session" }],
  candidatePaymentTransactionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }],
  candidateMatches: { type: [mongoose.Schema.Types.Mixed], default: [] },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  resolvedAt: { type: Date },
  resolution: { type: String },
  auditTrail: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });
paymentReconciliationSchema.index({ bankTransactionId: 1 }, { unique: true, sparse: true });

export default mongoose.models.payment_reconciliation || mongoose.model("payment_reconciliation", paymentReconciliationSchema);
