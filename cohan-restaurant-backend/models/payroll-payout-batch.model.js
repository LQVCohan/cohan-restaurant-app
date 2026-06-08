import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollPayoutBatchSchema = new Schema(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    periodId: { type: Schema.Types.ObjectId, ref: "PayrollPeriod", required: true, index: true },
    totalAmount: { type: Number, default: 0 },
    totalEmployees: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "pending", "processing", "success", "partial_success", "failed", "cancelled"], default: "pending", index: true },
    method: { type: String, default: "bank_transfer" },
    provider: { type: String, default: "manual" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    submittedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    note: { type: String, default: "" },
    rawProviderResponse: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

payrollPayoutBatchSchema.index({ restaurantId: 1, periodId: 1, createdAt: -1 });

export default mongoose.model("PayrollPayoutBatch", payrollPayoutBatchSchema);
