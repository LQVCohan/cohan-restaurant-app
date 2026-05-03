import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const SOURCE_TYPES = [
  "timesheet",
  "attendance_correction",
  "overtime_request",
  "off_schedule_attendance",
  "shift_acknowledgement",
  "schedule_revision",
  "system",
];

const EVENT_TYPES = [
  "ATTENDANCE_LATE",
  "ATTENDANCE_EARLY_LEAVE",
  "ATTENDANCE_MISSING_CHECKOUT",
  "ATTENDANCE_ABSENT",
  "OFF_SCHEDULE_CREATED",
  "OFF_SCHEDULE_APPROVED",
  "OFF_SCHEDULE_REJECTED",
  "ATTENDANCE_CORRECTION_CREATED",
  "ATTENDANCE_CORRECTION_APPLIED",
  "ATTENDANCE_CORRECTION_REJECTED",
  "OVERTIME_REQUEST_CREATED",
  "OVERTIME_REQUEST_APPROVED",
  "OVERTIME_REQUEST_REJECTED",
  "OVERTIME_REQUEST_CANCELLED",
  "OVERTIME_REQUEST_COMPLETED",
  "SHIFT_DECLINED_VALID",
  "SHIFT_DECLINED_LATE",
  "SCHEDULE_RETURNED_FOR_REVISION",
];

const PerformanceIncidentSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    actorId: { type: Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: "" },
    sourceType: { type: String, enum: SOURCE_TYPES, required: true, index: true },
    sourceId: { type: String, required: true, trim: true },
    uniqueKey: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, enum: EVENT_TYPES, required: true, index: true },
    severity: { type: String, enum: ["info", "warning", "violation", "critical"], default: "info", index: true },
    responsibilityStatus: {
      type: String,
      enum: ["pending_review", "no_fault", "staff_responsible", "manager_responsible", "system_responsible", "shared"],
      default: "pending_review",
      index: true,
    },
    scoreImpactStatus: {
      type: String,
      enum: ["not_applicable", "pending", "eligible", "applied", "waived"],
      default: "not_applicable",
      index: true,
    },
    scoreDelta: { type: Number, default: 0 },
    proposedScoreDelta: { type: Number, default: 0 },
    occurredAt: { type: Date, default: Date.now, index: true },
    detectedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    reviewedBy: { type: Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
    waivedBy: { type: Types.ObjectId, ref: "User", default: null },
    waivedAt: { type: Date, default: null },
    waiveReason: { type: String, default: "" },
    eligibleBy: { type: Types.ObjectId, ref: "User", default: null },
    eligibleAt: { type: Date, default: null },
    appliedBy: { type: Types.ObjectId, ref: "User", default: null },
    appliedAt: { type: Date, default: null },
    applyNote: { type: String, default: "" },
    scoreAdjustmentId: { type: Types.ObjectId, ref: "StaffPerformanceScoreAdjustment", default: null },

    scoreReversalStatus: { type: String, enum: ["none", "pending", "reversed"], default: "none", index: true },
    scoreReversalId: { type: Types.ObjectId, ref: "StaffPerformanceScoreReversal", default: null },
    scoreReversedAt: { type: Date, default: null },
    scoreReversalNote: { type: String, default: "" },
    responsibilityNote: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

PerformanceIncidentSchema.index({ restaurantId: 1, employeeId: 1, occurredAt: -1 });
PerformanceIncidentSchema.index({ sourceType: 1, sourceId: 1, eventType: 1 }, { unique: true });

export default mongoose.models.PerformanceIncident || mongoose.model("PerformanceIncident", PerformanceIncidentSchema);
