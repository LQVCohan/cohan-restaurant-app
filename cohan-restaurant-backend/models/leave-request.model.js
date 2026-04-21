import mongoose from "mongoose";

const { Schema } = mongoose;

const leaveAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "created",
        "replacement_confirmed",
        "replacement_rejected",
        "approved",
        "rejected",
        "updated",
        "mail_sent",
        "mail_failed",
      ],
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: null },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leaveRequestSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    leaveType: {
      type: String,
      enum: [
        "annual",
        "sick",
        "unpaid",
        "paid_personal",
        "maternity",
        "compensatory",
        "holiday",
        "half_day",
      ],
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startSession: { type: String, enum: ["full", "morning", "afternoon"], default: "full" },
    endSession: { type: String, enum: ["full", "morning", "afternoon"], default: "full" },
    requestedDays: { type: Number, required: true },
    requestedHours: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "pending_replacement_confirmation", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    approverId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    replacementManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    replacementStatus: {
      type: String,
      enum: ["not_required", "pending", "confirmed", "rejected"],
      default: "not_required",
    },
    replacementConfirmedAt: { type: Date, default: null },
    replacementConfirmedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    payrollFlags: {
      isPaidLeave: { type: Boolean, default: false },
      deductLeaveBalance: { type: Boolean, default: false },
      payrollCountable: { type: Boolean, default: false },
      halfDayFactor: { type: Number, default: 1 },
      maternityTreatment: { type: Boolean, default: false },
      holidayTreatment: { type: Boolean, default: false },
      compensatoryTreatment: { type: Boolean, default: false },
      unpaidFactor: { type: Number, default: 0 },
    },
    quotaImpact: {
      deductAnnualDays: { type: Number, default: 0 },
      deductSickDays: { type: Number, default: 0 },
      deductCompensatoryDays: { type: Number, default: 0 },
      totalDeductDays: { type: Number, default: 0 },
    },
    auditLogs: { type: [leaveAuditSchema], default: [] },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });
leaveRequestSchema.index({ restaurantId: 1, status: 1, startDate: -1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
