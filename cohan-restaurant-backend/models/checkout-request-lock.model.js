import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const CheckoutRequestLockSchema = BaseSchemaModel({
  key: { type: String, required: true, unique: true },
  requestFingerprint: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["PROCESSING", "COMPLETED", "FAILED"], default: "PROCESSING" },
  checkoutCode: String,
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  attempts: { type: Number, default: 1 },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  failedAt: Date,
  errorCode: String,
  errorMessage: String,
  expiresAt: { type: Date, required: true },
});

CheckoutRequestLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.CheckoutRequestLock || mongoose.model("CheckoutRequestLock", CheckoutRequestLockSchema);
