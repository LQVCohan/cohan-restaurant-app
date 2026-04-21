import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollSettingSchema = new Schema(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      unique: true,
      index: true,
    },
    standardWorkDaysPerMonth: { type: Number, default: 26 },
    standardHoursPerDay: { type: Number, default: 8 },
    overtimeMultiplierWeekday: { type: Number, default: 1.5 },
    overtimeMultiplierWeekend: { type: Number, default: 2 },
    overtimeMultiplierHoliday: { type: Number, default: 3 },
    latenessPenaltyPerMinute: { type: Number, default: 0 },
    earlyLeavePenaltyPerMinute: { type: Number, default: 0 },
    unpaidLeaveDeductionPerDay: { type: Number, default: 0 },
    defaultAllowance: { type: Number, default: 0 },
    allowPaidLeaveInWorkDays: { type: Boolean, default: true },
    defaultBonus: { type: Number, default: 0 },
    defaultDeduction: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("PayrollSetting", payrollSettingSchema);
