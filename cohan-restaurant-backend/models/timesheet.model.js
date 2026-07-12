import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const baseOptions = { timestamps: true };

async function runAttendanceExceptionDetection() {
  const options = this.getOptions?.() || {};
  if (options.skipAttendanceExceptionDetection) return;

  const filter = this.getFilter?.() || {};
  const workDate = filter.workDate || null;
  if (!filter.restaurantId || !workDate?.$gte || !workDate?.$lte) return;

  try {
    const { detectAttendanceExceptionsForRange } = await import(
      "../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    await detectAttendanceExceptionsForRange({
      restaurantId: filter.restaurantId,
      startDate: workDate.$gte,
      endDate: workDate.$lte,
    });
  } catch (error) {
    console.warn(
      "Failed to lazily detect attendance exceptions:",
      error?.message || error,
    );
  }
}

async function syncAttendanceMetricsFromTimestamps() {
  const timingFields = [
    "plannedStartTime",
    "plannedEndTime",
    "actualCheckInAt",
    "actualCheckOutAt",
    "isOffSchedule",
  ];
  const timingChanged =
    this.isNew || timingFields.some((field) => this.isModified(field));
  const hasTimingValue = timingFields
    .slice(0, 4)
    .some((field) => Boolean(this[field]));

  if (!timingChanged || !hasTimingValue) return;

  try {
    const { calculateAttendanceMetrics, deriveAttendanceStatus } = await import(
      "../src/services/attendance/attendanceCalculation.service.js"
    );
    const metrics = calculateAttendanceMetrics({
      plannedStartTime: this.plannedStartTime,
      plannedEndTime: this.plannedEndTime,
      actualCheckInAt: this.actualCheckInAt,
      actualCheckOutAt: this.actualCheckOutAt,
    });

    this.workedMinutes = metrics.workedMinutes;
    this.hours = metrics.hours;
    this.latenessMinutes = metrics.latenessMinutes;
    this.earlyLeaveMinutes = metrics.earlyLeaveMinutes;
    this.overtimeMinutes = metrics.overtimeMinutes;
    this.status = deriveAttendanceStatus({
      actualCheckInAt: this.actualCheckInAt,
      actualCheckOutAt: this.actualCheckOutAt,
      isOffSchedule: this.isOffSchedule,
      latenessMinutes: metrics.latenessMinutes,
      earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    });
  } catch (error) {
    console.warn(
      "Failed to sync attendance metrics from timestamps:",
      error?.message || error,
    );
    throw error;
  }
}

async function syncAttendanceOvertimeState() {
  try {
    const { applyAttendanceOvertimeState } = await import(
      "../src/services/attendance/attendanceOvertimeState.service.js"
    );

    const currentStatus = String(this.overtimeApprovalStatus || "")
      .trim()
      .toLowerCase();
    const forcePending =
      this.isModified("overtimeMinutes") &&
      Number(this.overtimeMinutes || 0) > 0 &&
      ["approved", "rejected"].includes(currentStatus);

    applyAttendanceOvertimeState(this, { forcePending });
  } catch (error) {
    console.warn(
      "Failed to sync attendance overtime state:",
      error?.message || error,
    );
    throw error;
  }
}

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
      enum: ["not_required", "pending", "approved", "rejected"],
      default: "not_required",
      index: true,
    },
    overtimeReviewNote: { type: String, default: "" },
    overtimeReviewedBy: { type: Types.ObjectId, ref: "User", default: null },
    overtimeReviewedAt: { type: Date, default: null },
    overtimeRequestId: {
      type: Types.ObjectId,
      ref: "OvertimeRequest",
      default: null,
    },

    workedMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "scheduled_absent",
        "checked_in",
        "missed_checkout",
        "completed",
        "late",
        "early_leave",
        "late_early_leave",
        "unscheduled_absent",
        "unscheduled_checkin",
        "unscheduled_completed",
      ],
      default: "scheduled_absent",
    },
    isOffSchedule: { type: Boolean, default: false },
    offScheduleReasonCategory: {
      type: String,
      enum: [
        "called_in",
        "manager_requested",
        "emergency_cover",
        "shift_swap",
        "self_initiated",
        "other",
      ],
      default: "other",
    },
    offScheduleReason: { type: String, default: "" },
    offScheduleApprovalStatus: {
      type: String,
      enum: ["not_required", "pending", "approved", "rejected"],
      default: "not_required",
      index: true,
    },
    offScheduleReviewedBy: { type: Types.ObjectId, ref: "User", default: null },
    offScheduleReviewedAt: { type: Date, default: null },
    offScheduleReviewNote: { type: String, default: "" },
    note: { type: String, default: "" },
    approved: { type: Boolean, default: false },
    hours: { type: Number, default: 0 },
    wage: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  baseOptions,
);

TimesheetSchema.virtual("overtimeApprovalNote")
  .get(function getLegacyOvertimeApprovalNote() {
    return this.overtimeReviewNote;
  })
  .set(function setLegacyOvertimeApprovalNote(value) {
    this.overtimeReviewNote = String(value || "").trim();
  });

TimesheetSchema.pre("find", runAttendanceExceptionDetection);
TimesheetSchema.pre("save", syncAttendanceMetricsFromTimestamps);
TimesheetSchema.pre("save", syncAttendanceOvertimeState);

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
