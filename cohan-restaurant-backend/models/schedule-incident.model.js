import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const SCHEDULE_INCIDENT_SOURCES = [
  "publish_warning",
  "reopen",
  "published_change",
  "leave_approved",
  "shift_declined",
  "availability_late_change",
  "staff_status_changed",
  "attendance_absence",
  "system_detection",
];

const SCHEDULE_INCIDENT_REASON_CODES = [
  "EMPLOYEE_APPROVED_LEAVE",
  "EMPLOYEE_VALID_UNAVAILABLE",
  "EMPLOYEE_VALID_DECLINE",
  "EMPLOYEE_LATE_DECLINE",
  "EMPLOYEE_NO_SHOW",
  "STAFF_STATUS_CHANGED",
  "MANAGER_SCHEDULING_ERROR",
  "MANAGER_VOLUNTARY_CHANGE",
  "PUBLISH_WITH_WARNING",
  "PUBLISH_WITH_DANGER",
  "DEMAND_FORECAST_CHANGED",
  "OPERATIONAL_INCIDENT",
  "SYSTEM_CORRECTION",
];

const ScheduleIncidentSchema = new Schema(
  {
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    publicationId: {
      type: Types.ObjectId,
      ref: "SchedulePublication",
      index: true,
    },

    periodStart: {
      type: Date,
      required: true,
      index: true,
    },

    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: SCHEDULE_INCIDENT_SOURCES,
      required: true,
      index: true,
    },

    reasonCode: {
      type: String,
      enum: SCHEDULE_INCIDENT_REASON_CODES,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    severity: {
      type: String,
      enum: ["info", "warning", "risk", "penalty"],
      default: "warning",
      index: true,
    },

    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved", "waived", "expired"],
      default: "open",
      index: true,
    },

    shiftIds: [
      {
        type: Types.ObjectId,
        ref: "Shift",
      },
    ],

    affectedEmployeeIds: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],

    affectedRoleKeys: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    affectedDates: [Date],

    responsibilityTarget: {
      type: String,
      enum: ["employee", "scheduler", "manager", "neutral", "system"],
      default: "neutral",
      index: true,
    },

    responsibleEmployeeIds: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],

    responsibleManagerId: {
      type: Types.ObjectId,
      ref: "User",
      index: true,
    },

    schedulerId: {
      type: Types.ObjectId,
      ref: "User",
      index: true,
    },

    createdBy: {
      type: Types.ObjectId,
      ref: "User",
    },

    scoreImpactTarget: {
      type: String,
      enum: ["none", "staff_reliability", "staff_compliance", "schedule_quality"],
      default: "none",
    },

    scoreImpact: {
      type: Number,
      default: 0,
    },

    eventAt: {
      type: Date,
      required: true,
      index: true,
    },

    detectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    acknowledgedAt: Date,
    acknowledgedBy: {
      type: Types.ObjectId,
      ref: "User",
    },

    responseDueAt: {
      type: Date,
      index: true,
    },

    resolvedAt: Date,
    resolvedBy: {
      type: Types.ObjectId,
      ref: "User",
    },

    resolveDueAt: {
      type: Date,
      index: true,
    },

    breachedAt: Date,
    breachMinutes: {
      type: Number,
      default: 0,
    },

    slaStatus: {
      type: String,
      enum: [
        "not_applicable",
        "on_track",
        "response_breached",
        "resolution_breached",
        "resolved_on_time",
        "resolved_late",
      ],
      default: "not_applicable",
      index: true,
    },

    slaPolicyCode: {
      type: String,
      default: "",
      trim: true,
    },

    evidence: {
      type: Schema.Types.Mixed,
      default: {},
    },

    resolutionAction: {
      type: String,
      enum: [
        "none",
        "replace_employee",
        "remove_employee",
        "change_shift_time",
        "accept_understaffed",
        "approve_leave_without_replacement",
        "waive_penalty",
        "attendance_correction_required",
      ],
      default: "none",
    },

    resolutionNote: {
      type: String,
      default: "",
      trim: true,
    },

    replacementEmployeeIds: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],

    waivedBy: {
      type: Types.ObjectId,
      ref: "User",
    },

    waiverReason: {
      type: String,
      default: "",
      trim: true,
    },

    linkedChangeLogIds: [
      {
        type: Types.ObjectId,
        ref: "EventLog",
      },
    ],
  },
  { timestamps: true },
);

ScheduleIncidentSchema.index({ restaurantId: 1, periodStart: 1, periodEnd: 1 });
ScheduleIncidentSchema.index({ restaurantId: 1, status: 1, severity: 1 });
ScheduleIncidentSchema.index({ publicationId: 1, source: 1, reasonCode: 1 });
ScheduleIncidentSchema.index({ resolveDueAt: 1, status: 1 });
ScheduleIncidentSchema.index({ responseDueAt: 1, status: 1 });

export {
  SCHEDULE_INCIDENT_REASON_CODES,
  SCHEDULE_INCIDENT_SOURCES,
};

export default mongoose.model("ScheduleIncident", ScheduleIncidentSchema);
