import { PerformanceIncident, StaffPerformanceScoreAdjustment, StaffPerformanceSnapshot } from "../../../models/index.js";
import {
  resolveUserRoles,
  userCanAccessRestaurant,
} from "../scheduling/schedulingPermission.service.js";
import { resolvePerformanceLevel } from "../staffPerformance/staffPerformance.service.js";

export const PERFORMANCE_READ_ROLES = ["ADMIN", "MANAGER", "HR", "ACCOUNTANT"];
export const PERFORMANCE_REVIEW_ROLES = ["ADMIN", "MANAGER", "HR"];
export const PERFORMANCE_SELF_ROLES = ["STAFF"];

export function buildIncidentUniqueKey(sourceType, sourceId, eventType) {
  return `${String(sourceType || "")}:${String(sourceId || "")}:${String(eventType || "")}`;
}

export async function createPerformanceIncident(input) {
  return PerformanceIncident.create({
    ...input,
    uniqueKey:
      input.uniqueKey ||
      buildIncidentUniqueKey(input.sourceType, input.sourceId, input.eventType),
    scoreDelta: Number(input.scoreDelta || 0),
  });
}

export async function createPerformanceIncidentOnce(input, uniqueKeyParts) {
  const uniqueKey = Array.isArray(uniqueKeyParts)
    ? uniqueKeyParts.join(":")
    : buildIncidentUniqueKey(input.sourceType, input.sourceId, input.eventType);
  return PerformanceIncident.findOneAndUpdate(
    { uniqueKey },
    {
      $setOnInsert: {
        ...input,
        uniqueKey,
        scoreDelta: Number(input.scoreDelta || 0),
      },
    },
    { new: true, upsert: true },
  );
}

export async function listPerformanceIncidents(filter = {}) {
  const query = {};
  const keys = ["restaurantId", "employeeId", "sourceType", "eventType", "severity", "responsibilityStatus", "scoreImpactStatus"];
  keys.forEach((k) => {
    if (filter[k]) query[k] = filter[k];
  });
  if (filter.fromDate || filter.toDate) {
    query.occurredAt = {};
    if (filter.fromDate) query.occurredAt.$gte = new Date(filter.fromDate);
    if (filter.toDate) query.occurredAt.$lte = new Date(filter.toDate);
  }
  if (filter.onlyPendingReview) query.responsibilityStatus = "pending_review";
  if (filter.onlyEligible) query.scoreImpactStatus = "eligible";
  if (filter.onlyWaived) query.scoreImpactStatus = "waived";
  return PerformanceIncident.find(query).sort({ occurredAt: -1, createdAt: -1 });
}

export async function getPerformanceIncidentById(incidentId) {
  const doc = await PerformanceIncident.findById(incidentId);
  if (!doc) throw new Error("PERFORMANCE_INCIDENT_NOT_FOUND");
  return doc;
}

async function assertRestaurantScope(user, restaurantId) {
  if (!await userCanAccessRestaurant(user, restaurantId)) throw new Error("FORBIDDEN");
}

function hasAnyRole(user, allowedRoles) {
  const roles = resolveUserRoles(user);
  return roles.some((role) => allowedRoles.includes(role));
}

async function assertCanReviewIncident(user, restaurantId) {
  if (!hasAnyRole(user, PERFORMANCE_REVIEW_ROLES)) throw new Error("FORBIDDEN");
  await assertRestaurantScope(user, restaurantId);
}

export async function reviewPerformanceIncident({ input, ctx }) {
  const user = ctx?.user;
  if (!user) throw new Error("UNAUTHENTICATED");
  const incident = await getPerformanceIncidentById(input.incidentId);
  await assertCanReviewIncident(user, incident.restaurantId);

  const nextResponsibility = input.responsibilityStatus || incident.responsibilityStatus;
  const nextImpact = input.scoreImpactStatus || incident.scoreImpactStatus;
  if (nextImpact === "applied") throw new Error("SCORE_IMPACT_APPLIED_NOT_ALLOWED");
  if (Number(input.proposedScoreDelta) > 0) throw new Error("INVALID_PROPOSED_SCORE_DELTA");
  if (
    nextImpact === "eligible" &&
    ["pending_review", "no_fault", "system_responsible"].includes(nextResponsibility)
  ) throw new Error("RESPONSIBILITY_NOT_ELIGIBLE_FOR_SCORING");

  const terminalStatuses = ["waived", "eligible", "not_applicable"];
  incident.reviewedBy = user._id || user.id;
  incident.reviewedAt = new Date();
  if (typeof input.reviewNote === "string") incident.reviewNote = input.reviewNote.trim();
  if (typeof input.responsibilityNote === "string") incident.responsibilityNote = input.responsibilityNote.trim();
  if (input.responsibilityStatus) incident.responsibilityStatus = input.responsibilityStatus;
  if (input.scoreImpactStatus) incident.scoreImpactStatus = input.scoreImpactStatus;
  if (typeof input.proposedScoreDelta !== "undefined") incident.proposedScoreDelta = Number(input.proposedScoreDelta || 0);
  incident.resolvedAt = terminalStatuses.includes(incident.scoreImpactStatus) ? new Date() : incident.resolvedAt;
  return incident.save();
}

export async function waivePerformanceIncident({ incidentId, reason, ctx }) {
  const user = ctx?.user;
  if (!user) throw new Error("UNAUTHENTICATED");
  const trimReason = String(reason || "").trim();
  if (!trimReason) throw new Error("WAIVE_REASON_REQUIRED");
  const incident = await getPerformanceIncidentById(incidentId);
  await assertCanReviewIncident(user, incident.restaurantId);
  if (incident.scoreImpactStatus === "applied") throw new Error("INCIDENT_ALREADY_APPLIED");
  if (incident.scoreImpactStatus === "waived") return incident;

  const now = new Date();
  incident.scoreImpactStatus = "waived";
  if (incident.responsibilityStatus === "pending_review") incident.responsibilityStatus = "no_fault";
  incident.waivedBy = user._id || user.id;
  incident.waivedAt = now;
  incident.waiveReason = trimReason;
  if (!incident.reviewedBy) incident.reviewedBy = user._id || user.id;
  if (!incident.reviewedAt) incident.reviewedAt = now;
  incident.resolvedAt = now;
  return incident.save();
}

export async function markPerformanceIncidentEligible({ input, ctx }) {
  const user = ctx?.user;
  if (!user) throw new Error("UNAUTHENTICATED");
  const incident = await getPerformanceIncidentById(input.incidentId);
  await assertCanReviewIncident(user, incident.restaurantId);
  if (["applied", "waived"].includes(incident.scoreImpactStatus)) throw new Error("INVALID_INCIDENT_STATE");
  if (!["staff_responsible", "manager_responsible", "shared"].includes(input.responsibilityStatus)) throw new Error("INVALID_RESPONSIBILITY_STATUS");
  const proposed = Number(input.proposedScoreDelta);
  if (proposed > 0) throw new Error("INVALID_PROPOSED_SCORE_DELTA");
  if (proposed === 0 && !String(input.note || "").trim()) throw new Error("NOTE_REQUIRED_FOR_ZERO_DELTA");

  const now = new Date();
  incident.responsibilityStatus = input.responsibilityStatus;
  incident.scoreImpactStatus = "eligible";
  incident.proposedScoreDelta = proposed;
  incident.eligibleBy = user._id || user.id;
  incident.eligibleAt = now;
  incident.reviewedBy = user._id || user.id;
  incident.reviewedAt = now;
  if (typeof input.note === "string") incident.reviewNote = input.note.trim();
  incident.resolvedAt = now;
  return incident.save();
}


const APPLY_ALLOWED_RESPONSIBILITY = ["staff_responsible", "manager_responsible", "shared"];
const SCORE_MIN = 0;
const SCORE_DEFAULT = 100;

async function assertCanApplyIncident(user, restaurantId) {
  if (!hasAnyRole(user, PERFORMANCE_REVIEW_ROLES)) throw new Error("FORBIDDEN");
  await assertRestaurantScope(user, restaurantId);
}

function toPeriodBounds(dateLike) {
  const dt = new Date(dateLike || Date.now());
  const periodStart = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { periodStart, periodEnd };
}

export async function applyPerformanceIncidentScore({ incidentId, actor, note }) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  const incident = await getPerformanceIncidentById(incidentId);
  await assertCanApplyIncident(actor, incident.restaurantId);

  if (incident.scoreImpactStatus === "waived") throw new Error("PERFORMANCE_INCIDENT_WAIVED");
  if (incident.scoreImpactStatus === "applied") throw new Error("PERFORMANCE_INCIDENT_ALREADY_APPLIED");
  if (incident.scoreImpactStatus !== "eligible") throw new Error("PERFORMANCE_INCIDENT_NOT_ELIGIBLE");
  if (!APPLY_ALLOWED_RESPONSIBILITY.includes(incident.responsibilityStatus)) throw new Error("PERFORMANCE_RESPONSIBILITY_NOT_APPLICABLE");

  const proposed = Number(incident.proposedScoreDelta || 0);
  if (proposed > 0) throw new Error("PERFORMANCE_SCORE_DELTA_INVALID");
  const applyNote = String(note || "").trim();
  if (proposed === 0 && !applyNote) throw new Error("NOTE_REQUIRED_FOR_ZERO_DELTA");

  const { periodStart, periodEnd } = toPeriodBounds(incident.occurredAt);
  const snapshot = await StaffPerformanceSnapshot.findOne({
    employeeId: incident.employeeId,
    restaurantId: incident.restaurantId,
    periodStart,
    periodEnd,
  });
  const previousScore = Number(snapshot?.finalPerformanceScore ?? SCORE_DEFAULT);
  const newScore = Math.max(SCORE_MIN, previousScore + proposed);
  const now = new Date();

  try {
    const adjustment = await StaffPerformanceScoreAdjustment.create({
      restaurantId: incident.restaurantId,
      employeeId: incident.employeeId,
      incidentId: incident._id,
      sourceType: "performance_incident",
      scoreDelta: proposed,
      previousScore,
      newScore,
      appliedBy: actor._id || actor.id,
      appliedAt: now,
      reason: incident.eventType,
      note: applyNote,
      metadata: {
        incidentEventType: incident.eventType,
        sourceType: incident.sourceType,
        sourceId: incident.sourceId,
        responsibilityStatus: incident.responsibilityStatus,
        proposedScoreDelta: proposed,
      },
    });

    await StaffPerformanceSnapshot.findOneAndUpdate(
      { employeeId: incident.employeeId, restaurantId: incident.restaurantId, periodStart, periodEnd },
      {
        $setOnInsert: {
          employeeId: incident.employeeId,
          restaurantId: incident.restaurantId,
          periodStart,
          periodEnd,
        },
        $set: {
          finalPerformanceScore: newScore,
          performanceLevel: resolvePerformanceLevel(newScore),
        },
      },
      { new: true, upsert: true },
    );

    incident.scoreDelta = proposed;
    incident.scoreImpactStatus = "applied";
    incident.appliedBy = actor._id || actor.id;
    incident.appliedAt = now;
    incident.applyNote = applyNote;
    incident.scoreAdjustmentId = adjustment._id;
    incident.resolvedAt = now;
    await incident.save();
    return incident;
  } catch (error) {
    if (error?.code === 11000) throw new Error("PERFORMANCE_INCIDENT_ALREADY_APPLIED");
    throw error;
  }
}
