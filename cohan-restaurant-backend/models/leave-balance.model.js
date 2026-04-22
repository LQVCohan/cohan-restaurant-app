import mongoose from "mongoose";

const { Schema } = mongoose;

const leaveBalanceSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    year: { type: Number, required: true, index: true },
    annualEntitledDays: { type: Number, default: 12 },
    annualUsedDays: { type: Number, default: 0 },
    annualRemainingDays: { type: Number, default: 12 },
    sickEntitledDays: { type: Number, default: 6 },
    sickUsedDays: { type: Number, default: 0 },
    sickRemainingDays: { type: Number, default: 6 },
    compensatoryEntitledDays: { type: Number, default: 0 },
    compensatoryUsedDays: { type: Number, default: 0 },
    compensatoryRemainingDays: { type: Number, default: 0 },
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

export default mongoose.model("LeaveBalance", leaveBalanceSchema);
