import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollPeriodSchema = new Schema(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, default: "" },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "finalized", "paying", "paid", "locked"],
      default: "draft",
      index: true,
    },
    settingsSnapshot: { type: Schema.Types.Mixed, default: {} },
    policySnapshot: { type: Schema.Types.Mixed, default: {} },
    statsSnapshot: { type: Schema.Types.Mixed, default: {} },
    validationSnapshot: { type: Schema.Types.Mixed, default: null },
    calculationVersion: { type: String, default: "payroll_v1" },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

payrollPeriodSchema.index({ restaurantId: 1, startDate: 1, endDate: 1 }, { unique: true });

export default mongoose.model("PayrollPeriod", payrollPeriodSchema);
