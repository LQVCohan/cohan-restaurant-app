import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollPayoutSchema = new Schema(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    periodId: { type: Schema.Types.ObjectId, ref: "PayrollPeriod", required: true, index: true },
    payrollItemId: { type: Schema.Types.ObjectId, ref: "PayrollItem", default: null, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    payoutBatchId: { type: Schema.Types.ObjectId, ref: "PayrollPayoutBatch", default: null, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "VND" },
    sourceAccountId: { type: Schema.Types.ObjectId, ref: "RestaurantPayoutAccount", default: null },
    destinationAccountName: { type: String, default: "" },
    destinationBankName: { type: String, default: "" },
    destinationBankCode: { type: String, default: "" },
    destinationAccountNumberMasked: { type: String, default: "" },
    destinationAccountNumberEncrypted: { type: String, select: false, default: "" },
    provider: { type: String, default: "manual", index: true },
    providerTransactionId: { type: String, default: "", index: true },
    requestId: { type: String, default: "", index: true },
    idempotencyKey: { type: String, default: "", index: true },
    status: { type: String, enum: ["pending", "processing", "success", "failed", "cancelled"], default: "pending", index: true },
    failureReason: { type: String, default: "" },
    method: { type: String, enum: ["bank_transfer", "e_wallet", "other"], default: "bank_transfer" },
    note: { type: String, default: "" },
    referenceCode: { type: String, default: "" },
    rawProviderResponse: { type: Schema.Types.Mixed, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

payrollPayoutSchema.index({ restaurantId: 1, periodId: 1, status: 1 });
payrollPayoutSchema.index({ provider: 1, providerTransactionId: 1 }, { unique: true, sparse: true, partialFilterExpression: { providerTransactionId: { $type: "string", $gt: "" } } });
payrollPayoutSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } });

export default mongoose.model("PayrollPayout", payrollPayoutSchema);
