import { PerformanceIncident } from "../../../models/index.js";
import { resolveUserRoles, userCanAccessRestaurant } from "../scheduling/schedulingPermission.service.js";
import { PERFORMANCE_READ_ROLES, PERFORMANCE_REVIEW_ROLES } from "./performanceIncident.service.js";

const ACCOUNTANT_ROLES = ["ACCOUNTANT"];
const MS_HOUR = 60 * 60 * 1000;
const MS_MINUTE = 60 * 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

async function assertQueueReadPermission(actor, restaurantId) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  if (!await userCanAccessRestaurant(actor, restaurantId)) throw new Error("FORBIDDEN");
  const roles = resolveUserRoles(actor);
  if (!roles.some((r) => PERFORMANCE_READ_ROLES.includes(r))) throw new Error("FORBIDDEN");
  return roles;
}

export function computeIncidentSlaStatus(incident, now = new Date()) {
  const needsReview = incident?.scoreImpactStatus === "pending" || incident?.scoreImpactStatus === "eligible" || incident?.responsibilityStatus === "pending_review";
  const resolved = ["waived", "applied", "not_applicable"].includes(String(incident?.scoreImpactStatus || ""));
  if (!needsReview || resolved) {
    return { slaDueAt: null, slaHours: 0, slaStatus: "not_required", overdueMinutes: 0, dueSoon: false };
  }
  const severity = String(incident?.severity || "info");
  const slaHours = severity === "critical" || severity === "violation" ? 24 : severity === "warning" ? 48 : 72;
  const base = incident?.detectedAt || incident?.createdAt;
  const dueAt = new Date(new Date(base).getTime() + slaHours * MS_HOUR);
  const diff = dueAt.getTime() - now.getTime();
  const overdueMinutes = diff < 0 ? Math.floor(Math.abs(diff) / MS_MINUTE) : 0;
  const dueSoon = diff >= 0 && diff <= 6 * MS_HOUR;
  const slaStatus = overdueMinutes > 0 ? "overdue" : dueSoon ? "due_soon" : "on_track";
  return { slaDueAt: dueAt, slaHours, slaStatus, overdueMinutes, dueSoon };
}

export function computeIncidentPriority(incident, now = new Date()) {
  const sla = computeIncidentSlaStatus(incident, now);
  const severity = String(incident?.severity || "info");
  if (severity === "critical") return "critical";
  if (sla.slaStatus === "overdue" && severity === "violation") return "critical";
  if (sla.slaStatus === "overdue") return "high";
  if (incident?.scoreImpactStatus === "eligible") return "high";
  if (severity === "violation") return "high";
  if (severity === "warning") return "medium";
  return "low";
}

function recommendedAction(incident) {
  if (incident?.scoreImpactStatus === "eligible") return "apply_or_waive";
  if (incident?.responsibilityStatus === "pending_review" || incident?.scoreImpactStatus === "pending") return "review";
  if (["waived", "applied", "not_applicable"].includes(incident?.scoreImpactStatus)) return "already_resolved";
  return "no_action";
}

function normalizeInput(input = {}) {
  const limit = Math.max(1, Math.min(Number(input.limit || DEFAULT_LIMIT), MAX_LIMIT));
  const offset = Math.max(0, Number(input.offset || 0));
  return { ...input, limit, offset };
}

function buildBaseQuery(input) {
  const q = { restaurantId: input.restaurantId };
  if (input.employeeId) q.employeeId = input.employeeId;
  const map = {
    eventTypes: "eventType",
    severities: "severity",
    responsibilityStatuses: "responsibilityStatus",
    scoreImpactStatuses: "scoreImpactStatus",
    sourceTypes: "sourceType",
  };
  Object.entries(map).forEach(([key, field]) => {
    if (Array.isArray(input[key]) && input[key].length) q[field] = { $in: input[key] };
  });
  if (input.fromDate || input.toDate) {
    q.occurredAt = {};
    if (input.fromDate) q.occurredAt.$gte = new Date(input.fromDate);
    if (input.toDate) q.occurredAt.$lte = new Date(input.toDate);
  }
  const hasExplicitStatus = (input.responsibilityStatuses?.length || input.scoreImpactStatuses?.length || input.onlyPendingReview || input.onlyEligible);
  if (!hasExplicitStatus) {
    q.$or = [{ responsibilityStatus: "pending_review" }, { scoreImpactStatus: { $in: ["pending", "eligible"] } }];
  }
  if (input.onlyPendingReview) q.responsibilityStatus = "pending_review";
  if (input.onlyEligible) q.scoreImpactStatus = "eligible";
  return q;
}

export async function listManagerIncidentReviewQueue(input, actor) {
  const normalized = normalizeInput(input);
  const roles = await assertQueueReadPermission(actor, normalized.restaurantId);
  const canMutate = roles.some((r) => PERFORMANCE_REVIEW_ROLES.includes(r)) && !roles.some((r) => ACCOUNTANT_ROLES.includes(r));
  const rows = await PerformanceIncident.find(buildBaseQuery(normalized)).sort({ createdAt: -1 }).lean();
  const now = new Date();
  let items = rows.map((incident) => {
    const sla = computeIncidentSlaStatus(incident, now);
    const priority = computeIncidentPriority(incident, now);
    return {
      incident,
      employeeId: String(incident.employeeId), restaurantId: String(incident.restaurantId),
      eventType: incident.eventType, severity: incident.severity, responsibilityStatus: incident.responsibilityStatus,
      scoreImpactStatus: incident.scoreImpactStatus, proposedScoreDelta: Number(incident.proposedScoreDelta || 0), scoreDelta: Number(incident.scoreDelta || 0),
      occurredAt: incident.occurredAt || null, detectedAt: incident.detectedAt || null, createdAt: incident.createdAt || null,
      ...sla, priority,
      recommendedAction: recommendedAction(incident),
      canReview: canMutate && incident.responsibilityStatus === "pending_review",
      canWaive: canMutate && ["pending", "eligible"].includes(incident.scoreImpactStatus),
      canMarkEligible: canMutate && incident.scoreImpactStatus === "pending",
      canApplyScore: canMutate && incident.scoreImpactStatus === "eligible",
    };
  });
  if (normalized.search) {
    const s = String(normalized.search).toLowerCase();
    items = items.filter((i) => [i.eventType, i.incident.sourceType, i.incident.note, i.incident.reviewNote, i.incident.waiveReason, i.incident.responsibilityNote].some((v) => String(v || "").toLowerCase().includes(s)));
  }
  if (normalized.onlyOverdue) items = items.filter((i) => i.slaStatus === "overdue");
  if (normalized.onlyDueSoon) items = items.filter((i) => i.dueSoon);

  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  items.sort((a, b) => (rank[b.priority] - rank[a.priority]) || ((a.slaStatus === "overdue") ? -1 : 0) || (new Date(a.slaDueAt || 8640000000000000) - new Date(b.slaDueAt || 8640000000000000)) || (new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0)));
  const totalCount = items.length;
  const paged = items.slice(normalized.offset, normalized.offset + normalized.limit);
  return { items: paged, totalCount, limit: normalized.limit, offset: normalized.offset, hasMore: normalized.offset + normalized.limit < totalCount };
}

function addBucket(map, key) { map.set(key, (map.get(key) || 0) + 1); }

export async function getManagerIncidentReviewQueueSummary(input, actor) {
  const roles = await assertQueueReadPermission(actor, input.restaurantId);
  void roles;
  const q = buildBaseQuery({ ...input, onlyPendingReview: false, onlyEligible: false });
  if (input.includeResolved) delete q.$or;
  const rows = await PerformanceIncident.find(q).sort({ createdAt: -1 }).lean();
  const now = new Date();
  const bySeverity = new Map(), byEventType = new Map(), byResp = new Map(), byImpact = new Map(), byEmployee = new Map();
  let pendingReviewCount = 0, eligibleCount = 0, overdueCount = 0, dueSoonCount = 0, waivedCount = 0, appliedCount = 0, notApplicableCount = 0;
  let criticalCount = 0, highPriorityCount = 0, mediumPriorityCount = 0, lowPriorityCount = 0;
  rows.forEach((r) => {
    const sla = computeIncidentSlaStatus(r, now); const priority = computeIncidentPriority(r, now);
    addBucket(bySeverity, r.severity); addBucket(byEventType, r.eventType); addBucket(byResp, r.responsibilityStatus); addBucket(byImpact, r.scoreImpactStatus);
    const eid = String(r.employeeId); const cur = byEmployee.get(eid) || { employeeId: eid, count: 0, pendingReviewCount: 0, eligibleCount: 0, overdueCount: 0, latestIncidentAt: null };
    cur.count += 1; if (r.responsibilityStatus === "pending_review") { pendingReviewCount += 1; cur.pendingReviewCount += 1; }
    if (r.scoreImpactStatus === "eligible") { eligibleCount += 1; cur.eligibleCount += 1; }
    if (r.scoreImpactStatus === "waived") waivedCount += 1;
    if (r.scoreImpactStatus === "applied") appliedCount += 1;
    if (r.scoreImpactStatus === "not_applicable") notApplicableCount += 1;
    if (sla.slaStatus === "overdue") { overdueCount += 1; cur.overdueCount += 1; }
    if (sla.dueSoon) dueSoonCount += 1;
    if (priority === "critical") criticalCount += 1; else if (priority === "high") highPriorityCount += 1; else if (priority === "medium") mediumPriorityCount += 1; else lowPriorityCount += 1;
    if (!cur.latestIncidentAt || new Date(r.occurredAt) > new Date(cur.latestIncidentAt)) cur.latestIncidentAt = r.occurredAt;
    byEmployee.set(eid, cur);
  });
  const totalOpen = rows.filter((r) => ["pending", "eligible"].includes(r.scoreImpactStatus) || r.responsibilityStatus === "pending_review").length;
  const mapArr = (m) => [...m.entries()].map(([key, count]) => ({ key, count }));
  return { restaurantId: String(input.restaurantId), totalOpen, pendingReviewCount, eligibleCount, overdueCount, dueSoonCount, waivedCount, appliedCount, notApplicableCount, criticalCount, highPriorityCount, mediumPriorityCount, lowPriorityCount, bySeverity: mapArr(bySeverity), byEventType: mapArr(byEventType), byResponsibilityStatus: mapArr(byResp), byScoreImpactStatus: mapArr(byImpact), byEmployee: [...byEmployee.values()] };
}
