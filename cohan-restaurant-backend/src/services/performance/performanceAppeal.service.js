import mongoose from "mongoose";
import { PerformanceIncident, PerformanceIncidentAppeal } from "../../../models/index.js";
import { PERFORMANCE_READ_ROLES, PERFORMANCE_REVIEW_ROLES, PERFORMANCE_SELF_ROLES } from "./performanceIncident.service.js";
import { resolveUserRoles, userCanAccessRestaurant } from "../scheduling/schedulingPermission.service.js";

const OPEN_STATUSES = ["submitted", "under_review", "needs_more_info"];
const REVIEW_STATUSES = ["under_review", "needs_more_info", "accepted", "rejected"];

const toId = (v) => String(v || "");
const trim = (v) => String(v || "").trim();
function hasRole(user, roles){ return resolveUserRoles(user).some((r)=>roles.includes(r)); }
function assertScope(user, restaurantId){ if (!userCanAccessRestaurant(user, restaurantId)) throw new Error("FORBIDDEN"); }

export async function createPerformanceIncidentAppeal(input, actor) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  const incident = await PerformanceIncident.findById(input.incidentId);
  if (!incident) throw new Error("PERFORMANCE_INCIDENT_NOT_FOUND");
  assertScope(actor, incident.restaurantId);
  const actorId = toId(actor._id || actor.id);
  const roles = resolveUserRoles(actor);
  if (roles.some((r) => PERFORMANCE_SELF_ROLES.includes(r)) && toId(incident.employeeId) !== actorId) throw new Error("FORBIDDEN");
  if (incident.scoreImpactStatus === "not_applicable") throw new Error("INCIDENT_NOT_ELIGIBLE_FOR_APPEAL");
  const reason = trim(input.reason);
  if (!reason) throw new Error("APPEAL_REASON_REQUIRED");
  const existing = await PerformanceIncidentAppeal.findOne({ incidentId: incident._id, status: { $in: OPEN_STATUSES } });
  if (existing) throw new Error("OPEN_APPEAL_ALREADY_EXISTS");
  return PerformanceIncidentAppeal.create({ restaurantId: incident.restaurantId, incidentId: incident._id, employeeId: incident.employeeId, submittedBy: actorId, submittedAt: new Date(), reason, evidenceNote: trim(input.evidenceNote), evidenceUrls: (input.evidenceUrls || []).map(trim).filter(Boolean), status: "submitted" });
}

export async function listPerformanceIncidentAppeals(filter, actor) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  assertScope(actor, filter.restaurantId);
  const roles = resolveUserRoles(actor);
  const actorId = toId(actor._id || actor.id);
  const q = { restaurantId: filter.restaurantId };
  if (filter.employeeId) q.employeeId = filter.employeeId;
  if (filter.incidentId) q.incidentId = filter.incidentId;
  if (filter.status) q.status = filter.status;
  if (filter.fromDate || filter.toDate) { q.submittedAt = {}; if (filter.fromDate) q.submittedAt.$gte = new Date(filter.fromDate); if (filter.toDate) q.submittedAt.$lte = new Date(filter.toDate); }
  if (roles.some((r)=>PERFORMANCE_SELF_ROLES.includes(r))) q.employeeId = actorId;
  else if (!roles.some((r)=>PERFORMANCE_READ_ROLES.includes(r) || PERFORMANCE_REVIEW_ROLES.includes(r))) throw new Error("FORBIDDEN");
  const limit = Math.min(Math.max(Number(filter.limit || 50),1),200); const offset = Math.max(Number(filter.offset||0),0);
  return PerformanceIncidentAppeal.find(q).sort({submittedAt:-1, createdAt:-1}).skip(offset).limit(limit);
}

export async function getPerformanceIncidentAppealById(id, actor) { const d = await PerformanceIncidentAppeal.findById(id); if(!d) throw new Error("PERFORMANCE_INCIDENT_APPEAL_NOT_FOUND"); const list=await listPerformanceIncidentAppeals({restaurantId:d.restaurantId, employeeId:d.employeeId, incidentId:d.incidentId, limit:1, offset:0}, actor); if(!list.length) throw new Error('FORBIDDEN'); return d; }

export async function cancelPerformanceIncidentAppeal(appealId, actor){ const appeal = await getPerformanceIncidentAppealById(appealId, actor); const actorId = toId(actor._id || actor.id); if (toId(appeal.employeeId)!==actorId) throw new Error('FORBIDDEN'); if(!["submitted","needs_more_info"].includes(appeal.status)) throw new Error('INVALID_APPEAL_STATUS'); appeal.status='cancelled'; appeal.reviewedBy=actorId; appeal.reviewedAt=new Date(); appeal.reviewNote='Cancelled by staff'; return appeal.save(); }

export async function reviewPerformanceIncidentAppeal(input, actor){ if(!actor) throw new Error('UNAUTHENTICATED'); const appeal = await PerformanceIncidentAppeal.findById(input.appealId); if(!appeal) throw new Error('PERFORMANCE_INCIDENT_APPEAL_NOT_FOUND'); assertScope(actor, appeal.restaurantId); if(!hasRole(actor, PERFORMANCE_REVIEW_ROLES)) throw new Error('FORBIDDEN'); if(!REVIEW_STATUSES.includes(input.status)) throw new Error('INVALID_REVIEW_STATUS'); if(["accepted","rejected"].includes(input.status) && !trim(input.decisionReason)) throw new Error('DECISION_REASON_REQUIRED'); appeal.status=input.status; appeal.reviewedBy=actor._id || actor.id; appeal.reviewedAt=new Date(); appeal.reviewNote=trim(input.reviewNote); appeal.decisionReason=trim(input.decisionReason); return appeal.save(); }
