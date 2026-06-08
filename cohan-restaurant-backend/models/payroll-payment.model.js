import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollPaymentSchema = new Schema(
  {
    periodId: { type: Schema.Types.ObjectId, ref: "PayrollPeriod", required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    payrollItemId: { type: Schema.Types.ObjectId, ref: "PayrollItem", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, default: "" },
    paidAt: { type: Date, default: Date.now, index: true },
    note: { type: String, default: "" },
    referenceCode: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    idempotencyKey: { type: String, default: "", index: true },
    payoutId: { type: Schema.Types.ObjectId, ref: "PayrollPayout", default: null, index: true },
  },
  { timestamps: true },
);

payrollPaymentSchema.index({ periodId: 1, employeeId: 1, paidAt: -1 });
payrollPaymentSchema.index({ restaurantId: 1, paidAt: -1 });
payrollPaymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } });
payrollPaymentSchema.index({ payoutId: 1 }, { unique: true, sparse: true, partialFilterExpression: { payoutId: { $exists: true, $ne: null } } });

export default mongoose.model("PayrollPayment", payrollPaymentSchema);
