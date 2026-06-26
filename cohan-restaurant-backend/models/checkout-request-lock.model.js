import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const CheckoutRequestLockSchema = BaseSchemaModel({
  key: { type: String, required: true, trim: true, unique: true, index: true },
  requestFingerprint: { type: String, required: true, index: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["PROCESSING", "COMPLETED", "FAILED"],
    default: "PROCESSING",
    required: true,
    index: true,
  },
  checkoutCode: String,
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  attempts: { type: Number, default: 1, min: 1 },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  failedAt: Date,
  errorCode: String,
  errorMessage: String,
  expiresAt: { type: Date, required: true },
});

CheckoutRequestLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
CheckoutRequestLockSchema.index({ userId: 1, requestFingerprint: 1, createdAt: -1 });

export default
  mongoose.models.CheckoutRequestLock ||
  mongoose.model("CheckoutRequestLock", CheckoutRequestLockSchema);
