import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const baseOptions = { timestamps: true };

const TimesheetSchema = new Schema(
  {
    shiftId: { type: Types.ObjectId, ref: "Shift", default: null },
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
    workDate: { type: Date, required: true, index: true },
    source: {
      type: String,
      enum: ["quick", "manual", "manual_correction", "system"],
      default: "quick",
    },
    plannedStartTime: { type: Date, default: null },
    plannedEndTime: { type: Date, default: null },
    actualCheckInAt: { type: Date, default: null },
    actualCheckOutAt: { type: Date, default: null },
    latenessMinutes: { type: Number, default: 0 },
    earlyLeaveMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    approvedOvertimeMinutes: { type: Number, default: 0 },
    overtimeApprovalStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    overtimeRequestId: {
      type: Types.ObjectId,
      ref: "OvertimeRequest",
      default: null,
    },
    overtimeApprovalNote: { type: String, default: "" },

    workedMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "scheduled_absent",
        "checked_in",
        "completed",
        "late",
        "early_leave",
        "late_early_leave",
        "unscheduled_checkin",
        "unscheduled_completed",
      ],
      default: "scheduled_absent",
    },
    isOffSchedule: { type: Boolean, default: false },
    note: { type: String, default: "" },
    approved: { type: Boolean, default: false },
    hours: { type: Number, default: 0 },
    wage: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  baseOptions,
);

TimesheetSchema.index(
  { employeeId: 1, workDate: 1, shiftId: 1 },
  {
    unique: true,
    partialFilterExpression: { shiftId: { $exists: true, $ne: null } },
  },
);

TimesheetSchema.index(
  { employeeId: 1, workDate: 1, isOffSchedule: 1 },
  { unique: true, partialFilterExpression: { isOffSchedule: true } },
);

export default mongoose.model("Timesheet", TimesheetSchema);
