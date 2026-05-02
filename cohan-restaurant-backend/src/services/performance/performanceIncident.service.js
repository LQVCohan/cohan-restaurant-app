import { PerformanceIncident } from "../../../models/index.js";
import {
  resolveUserRoles,
  userCanAccessRestaurant,
} from "../scheduling/schedulingPermission.service.js";

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

function assertRestaurantScope(user, restaurantId) {
  if (!userCanAccessRestaurant(user, restaurantId)) throw new Error("FORBIDDEN");
}

function hasAnyRole(user, allowedRoles) {
  const roles = resolveUserRoles(user);
  return roles.some((role) => allowedRoles.includes(role));
}

function assertCanReviewIncident(user, restaurantId) {
  if (!hasAnyRole(user, PERFORMANCE_REVIEW_ROLES)) throw new Error("FORBIDDEN");
  assertRestaurantScope(user, restaurantId);
}

export async function reviewPerformanceIncident({ input, ctx }) {
  const user = ctx?.user;
  if (!user) throw new Error("UNAUTHENTICATED");
  const incident = await getPerformanceIncidentById(input.incidentId);
  assertCanReviewIncident(user, incident.restaurantId);

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
  assertCanReviewIncident(user, incident.restaurantId);
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
  assertCanReviewIncident(user, incident.restaurantId);
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
