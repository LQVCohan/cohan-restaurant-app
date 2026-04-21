import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollItemSchema = new Schema(
  {
    periodId: { type: Schema.Types.ObjectId, ref: "PayrollPeriod", required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeName: { type: String, default: "" },
    employeeCode: { type: String, default: "" },
    role: { type: String, default: "" },
    department: { type: String, default: "" },
    avatar: { type: String, default: null },
    breakdown: { type: Schema.Types.Mixed, default: {} },
    warningMessages: { type: [String], default: [] },
    status: { type: String, enum: ["draft", "finalized", "locked", "paid"], default: "draft" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

payrollItemSchema.index({ periodId: 1, employeeId: 1 }, { unique: true });

export default mongoose.model("PayrollItem", payrollItemSchema);
