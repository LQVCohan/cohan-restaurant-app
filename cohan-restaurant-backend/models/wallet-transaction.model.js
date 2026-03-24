import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema } = mongoose;

const WalletTransactionSchema = BaseSchemaModel({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: {
    type: String,
    enum: ["TOPUP", "PAYMENT", "REFUND", "ADJUSTMENT"],
    required: true,
    index: true,
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "VND" },
  balanceBefore: { type: Number, required: true, min: 0 },
  balanceAfter: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ["SUCCESS", "FAILED", "PENDING"],
    default: "SUCCESS",
    index: true,
  },
  referenceType: { type: String, trim: true },
  referenceId: { type: Schema.Types.ObjectId },
  orderIds: [{ type: Schema.Types.ObjectId, ref: "Order" }],
  metadata: { type: Schema.Types.Mixed, default: {} },
});

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });

export default
  mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", WalletTransactionSchema);
