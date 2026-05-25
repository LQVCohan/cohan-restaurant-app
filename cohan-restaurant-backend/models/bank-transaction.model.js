import mongoose from "mongoose";

const bankTransactionSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "restaurant" },
  transactionId: { type: String },
  bankAccountNumber: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: "VND" },
  description: { type: String },
  transferContent: { type: String },
  fingerprint: { type: String },
  occurredAt: { type: Date },
  raw: { type: mongoose.Schema.Types.Mixed },
  matchedPaymentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "payment_session" },
  matchStatus: { type: String, enum: ["unmatched", "matched", "amount_mismatch", "duplicate", "ignored"], default: "unmatched" },
}, { timestamps: true });
bankTransactionSchema.index({ provider: 1, transactionId: 1 }, { unique: true, sparse: true });
bankTransactionSchema.index({ provider: 1, fingerprint: 1 }, { unique: true, sparse: true });
bankTransactionSchema.index({ matchedPaymentSessionId: 1 });
bankTransactionSchema.index({ matchStatus: 1, createdAt: -1 });

export default mongoose.models.bank_transaction || mongoose.model("bank_transaction", bankTransactionSchema);
