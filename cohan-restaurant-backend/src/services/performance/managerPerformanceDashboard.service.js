import { PerformanceIncident, StaffPerformanceScoreAdjustment } from "../../../models/index.js";
import { listStaffPerformanceSummaries } from "./staffPerformanceReporting.service.js";
import {
  computeIncidentPriority,
  computeIncidentSlaStatus,
} from "./performanceIncidentQueue.service.js";
import { resolveUserRoles, userCanAccessRestaurant } from "../scheduling/schedulingPermission.service.js";

const READ_ROLES = ["MANAGER", "ADMIN", "HR", "ACCOUNTANT"];

async function assertDashboardPermission(actor, restaurantId) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  if (!await userCanAccessRestaurant(actor, restaurantId)) throw new Error("FORBIDDEN");
  const roles = resolveUserRoles(actor);
  if (!roles.some((r) => READ_ROLES.includes(r))) throw new Error("FORBIDDEN");
}

function resolvePeriodBounds(input = {}) {
  if (input.fromDate || input.toDate) return { periodStart: input.fromDate ? new Date(input.fromDate) : null, periodEnd: input.toDate ? new Date(input.toDate) : null };
  if (Number.isInteger(input.month) && Number.isInteger(input.year)) {
    return { periodStart: new Date(Date.UTC(input.year, input.month - 1, 1, 0, 0, 0, 0)), periodEnd: new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59, 999)) };
  }
  const now = new Date();
  return { periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)), periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)) };
}

function getRiskLevel(row) {
  if (row.finalPerformanceScore < 50 || row.overdueCount >= 3 || row.totalScoreDelta <= -15) return "critical";
  if (row.finalPerformanceScore < 70 || row.overdueCount >= 1 || row.eligibleCount >= 3 || row.totalScoreDelta <= -8) return "high";
  if (row.finalPerformanceScore < 85 || row.pendingReviewCount >= 2 || row.appliedAdjustmentCount >= 2) return "medium";
  return "low";
}

function getRiskReasons(row) {
  const reasons = [];
  if (row.finalPerformanceScore < 70) reasons.push("low_score");
  if (row.overdueCount >= 1) reasons.push("overdue_incidents");
  if (row.pendingReviewCount >= 2) reasons.push("many_pending_reviews");
  if (row.totalScoreDelta <= -8) reasons.push("large_score_delta");
  if (row.eligibleCount >= 3) reasons.push("many_eligible_incidents");
  return reasons;
}

export async function getManagerPerformanceRiskEmployees(input, actor) {
  const lowScoreThreshold = Number(input.lowScoreThreshold ?? 70);
  const limit = Number(input.limit ?? 10);
  const summaries = await listStaffPerformanceSummaries({ ...input, minScore: undefined, maxScore: undefined, onlyWithAdjustments: false, limit: 500, offset: 0 }, actor);
  const q = { restaurantId: input.restaurantId, ...(input.employeeIds?.length ? { employeeId: { $in: input.employeeIds } } : {}) };
  const rows = await PerformanceIncident.find(q).lean();
  const now = new Date();
  const byEmp = new Map();
  rows.forEach((r) => {
    const id = String(r.employeeId);
    const cur = byEmp.get(id) || { pendingReviewCount: 0, overdueCount: 0, eligibleCount: 0, latestIncidentAt: null };
    if (r.responsibilityStatus === "pending_review" || r.scoreImpactStatus === "pending") cur.pendingReviewCount += 1;
    if (r.scoreImpactStatus === "eligible") cur.eligibleCount += 1;
    if (computeIncidentSlaStatus(r, now).slaStatus === "overdue") cur.overdueCount += 1;
    if (!cur.latestIncidentAt || new Date(r.occurredAt) > new Date(cur.latestIncidentAt)) cur.latestIncidentAt = r.occurredAt;
    byEmp.set(id, cur);
  });
  const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  return summaries
    .map((s) => {
      const m = byEmp.get(String(s.employeeId)) || {};
      const row = {
        employeeId: s.employeeId,
        finalPerformanceScore: Number(s.finalPerformanceScore || 100),
        totalScoreDelta: Number(s.totalScoreDelta || 0),
        pendingReviewCount: Number(m.pendingReviewCount || 0),
        overdueCount: Number(m.overdueCount || 0),
        eligibleCount: Number(s.eligibleIncidentCount || m.eligibleCount || 0),
        appliedAdjustmentCount: Number(s.appliedAdjustmentCount || 0),
        latestIncidentAt: m.latestIncidentAt || null,
      };
      return { ...row, riskLevel: getRiskLevel(row), riskReasons: getRiskReasons(row) };
    })
    .filter((r) => r.finalPerformanceScore < lowScoreThreshold || r.riskLevel !== "low")
    .sort((a, b) => (riskOrder[b.riskLevel] - riskOrder[a.riskLevel]) || (a.finalPerformanceScore - b.finalPerformanceScore))
    .slice(0, limit);
}

export async function getManagerPerformanceDashboard(input, actor) {
  await assertDashboardPermission(actor, input.restaurantId);
  const { periodStart, periodEnd } = resolvePeriodBounds(input);
  const incidentQuery = { restaurantId: input.restaurantId, ...(input.employeeIds?.length ? { employeeId: { $in: input.employeeIds } } : {}), ...(periodStart || periodEnd ? { occurredAt: { ...(periodStart ? { $gte: periodStart } : {}), ...(periodEnd ? { $lte: periodEnd } : {}) } } : {}) };
  const rows = await PerformanceIncident.find(incidentQuery).lean();
  const now = new Date();
  const totalIncidents = rows.length;
  const openIncidents = rows.filter((r) => ["pending", "eligible"].includes(r.scoreImpactStatus) || r.responsibilityStatus === "pending_review").length;
  const pendingReviewCount = rows.filter((r) => r.responsibilityStatus === "pending_review" || r.scoreImpactStatus === "pending").length;
  const overdueCount = rows.filter((r) => computeIncidentSlaStatus(r, now).slaStatus === "overdue").length;
  const dueSoonCount = rows.filter((r) => computeIncidentSlaStatus(r, now).dueSoon).length;
  const eligibleCount = rows.filter((r) => r.scoreImpactStatus === "eligible").length;
  const appliedCount = rows.filter((r) => r.scoreImpactStatus === "applied").length;
  const waivedCount = rows.filter((r) => r.scoreImpactStatus === "waived").length;
  const notApplicableCount = rows.filter((r) => r.scoreImpactStatus === "not_applicable").length;
  const criticalCount = rows.filter((r) => computeIncidentPriority(r, now) === "critical").length;
  const highPriorityCount = rows.filter((r) => computeIncidentPriority(r, now) === "high").length;

  const summaries = await listStaffPerformanceSummaries({ ...input, fromDate: periodStart, toDate: periodEnd, limit: 500, offset: 0 }, actor);
  const adjustments = await StaffPerformanceScoreAdjustment.find({ restaurantId: input.restaurantId, ...(input.employeeIds?.length ? { employeeId: { $in: input.employeeIds } } : {}), ...(periodStart || periodEnd ? { appliedAt: { ...(periodStart ? { $gte: periodStart } : {}), ...(periodEnd ? { $lte: periodEnd } : {}) } } : {}) }).lean();
  const scores = summaries.map((s) => Number(s.finalPerformanceScore || 100));
  const lowScoreThreshold = Number(input.lowScoreThreshold ?? 70);
  const totalScoreDelta = adjustments.reduce((a, r) => a + Number(r.scoreDelta || 0), 0);
  const riskEmployees = await getManagerPerformanceRiskEmployees({ ...input, fromDate: periodStart, toDate: periodEnd }, actor);

  const topEventTypesMap = new Map();
  const respMap = new Map();
  rows.forEach((r) => {
    const e = String(r.eventType || "unknown");
    const cur = topEventTypesMap.get(e) || { eventType: e, count: 0, appliedCount: 0, waivedCount: 0, totalScoreDelta: 0 };
    cur.count += 1;
    if (r.scoreImpactStatus === "applied") { cur.appliedCount += 1; cur.totalScoreDelta += Number(r.scoreDelta || 0); }
    if (r.scoreImpactStatus === "waived") cur.waivedCount += 1;
    topEventTypesMap.set(e, cur);
    const rs = String(r.responsibilityStatus || "unknown");
    const rb = respMap.get(rs) || { responsibilityStatus: rs, count: 0, totalScoreDelta: 0 };
    rb.count += 1; if (r.scoreImpactStatus === "applied") rb.totalScoreDelta += Number(r.scoreDelta || 0);
    respMap.set(rs, rb);
  });

  const recommendedActions = [
    { action: "review_overdue_incidents", count: overdueCount, priority: overdueCount > 0 ? "high" : "low" },
    { action: "apply_or_waive_eligible_incidents", count: eligibleCount, priority: eligibleCount > 0 ? "high" : "low" },
    { action: "review_low_score_employees", count: riskEmployees.filter((r) => r.finalPerformanceScore < lowScoreThreshold).length, priority: riskEmployees.some((r) => ["critical", "high"].includes(r.riskLevel)) ? "high" : "medium" },
    { action: "check_repeated_off_schedule", count: (topEventTypesMap.get("off_schedule")?.count || 0), priority: (topEventTypesMap.get("off_schedule")?.count || 0) > 0 ? "medium" : "low" },
    { action: "check_repeated_corrections", count: (topEventTypesMap.get("attendance_correction")?.count || 0), priority: (topEventTypesMap.get("attendance_correction")?.count || 0) > 0 ? "medium" : "low" },
  ];

  return {
    period: { restaurantId: String(input.restaurantId), periodStart, periodEnd },
    incidentOverview: { totalIncidents, openIncidents, pendingReviewCount, overdueCount, dueSoonCount, eligibleCount, appliedCount, waivedCount, notApplicableCount, criticalCount, highPriorityCount },
    scoringOverview: { averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0, lowestScore: scores.length ? Math.min(...scores) : 0, highestScore: scores.length ? Math.max(...scores) : 0, lowScoreEmployeeCount: scores.filter((s) => s < lowScoreThreshold).length, totalScoreDelta, appliedAdjustmentCount: adjustments.length, eligibleScoreDeltaPending: rows.filter((r) => r.scoreImpactStatus === "eligible").reduce((a, r) => a + Number(r.proposedScoreDelta || 0), 0), waivedScoreDelta: rows.filter((r) => r.scoreImpactStatus === "waived").reduce((a, r) => a + Number(r.proposedScoreDelta || 0), 0) },
    slaOverview: { totalRequiringReview: openIncidents, overdueCount, dueSoonCount, onTrackCount: Math.max(0, openIncidents - overdueCount - dueSoonCount), slaComplianceRate: openIncidents ? (openIncidents - overdueCount) / openIncidents : 1, averageResolutionHours: 0, oldestOpenIncidentAt: rows.filter((r) => ["pending", "eligible"].includes(r.scoreImpactStatus)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]?.createdAt || null },
    topRiskEmployees: riskEmployees,
    topEventTypes: [...topEventTypesMap.values()].sort((a, b) => b.count - a.count).slice(0, Number(input.limit ?? 10)),
    responsibilityBreakdown: [...respMap.values()].sort((a, b) => b.count - a.count),
    recommendedActions,
  };
}

export async function getManagerPerformanceDashboardTrends() {
  return { points: [] };
}
