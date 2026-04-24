import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const OVERTIME_STATUSES = [
  "pending_employee_confirmation",
  "pending_approval",
  "approved",
  "rejected",
  "cancelled",
  "completed",
  "payroll_locked",
];

const OVERTIME_TYPES = [
  "weekday",
  "weekend",
  "holiday",
  "night",
  "emergency",
  "other",
];

const OVERTIME_AUDIT_ACTIONS = [
  "overtime.create",
  "overtime.employee_confirm",
  "overtime.approve",
  "overtime.reject",
  "overtime.cancel",
  "overtime.complete",
  "overtime.apply_to_timesheet",
];

const OvertimeAuditLogSchema = new Schema(
  {
    action: {
      type: String,
      enum: OVERTIME_AUDIT_ACTIONS,
      required: true,
    },
    actorId: { type: Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "" },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const OvertimeRequestSchema = new Schema(
  {
    employeeId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    shiftId: {
      type: Types.ObjectId,
      ref: "Shift",
      default: null,
      index: true,
    },
    timesheetId: {
      type: Types.ObjectId,
      ref: "Timesheet",
      default: null,
      index: true,
    },

    workDate: {
      type: Date,
      required: true,
      index: true,
    },

    plannedStartTime: { type: Date, required: true },
    plannedEndTime: { type: Date, required: true },
    plannedOvertimeMinutes: { type: Number, default: 0 },

    actualStartTime: { type: Date, default: null },
    actualEndTime: { type: Date, default: null },
    actualOvertimeMinutes: { type: Number, default: 0 },

    approvedOvertimeMinutes: { type: Number, default: 0 },

    overtimeType: {
      type: String,
      enum: OVERTIME_TYPES,
      default: "weekday",
      index: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: OVERTIME_STATUSES,
      default: "pending_approval",
      index: true,
    },

    employeeConfirmationRequired: { type: Boolean, default: false },
    employeeConfirmedAt: { type: Date, default: null },
    employeeConfirmedBy: { type: Types.ObjectId, ref: "User", default: null },
    employeeConfirmationNote: { type: String, default: "" },

    requestedBy: { type: Types.ObjectId, ref: "User", default: null },
    requestedByRole: { type: String, default: "" },
    requestedAt: { type: Date, default: Date.now },

    approvedBy: { type: Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvalNote: { type: String, default: "" },

    rejectedBy: { type: Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },

    cancelledBy: { type: Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: "" },

    completedBy: { type: Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
    completionNote: { type: String, default: "" },

    payrollPeriodId: {
      type: Types.ObjectId,
      ref: "PayrollPeriod",
      default: null,
    },

    auditLogs: {
      type: [OvertimeAuditLogSchema],
      default: [],
    },
  },
  { timestamps: true },
);

OvertimeRequestSchema.index({ restaurantId: 1, workDate: -1 });
OvertimeRequestSchema.index({ employeeId: 1, workDate: -1 });
OvertimeRequestSchema.index({ restaurantId: 1, status: 1, workDate: -1 });
OvertimeRequestSchema.index({ shiftId: 1, employeeId: 1 });

export const OVERTIME_REQUEST_STATUSES = OVERTIME_STATUSES;
export const OVERTIME_REQUEST_TYPES = OVERTIME_TYPES;

export default mongoose.model("OvertimeRequest", OvertimeRequestSchema);
