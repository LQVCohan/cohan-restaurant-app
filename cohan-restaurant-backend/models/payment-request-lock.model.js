import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const PaymentRequestLockSchema = BaseSchemaModel({
  key: { type: String, required: true, trim: true, unique: true, index: true },
  operation: { type: String, required: true, trim: true, index: true },
  requestFingerprint: { type: String, required: true, index: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    index: true,
  },
  status: {
    type: String,
    enum: ["PROCESSING", "COMPLETED", "FAILED"],
    default: "PROCESSING",
    required: true,
    index: true,
  },
  resultPayload: { type: mongoose.Schema.Types.Mixed },
  attempts: { type: Number, default: 1, min: 1 },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  failedAt: Date,
  errorCode: String,
  errorMessage: String,
  expiresAt: { type: Date, required: true },
});

PaymentRequestLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PaymentRequestLockSchema.index({ userId: 1, operation: 1, createdAt: -1 });
PaymentRequestLockSchema.index({ requestFingerprint: 1, createdAt: -1 });

export default
  mongoose.models.PaymentRequestLock ||
  mongoose.model("PaymentRequestLock", PaymentRequestLockSchema);
