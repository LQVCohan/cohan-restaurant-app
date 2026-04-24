import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollAdjustmentSchema = new Schema(
  {
    periodId: { type: Schema.Types.ObjectId, ref: "PayrollPeriod", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["allowance", "bonus", "deduction", "advance", "other_addition", "other_deduction", "other"], default: "other_addition" },
    amount: { type: Number, required: true, default: 0 },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

payrollAdjustmentSchema.index({ periodId: 1, employeeId: 1 });

export default mongoose.model("PayrollAdjustment", payrollAdjustmentSchema);
