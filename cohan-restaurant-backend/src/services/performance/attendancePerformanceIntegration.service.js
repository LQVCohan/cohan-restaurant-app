import { PerformanceIncident } from "../../../models/index.js";
import { buildIncidentUniqueKey } from "./performanceIncident.service.js";

const ATTENDANCE_SOURCE_TYPE = "timesheet";
const ATTENDANCE_EVENT_TYPES = [
  "ATTENDANCE_LATE",
  "ATTENDANCE_EARLY_LEAVE",
  "ATTENDANCE_MISSING_CHECKOUT",
  "ATTENDANCE_ABSENT",
];
const STALE_REVIEW_NOTE =
  "Attendance final state no longer triggers this incident.";
const ATTENDANCE_SCORE_RULE = "punctuality_component";

function toNumber(value) {
  const next = Number(value || 0);
  return Number.isFinite(next) && next > 0 ? next : 0;
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function toSourceId(timesheet) {
  return timesheet?._id ? String(timesheet._id) : "";
}

function resolveOccurredAt(timesheet) {
  return (
    timesheet?.actualCheckOutAt ||
    timesheet?.actualCheckInAt ||
    timesheet?.plannedStartTime ||
    timesheet?.workDate ||
    new Date()
  );
}

function lateSeverity(minutes) {
  if (minutes >= 30) return "violation";
  return "warning";
}

function earlyLeaveSeverity(minutes) {
  if (minutes >= 30) return "violation";
  return "warning";
}

function baseIncident(timesheet, eventType, overrides = {}) {
  const sourceId = toSourceId(timesheet);
  return {
    restaurantId: timesheet.restaurantId,
    employeeId: timesheet.employeeId,
    actorId: overrides.actorId || null,
    actorRole: overrides.actorRole || "system",
    sourceType: ATTENDANCE_SOURCE_TYPE,
    sourceId,
    uniqueKey: buildIncidentUniqueKey(ATTENDANCE_SOURCE_TYPE, sourceId, eventType),
    eventType,
    severity: overrides.severity || "warning",
    responsibilityStatus: overrides.responsibilityStatus || "pending_review",
    scoreImpactStatus: "not_applicable",
    proposedScoreDelta: 0,
    occurredAt: resolveOccurredAt(timesheet),
    detectedAt: new Date(),
    metadata: {
      timesheetId: sourceId,
      workDate: timesheet.workDate || null,
      shiftId: timesheet.shiftId ? String(timesheet.shiftId?._id || timesheet.shiftId) : null,
      status: timesheet.status || null,
      plannedStartTime: timesheet.plannedStartTime || null,
      plannedEndTime: timesheet.plannedEndTime || null,
      actualCheckInAt: timesheet.actualCheckInAt || null,
      actualCheckOutAt: timesheet.actualCheckOutAt || null,
      latenessMinutes: toNumber(timesheet.latenessMinutes),
      earlyLeaveMinutes: toNumber(timesheet.earlyLeaveMinutes),
      overtimeMinutes: toNumber(timesheet.overtimeMinutes),
      approvedOvertimeMinutes: toNumber(timesheet.approvedOvertimeMinutes),
      overtimeApprovalStatus: timesheet.overtimeApprovalStatus || "not_required",
      source: timesheet.source || null,
      scoreRule: ATTENDANCE_SCORE_RULE,
      ...(overrides.metadata || {}),
    },
  };
}

export function derivePerformanceIncidentsFromTimesheet(timesheet, context = {}) {
  if (!timesheet?._id || !timesheet?.restaurantId || !timesheet?.employeeId) {
    return [];
  }

  const status = normalizeStatus(timesheet.status);
  const incidents = [];
  const latenessMinutes = toNumber(timesheet.latenessMinutes);
  const earlyLeaveMinutes = toNumber(timesheet.earlyLeaveMinutes);

  if (status === "scheduled_absent" && !timesheet.actualCheckInAt) {
    incidents.push(
      baseIncident(timesheet, "ATTENDANCE_ABSENT", {
        ...context,
        severity: "critical",
        proposedScoreDelta: 0,
        metadata: { reason: "scheduled_absent" },
      }),
    );
    return incidents;
  }

  if (status === "missed_checkout") {
    incidents.push(
      baseIncident(timesheet, "ATTENDANCE_MISSING_CHECKOUT", {
        ...context,
        severity: "warning",
        proposedScoreDelta: 0,
      }),
    );
  }

  if (latenessMinutes > 0) {
    incidents.push(
      baseIncident(timesheet, "ATTENDANCE_LATE", {
        ...context,
        severity: lateSeverity(latenessMinutes),
        proposedScoreDelta: 0,
        metadata: { latenessMinutes },
      }),
    );
  }

  if (earlyLeaveMinutes > 0) {
    incidents.push(
      baseIncident(timesheet, "ATTENDANCE_EARLY_LEAVE", {
        ...context,
        severity: earlyLeaveSeverity(earlyLeaveMinutes),
        proposedScoreDelta: 0,
        metadata: { earlyLeaveMinutes },
      }),
    );
  }

  return incidents;
}

async function upsertDerivedIncident(incident) {
  return PerformanceIncident.findOneAndUpdate(
    { uniqueKey: incident.uniqueKey },
    {
      $setOnInsert: {
        ...incident,
        scoreDelta: 0,
      },
      $set: {
        severity: incident.severity,
        proposedScoreDelta: incident.proposedScoreDelta,
        occurredAt: incident.occurredAt,
        metadata: incident.metadata,
      },
    },
    { new: true, upsert: true },
  );
}

async function waiveStaleAttendanceIncidents({ timesheet, desiredEventTypes }) {
  const sourceId = toSourceId(timesheet);
  if (!sourceId) return { waived: 0 };

  const result = await PerformanceIncident.updateMany(
    {
      sourceType: ATTENDANCE_SOURCE_TYPE,
      sourceId,
      eventType: { $in: ATTENDANCE_EVENT_TYPES.filter((type) => !desiredEventTypes.has(type)) },
      scoreImpactStatus: { $in: ["pending", "eligible", "waived"] },
    },
    {
      $set: {
        responsibilityStatus: "no_fault",
        scoreImpactStatus: "waived",
        resolvedAt: new Date(),
        reviewNote: STALE_REVIEW_NOTE,
      },
    },
  );

  return { waived: Number(result?.modifiedCount || 0) };
}

export async function syncAttendancePerformanceIncidents(timesheet, context = {}) {
  if (!timesheet?._id || !timesheet?.restaurantId || !timesheet?.employeeId) {
    return { createdOrUpdated: 0, waived: 0, incidents: [] };
  }

  const incidents = derivePerformanceIncidentsFromTimesheet(timesheet, context);
  const desiredEventTypes = new Set(incidents.map((incident) => incident.eventType));
  const synced = [];

  for (const incident of incidents) {
    synced.push(await upsertDerivedIncident(incident));
  }

  const stale = await waiveStaleAttendanceIncidents({
    timesheet,
    desiredEventTypes,
  });

  return {
    createdOrUpdated: synced.length,
    waived: stale.waived,
    incidents: synced,
  };
}
