import {
  PerformanceIncident,
  Staff,
  StaffPerformanceScoreAdjustment,
} from "../../../models/index.js";
import { getStaffPerformanceSummary } from "./staffPerformanceReporting.service.js";
import {
  computeIncidentPriority,
  computeIncidentSlaStatus,
} from "./performanceIncidentQueue.service.js";
import {
  resolveUserRoles,
  userCanAccessRestaurant,
} from "../scheduling/schedulingPermission.service.js";
import { getStaffMembershipRestaurantFilter } from "../auth/restaurantScope.service.js";

const READ_ROLES = ["MANAGER", "ADMIN", "HR", "ACCOUNTANT"];

async function assertDashboardPermission(actor, restaurantId) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  if (!await userCanAccessRestaurant(actor, restaurantId)) {
    throw new Error("FORBIDDEN");
  }
  const roles = resolveUserRoles(actor);
  if (!roles.some((role) => READ_ROLES.includes(role))) {
    throw new Error("FORBIDDEN");
  }
}

function resolvePeriodBounds(input = {}) {
  if (input.fromDate || input.toDate) {
    return {
      periodStart: input.fromDate ? new Date(input.fromDate) : null,
      periodEnd: input.toDate ? new Date(input.toDate) : null,
    };
  }
  if (Number.isInteger(input.month) && Number.isInteger(input.year)) {
    return {
      periodStart: new Date(Date.UTC(input.year, input.month - 1, 1, 0, 0, 0, 0)),
      periodEnd: new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59, 999)),
    };
  }
  const now = new Date();
  return {
    periodStart: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    ),
    periodEnd: new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    ),
  };
}

async function resolveScopedEmployeeIds(input) {
  const membershipFilter = await getStaffMembershipRestaurantFilter(
    input.restaurantId,
  );
  const requestedIds = Array.isArray(input.employeeIds)
    ? new Set(input.employeeIds.map(String))
    : null;
  const staff = await Staff.find({
    ...membershipFilter,
    employmentStatus: "working",
    status: "active",
    deletedAt: null,
  })
    .select("_id")
    .lean();

  return staff
    .map((row) => String(row._id))
    .filter((employeeId) => !requestedIds || requestedIds.has(employeeId));
}

async function loadScopedSummaries(input, actor, periodStart, periodEnd) {
  const employeeIds = await resolveScopedEmployeeIds(input);
  return Promise.all(
    employeeIds.map((employeeId) =>
      getStaffPerformanceSummary(
        {
          restaurantId: input.restaurantId,
          employeeId,
          fromDate: periodStart,
          toDate: periodEnd,
        },
        actor,
      ),
    ),
  );
}

function getRiskLevel(row) {
  if (
    row.finalPerformanceScore < 50 ||
    row.overdueCount >= 3 ||
    row.totalScoreDelta <= -15
  ) {
    return "critical";
  }
  if (
    row.finalPerformanceScore < 70 ||
    row.overdueCount >= 1 ||
    row.eligibleCount >= 3 ||
    row.totalScoreDelta <= -8
  ) {
    return "high";
  }
  if (
    row.finalPerformanceScore < 85 ||
    row.pendingReviewCount >= 2 ||
    row.appliedAdjustmentCount >= 2
  ) {
    return "medium";
  }
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

function buildRiskEmployees(summaries, rows, lowScoreThreshold, limit) {
  const now = new Date();
  const byEmployee = new Map();

  rows.forEach((incident) => {
    const employeeId = String(incident.employeeId);
    const current = byEmployee.get(employeeId) || {
      pendingReviewCount: 0,
      overdueCount: 0,
      eligibleCount: 0,
      latestIncidentAt: null,
    };
    if (
      incident.responsibilityStatus === "pending_review" ||
      incident.scoreImpactStatus === "pending"
    ) {
      current.pendingReviewCount += 1;
    }
    if (incident.scoreImpactStatus === "eligible") current.eligibleCount += 1;
    if (computeIncidentSlaStatus(incident, now).slaStatus === "overdue") {
      current.overdueCount += 1;
    }
    if (
      !current.latestIncidentAt ||
      new Date(incident.occurredAt) > new Date(current.latestIncidentAt)
    ) {
      current.latestIncidentAt = incident.occurredAt;
    }
    byEmployee.set(employeeId, current);
  });

  const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  return summaries
    .map((summary) => {
      const incidentSummary = byEmployee.get(String(summary.employeeId)) || {};
      const row = {
        employeeId: summary.employeeId,
        finalPerformanceScore: Number(summary.finalPerformanceScore || 100),
        totalScoreDelta: Number(summary.totalScoreDelta || 0),
        pendingReviewCount: Number(incidentSummary.pendingReviewCount || 0),
        overdueCount: Number(incidentSummary.overdueCount || 0),
        eligibleCount: Number(
          summary.eligibleIncidentCount || incidentSummary.eligibleCount || 0,
        ),
        appliedAdjustmentCount: Number(summary.appliedAdjustmentCount || 0),
        latestIncidentAt: incidentSummary.latestIncidentAt || null,
      };
      return {
        ...row,
        riskLevel: getRiskLevel(row),
        riskReasons: getRiskReasons(row),
      };
    })
    .filter(
      (row) =>
        row.finalPerformanceScore < lowScoreThreshold || row.riskLevel !== "low",
    )
    .sort(
      (left, right) =>
        riskOrder[right.riskLevel] - riskOrder[left.riskLevel] ||
        left.finalPerformanceScore - right.finalPerformanceScore,
    )
    .slice(0, limit);
}

export async function getManagerPerformanceRiskEmployees(input, actor) {
  await assertDashboardPermission(actor, input.restaurantId);
  const { periodStart, periodEnd } = resolvePeriodBounds(input);
  const summaries = await loadScopedSummaries(
    input,
    actor,
    periodStart,
    periodEnd,
  );
  const employeeIds = summaries.map((summary) => summary.employeeId);
  const rows = employeeIds.length
    ? await PerformanceIncident.find({
        restaurantId: input.restaurantId,
        employeeId: { $in: employeeIds },
        occurredAt: {
          ...(periodStart ? { $gte: periodStart } : {}),
          ...(periodEnd ? { $lte: periodEnd } : {}),
        },
      }).lean()
    : [];
  return buildRiskEmployees(
    summaries,
    rows,
    Number(input.lowScoreThreshold ?? 70),
    Number(input.limit ?? 10),
  );
}

export async function getManagerPerformanceDashboard(input, actor) {
  await assertDashboardPermission(actor, input.restaurantId);
  const { periodStart, periodEnd } = resolvePeriodBounds(input);
  const summaries = await loadScopedSummaries(
    input,
    actor,
    periodStart,
    periodEnd,
  );
  const employeeIds = summaries.map((summary) => summary.employeeId);
  const employeeFilter = employeeIds.length
    ? { employeeId: { $in: employeeIds } }
    : { employeeId: { $in: [] } };
  const rangeFilter = {
    ...(periodStart ? { $gte: periodStart } : {}),
    ...(periodEnd ? { $lte: periodEnd } : {}),
  };
  const [rows, adjustments] = await Promise.all([
    PerformanceIncident.find({
      restaurantId: input.restaurantId,
      ...employeeFilter,
      occurredAt: rangeFilter,
    }).lean(),
    StaffPerformanceScoreAdjustment.find({
      restaurantId: input.restaurantId,
      ...employeeFilter,
      appliedAt: rangeFilter,
    }).lean(),
  ]);

  const now = new Date();
  const totalIncidents = rows.length;
  const openIncidents = rows.filter(
    (row) =>
      ["pending", "eligible"].includes(row.scoreImpactStatus) ||
      row.responsibilityStatus === "pending_review",
  ).length;
  const pendingReviewCount = rows.filter(
    (row) =>
      row.responsibilityStatus === "pending_review" ||
      row.scoreImpactStatus === "pending",
  ).length;
  const overdueCount = rows.filter(
    (row) => computeIncidentSlaStatus(row, now).slaStatus === "overdue",
  ).length;
  const dueSoonCount = rows.filter(
    (row) => computeIncidentSlaStatus(row, now).dueSoon,
  ).length;
  const eligibleCount = rows.filter(
    (row) => row.scoreImpactStatus === "eligible",
  ).length;
  const appliedCount = rows.filter(
    (row) => row.scoreImpactStatus === "applied",
  ).length;
  const waivedCount = rows.filter(
    (row) => row.scoreImpactStatus === "waived",
  ).length;
  const notApplicableCount = rows.filter(
    (row) => row.scoreImpactStatus === "not_applicable",
  ).length;
  const criticalCount = rows.filter(
    (row) => computeIncidentPriority(row, now) === "critical",
  ).length;
  const highPriorityCount = rows.filter(
    (row) => computeIncidentPriority(row, now) === "high",
  ).length;

  const scores = summaries.map((summary) =>
    Number(summary.finalPerformanceScore || 100),
  );
  const lowScoreThreshold = Number(input.lowScoreThreshold ?? 70);
  const totalScoreDelta = adjustments.reduce(
    (total, adjustment) => total + Number(adjustment.scoreDelta || 0),
    0,
  );
  const riskEmployees = buildRiskEmployees(
    summaries,
    rows,
    lowScoreThreshold,
    Number(input.limit ?? 10),
  );

  const topEventTypesMap = new Map();
  const responsibilityMap = new Map();
  rows.forEach((row) => {
    const eventType = String(row.eventType || "unknown");
    const eventBucket = topEventTypesMap.get(eventType) || {
      eventType,
      count: 0,
      appliedCount: 0,
      waivedCount: 0,
      totalScoreDelta: 0,
    };
    eventBucket.count += 1;
    if (row.scoreImpactStatus === "applied") {
      eventBucket.appliedCount += 1;
      eventBucket.totalScoreDelta += Number(row.scoreDelta || 0);
    }
    if (row.scoreImpactStatus === "waived") eventBucket.waivedCount += 1;
    topEventTypesMap.set(eventType, eventBucket);

    const responsibilityStatus = String(
      row.responsibilityStatus || "unknown",
    );
    const responsibilityBucket = responsibilityMap.get(responsibilityStatus) || {
      responsibilityStatus,
      count: 0,
      totalScoreDelta: 0,
    };
    responsibilityBucket.count += 1;
    if (row.scoreImpactStatus === "applied") {
      responsibilityBucket.totalScoreDelta += Number(row.scoreDelta || 0);
    }
    responsibilityMap.set(responsibilityStatus, responsibilityBucket);
  });

  const recommendedActions = [
    {
      action: "review_overdue_incidents",
      count: overdueCount,
      priority: overdueCount > 0 ? "high" : "low",
    },
    {
      action: "apply_or_waive_eligible_incidents",
      count: eligibleCount,
      priority: eligibleCount > 0 ? "high" : "low",
    },
    {
      action: "review_low_score_employees",
      count: riskEmployees.filter(
        (row) => row.finalPerformanceScore < lowScoreThreshold,
      ).length,
      priority: riskEmployees.some((row) =>
        ["critical", "high"].includes(row.riskLevel),
      )
        ? "high"
        : "medium",
    },
    {
      action: "check_repeated_off_schedule",
      count: topEventTypesMap.get("off_schedule")?.count || 0,
      priority:
        (topEventTypesMap.get("off_schedule")?.count || 0) > 0
          ? "medium"
          : "low",
    },
    {
      action: "check_repeated_corrections",
      count: topEventTypesMap.get("attendance_correction")?.count || 0,
      priority:
        (topEventTypesMap.get("attendance_correction")?.count || 0) > 0
          ? "medium"
          : "low",
    },
  ];

  return {
    period: {
      restaurantId: String(input.restaurantId),
      periodStart,
      periodEnd,
    },
    incidentOverview: {
      totalIncidents,
      openIncidents,
      pendingReviewCount,
      overdueCount,
      dueSoonCount,
      eligibleCount,
      appliedCount,
      waivedCount,
      notApplicableCount,
      criticalCount,
      highPriorityCount,
    },
    scoringOverview: {
      averageScore: scores.length
        ? scores.reduce((total, score) => total + score, 0) / scores.length
        : 0,
      lowestScore: scores.length ? Math.min(...scores) : 0,
      highestScore: scores.length ? Math.max(...scores) : 0,
      lowScoreEmployeeCount: scores.filter(
        (score) => score < lowScoreThreshold,
      ).length,
      totalScoreDelta,
      appliedAdjustmentCount: adjustments.length,
      eligibleScoreDeltaPending: rows
        .filter((row) => row.scoreImpactStatus === "eligible")
        .reduce(
          (total, row) => total + Number(row.proposedScoreDelta || 0),
          0,
        ),
      waivedScoreDelta: rows
        .filter((row) => row.scoreImpactStatus === "waived")
        .reduce(
          (total, row) => total + Number(row.proposedScoreDelta || 0),
          0,
        ),
    },
    slaOverview: {
      totalRequiringReview: openIncidents,
      overdueCount,
      dueSoonCount,
      onTrackCount: Math.max(0, openIncidents - overdueCount - dueSoonCount),
      slaComplianceRate: openIncidents
        ? (openIncidents - overdueCount) / openIncidents
        : 1,
      averageResolutionHours: 0,
      oldestOpenIncidentAt:
        rows
          .filter((row) =>
            ["pending", "eligible"].includes(row.scoreImpactStatus),
          )
          .sort(
            (left, right) =>
              new Date(left.createdAt) - new Date(right.createdAt),
          )[0]?.createdAt || null,
    },
    topRiskEmployees: riskEmployees,
    topEventTypes: [...topEventTypesMap.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, Number(input.limit ?? 10)),
    responsibilityBreakdown: [...responsibilityMap.values()].sort(
      (left, right) => right.count - left.count,
    ),
    recommendedActions,
  };
}

export async function getManagerPerformanceDashboardTrends() {
  return { points: [] };
}
