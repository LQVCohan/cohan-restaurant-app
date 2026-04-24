import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const AUDIT_LOG_ACTIONS = [
  "attendance_correction.create",
  "attendance_correction.approve",
  "attendance_correction.apply",
  "attendance_correction.reject",
  "attendance_correction.cancel",
];

const CORRECTION_TYPES = [
  "missing_check_in",
  "missing_check_out",
  "wrong_check_in",
  "wrong_check_out",
  "wrong_check_in_out",
  "off_schedule_work",
  "other",
];

const CORRECTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "applied",
];

const AttendanceCorrectionAuditLogSchema = new Schema(
  {
    action: {
      type: String,
      enum: AUDIT_LOG_ACTIONS,
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

const AttendanceCorrectionRequestSchema = new Schema(
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

    timesheetId: {
      type: Types.ObjectId,
      ref: "Timesheet",
      default: null,
      index: true,
    },
    shiftId: {
      type: Types.ObjectId,
      ref: "Shift",
      default: null,
      index: true,
    },

    workDate: {
      type: Date,
      required: true,
      index: true,
    },

    correctionType: {
      type: String,
      enum: CORRECTION_TYPES,
      required: true,
      index: true,
    },

    originalCheckInAt: { type: Date, default: null },
    originalCheckOutAt: { type: Date, default: null },
    requestedCheckInAt: { type: Date, default: null },
    requestedCheckOutAt: { type: Date, default: null },

    originalWorkedMinutes: { type: Number, default: 0 },
    requestedWorkedMinutes: { type: Number, default: 0 },

    originalLatenessMinutes: { type: Number, default: 0 },
    requestedLatenessMinutes: { type: Number, default: 0 },

    originalEarlyLeaveMinutes: { type: Number, default: 0 },
    requestedEarlyLeaveMinutes: { type: Number, default: 0 },

    originalOvertimeMinutes: { type: Number, default: 0 },
    requestedOvertimeMinutes: { type: Number, default: 0 },

    reason: {
      type: String,
      required: true,
      trim: true,
    },
    evidenceNote: { type: String, default: "" },
    evidenceUrls: [{ type: String }],

    status: {
      type: String,
      enum: CORRECTION_STATUSES,
      default: "pending",
      index: true,
    },

    requestedBy: { type: Types.ObjectId, ref: "User", default: null },
    requestedByRole: { type: String, default: "" },
    requestedAt: { type: Date, default: Date.now },

    reviewedBy: { type: Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },

    appliedBy: { type: Types.ObjectId, ref: "User", default: null },
    appliedAt: { type: Date, default: null },

    rejectionReason: { type: String, default: "" },

    auditLogs: {
      type: [AttendanceCorrectionAuditLogSchema],
      default: [],
    },
  },
  { timestamps: true },
);

AttendanceCorrectionRequestSchema.index({
  restaurantId: 1,
  workDate: -1,
});

AttendanceCorrectionRequestSchema.index({
  employeeId: 1,
  workDate: -1,
});

AttendanceCorrectionRequestSchema.index({
  restaurantId: 1,
  status: 1,
  workDate: -1,
});

AttendanceCorrectionRequestSchema.index(
  {
    employeeId: 1,
    restaurantId: 1,
    workDate: 1,
    status: 1,
  },
  {
    partialFilterExpression: {
      status: "pending",
    },
  },
);

export const ATTENDANCE_CORRECTION_TYPES = CORRECTION_TYPES;
export const ATTENDANCE_CORRECTION_STATUSES = CORRECTION_STATUSES;

export default mongoose.model(
  "AttendanceCorrectionRequest",
  AttendanceCorrectionRequestSchema,
);
