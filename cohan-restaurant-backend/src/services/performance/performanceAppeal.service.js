import mongoose from "mongoose";
import { PerformanceIncident, PerformanceIncidentAppeal, StaffPerformanceScoreAdjustment, StaffPerformanceScoreReversal, StaffPerformanceSnapshot } from "../../../models/index.js";
import { PERFORMANCE_READ_ROLES, PERFORMANCE_REVIEW_ROLES, PERFORMANCE_SELF_ROLES } from "./performanceIncident.service.js";
import { resolveUserRoles, userCanAccessRestaurant } from "../scheduling/schedulingPermission.service.js";
import { notifyReviewers, notifyUser } from "../notification/notificationWorkflow.service.js";
import { resolvePerformanceLevel } from "../staffPerformance/staffPerformance.service.js";

const OPEN_STATUSES = ["submitted", "under_review", "needs_more_info"];
const REVIEW_STATUSES = ["under_review", "needs_more_info", "accepted", "rejected"];

const toId = (v) => String(v || "");
const trim = (v) => String(v || "").trim();
function hasRole(user, roles){ return resolveUserRoles(user).some((r)=>roles.includes(r)); }
async function assertScope(user, restaurantId){ if (!await userCanAccessRestaurant(user, restaurantId)) throw new Error("FORBIDDEN"); }

const SCORE_MIN = 0;
const SCORE_MAX = 100;
function toPeriodBounds(dateLike) { const dt = new Date(dateLike || Date.now()); const periodStart = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 0, 0, 0, 0)); const periodEnd = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0, 23, 59, 59, 999)); return { periodStart, periodEnd }; }

export async function createPerformanceIncidentAppeal(input, actor) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  const incident = await PerformanceIncident.findById(input.incidentId);
  if (!incident) throw new Error("PERFORMANCE_INCIDENT_NOT_FOUND");
  await assertScope(actor, incident.restaurantId);
  const actorId = toId(actor._id || actor.id);
  const roles = resolveUserRoles(actor);
  if (roles.some((r) => PERFORMANCE_SELF_ROLES.includes(r)) && toId(incident.employeeId) !== actorId) throw new Error("FORBIDDEN");
  if (incident.scoreImpactStatus === "not_applicable") throw new Error("INCIDENT_NOT_ELIGIBLE_FOR_APPEAL");
  const reason = trim(input.reason);
  if (!reason) throw new Error("APPEAL_REASON_REQUIRED");
  const existing = await PerformanceIncidentAppeal.findOne({ incidentId: incident._id, status: { $in: OPEN_STATUSES } });
  if (existing) throw new Error("OPEN_APPEAL_ALREADY_EXISTS");
  const appeal = await PerformanceIncidentAppeal.create({ restaurantId: incident.restaurantId, incidentId: incident._id, employeeId: incident.employeeId, submittedBy: actorId, submittedAt: new Date(), reason, evidenceNote: trim(input.evidenceNote), evidenceUrls: (input.evidenceUrls || []).map(trim).filter(Boolean), status: "submitted" });
  try { await notifyReviewers({ restaurantId: incident.restaurantId, type: "appeal_submitted", sourceType: "performance_appeal", sourceId: String(appeal._id), actionUrl: "/manager/performance", payload: { title: "Có phản hồi/khiếu nại mới", message: "Một nhân viên đã gửi phản hồi cho incident hiệu suất." } }); } catch (error) { console.warn("Failed to create notification:", error.message); }
  return appeal;
}

export async function listPerformanceIncidentAppeals(filter, actor) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  await assertScope(actor, filter.restaurantId);
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

export async function reviewPerformanceIncidentAppeal(input, actor){ if(!actor) throw new Error('UNAUTHENTICATED'); const appeal = await PerformanceIncidentAppeal.findById(input.appealId); if(!appeal) throw new Error('PERFORMANCE_INCIDENT_APPEAL_NOT_FOUND'); await assertScope(actor, appeal.restaurantId); if(!hasRole(actor, PERFORMANCE_REVIEW_ROLES)) throw new Error('FORBIDDEN'); if(!REVIEW_STATUSES.includes(input.status)) throw new Error('INVALID_REVIEW_STATUS'); if(["accepted","rejected"].includes(input.status) && !trim(input.decisionReason)) throw new Error('DECISION_REASON_REQUIRED'); appeal.status=input.status; appeal.reviewedBy=actor._id || actor.id; appeal.reviewedAt=new Date(); appeal.reviewNote=trim(input.reviewNote); appeal.decisionReason=trim(input.decisionReason);
  if (input.status === "accepted") {
    const incident = await PerformanceIncident.findById(appeal.incidentId);
    appeal.scoreReversalStatus = incident?.scoreImpactStatus === "applied" ? "pending" : "not_required";
  } else if (["rejected", "cancelled"].includes(input.status)) appeal.scoreReversalStatus = "not_required";
  const saved = await appeal.save();
  try {
    if (input.status === "needs_more_info") await notifyUser({ userId: appeal.employeeId, restaurantId: appeal.restaurantId, type: "appeal_needs_more_info", sourceType: "performance_appeal", sourceId: String(appeal._id), actionUrl: "/staff/performance", payload: { title: "Cần bổ sung thông tin", message: "Phản hồi của bạn cần bổ sung thêm thông tin." } });
    if (input.status === "accepted") await notifyUser({ userId: appeal.employeeId, restaurantId: appeal.restaurantId, type: "appeal_accepted", sourceType: "performance_appeal", sourceId: String(appeal._id), actionUrl: "/staff/performance", payload: { title: "Phản hồi đã được chấp nhận", message: "Phản hồi của bạn đã được chấp nhận." } });
    if (input.status === "rejected") await notifyUser({ userId: appeal.employeeId, restaurantId: appeal.restaurantId, type: "appeal_rejected", sourceType: "performance_appeal", sourceId: String(appeal._id), actionUrl: "/staff/performance", payload: { title: "Phản hồi bị từ chối", message: "Phản hồi của bạn đã bị từ chối." } });
  } catch (error) { console.warn("Failed to create notification:", error.message); }
  return saved; }


export async function reverseScoreForAcceptedAppeal({ appealId, actor, reversalDelta, note }) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  if (!hasRole(actor, PERFORMANCE_REVIEW_ROLES)) throw new Error("FORBIDDEN");
  const appeal = await PerformanceIncidentAppeal.findById(appealId);
  if (!appeal) throw new Error("PERFORMANCE_INCIDENT_APPEAL_NOT_FOUND");
  await assertScope(actor, appeal.restaurantId);
  if (appeal.status !== "accepted") throw new Error("PERFORMANCE_APPEAL_NOT_ACCEPTED");
  if (appeal.scoreReversalStatus === "reversed" || appeal.scoreReversalId) throw new Error("PERFORMANCE_APPEAL_ALREADY_REVERSED");

  const incident = await PerformanceIncident.findById(appeal.incidentId);
  if (!incident) throw new Error("PERFORMANCE_INCIDENT_NOT_FOUND");
  if (incident.scoreImpactStatus !== "applied") throw new Error("PERFORMANCE_INCIDENT_NOT_APPLIED");
  const originalAdjustment = await StaffPerformanceScoreAdjustment.findById(incident.scoreAdjustmentId || null) || await StaffPerformanceScoreAdjustment.findOne({ incidentId: incident._id });
  if (!originalAdjustment) throw new Error("PERFORMANCE_ORIGINAL_ADJUSTMENT_NOT_FOUND");
  const baseAbs = Math.abs(Number(originalAdjustment.scoreDelta || incident.scoreDelta || 0));
  if (baseAbs < 0) throw new Error("PERFORMANCE_SCORE_DELTA_INVALID");
  const cleanNote = trim(note);
  if (!cleanNote) throw new Error("REVERSAL_NOTE_REQUIRED");
  const delta = typeof reversalDelta === 'undefined' || reversalDelta === null ? baseAbs : Number(reversalDelta);
  if (delta < 0) throw new Error("PERFORMANCE_REVERSAL_DELTA_INVALID");
  if (delta > baseAbs) throw new Error("PERFORMANCE_REVERSAL_DELTA_EXCEEDS_ORIGINAL");

  const { periodStart, periodEnd } = toPeriodBounds(incident.occurredAt);
  const snapshot = await StaffPerformanceSnapshot.findOne({ employeeId: incident.employeeId, restaurantId: incident.restaurantId, periodStart, periodEnd });
  if (!snapshot) throw new Error("STAFF_PERFORMANCE_SNAPSHOT_NOT_FOUND");
  const previousScore = Number(snapshot.finalPerformanceScore || SCORE_MAX);
  const newScore = Math.max(SCORE_MIN, Math.min(SCORE_MAX, previousScore + delta));
  const now = new Date();

  const reversal = await StaffPerformanceScoreReversal.create({
    restaurantId: incident.restaurantId, employeeId: incident.employeeId, incidentId: incident._id, appealId: appeal._id,
    originalAdjustmentId: originalAdjustment._id, reversalDelta: delta, previousScore, newScore, reversedBy: actor._id || actor.id, reversedAt: now, reason: "accepted_appeal", note: cleanNote,
    metadata: { incidentEventType: incident.eventType, incidentScoreDelta: Number(incident.scoreDelta || 0), originalAdjustmentScoreDelta: Number(originalAdjustment.scoreDelta || 0), appealReason: appeal.reason || "", decisionReason: appeal.decisionReason || "" },
  });
  snapshot.finalPerformanceScore = newScore;
  snapshot.performanceLevel = resolvePerformanceLevel(newScore);
  await snapshot.save();

  appeal.scoreReversalStatus = "reversed"; appeal.scoreReversalId = reversal._id; appeal.scoreReversedBy = actor._id || actor.id; appeal.scoreReversedAt = now; appeal.scoreReversalNote = cleanNote; appeal.scoreReversalDelta = delta;
  await appeal.save();

  incident.scoreReversalStatus = "reversed"; incident.scoreReversalId = reversal._id; incident.scoreReversedAt = now; incident.scoreReversalNote = cleanNote;
  await incident.save();
  try { await notifyUser({ userId: appeal.employeeId, restaurantId: appeal.restaurantId, type: "appeal_score_reversed", sourceType: "performance_appeal", sourceId: String(appeal._id), actionUrl: "/staff/performance", payload: { title: "Điểm hiệu suất đã được điều chỉnh", message: "Điểm hiệu suất của bạn đã được điều chỉnh sau khi phản hồi được chấp nhận." } }); } catch (error) { console.warn("Failed to create notification:", error.message); }
  return appeal;
}
