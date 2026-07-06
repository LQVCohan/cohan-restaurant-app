import {
  PerformanceIncident,
  Staff,
  StaffPerformanceScoreAdjustment,
  StaffPerformanceScoreReversal,
  StaffPerformanceSnapshot,
} from "../../../models/index.js";
import {
  PERFORMANCE_READ_ROLES,
  PERFORMANCE_SELF_ROLES,
} from "./performanceIncident.service.js";
import {
  resolveUserRoles,
  userCanAccessRestaurant,
} from "../scheduling/schedulingPermission.service.js";

function resolvePeriodBounds(input = {}) {
  if (input.fromDate || input.toDate) {
    return {
      periodStart: input.fromDate ? new Date(input.fromDate) : null,
      periodEnd: input.toDate ? new Date(input.toDate) : null,
    };
  }
  if (Number.isInteger(input.month) && Number.isInteger(input.year)) {
    const periodStart = new Date(
      Date.UTC(input.year, input.month - 1, 1, 0, 0, 0, 0),
    );
    const periodEnd = new Date(
      Date.UTC(input.year, input.month, 0, 23, 59, 59, 999),
    );
    return { periodStart, periodEnd };
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

async function assertReadPermission(
  actor,
  restaurantId,
  employeeId,
  { allowList = false } = {},
) {
  if (!actor) throw new Error("UNAUTHENTICATED");
  if (!restaurantId || !await userCanAccessRestaurant(actor, restaurantId)) {
    throw new Error("FORBIDDEN");
  }
  const roles = resolveUserRoles(actor);
  const actorId = String(actor?.id || actor?._id || "");
  if (roles.some((role) => PERFORMANCE_READ_ROLES.includes(role))) return;
  if (roles.some((role) => PERFORMANCE_SELF_ROLES.includes(role))) {
    if (allowList) throw new Error("FORBIDDEN");
    if (!employeeId || String(employeeId) !== actorId) {
      throw new Error("FORBIDDEN");
    }
    return;
  }
  throw new Error("FORBIDDEN");
}

function buildRangeFilter(field, periodStart, periodEnd) {
  if (!periodStart && !periodEnd) return {};
  return {
    [field]: {
      ...(periodStart ? { $gte: periodStart } : {}),
      ...(periodEnd ? { $lte: periodEnd } : {}),
    },
  };
}

function mapSummary({
  snapshot,
  restaurantId,
  employeeId,
  periodStart,
  periodEnd,
  adjustments,
  reversals,
  incidents,
}) {
  const appliedAdjustments = adjustments.filter(
    (row) => Number(row.scoreDelta || 0) !== 0,
  );
  const appliedReversals = reversals.filter(
    (row) => Number(row.reversalDelta || 0) !== 0,
  );
  const totalScoreDelta =
    appliedAdjustments.reduce(
      (acc, row) => acc + Number(row.scoreDelta || 0),
      0,
    ) +
    appliedReversals.reduce(
      (acc, row) => acc + Number(row.reversalDelta || 0),
      0,
    );
  const latestAppliedAt =
    [
      ...adjustments.map((row) => row.appliedAt),
      ...reversals.map((row) => row.reversedAt),
    ]
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ||
    null;

  const scoreBreakdownByEventType = Object.values(
    [
      ...appliedAdjustments.map((row) => ({
        eventType: String(
          row.reason || row.metadata?.incidentEventType || "unknown",
        ),
        delta: Number(row.scoreDelta || 0),
      })),
      ...appliedReversals.map((row) => ({
        eventType: "APPEAL_SCORE_REVERSED",
        delta: Number(row.reversalDelta || 0),
      })),
    ].reduce((acc, row) => {
      if (!acc[row.eventType]) {
        acc[row.eventType] = { eventType: row.eventType, totalDelta: 0, count: 0 };
      }
      acc[row.eventType].totalDelta += row.delta;
      acc[row.eventType].count += 1;
      return acc;
    }, {}),
  );

  const scoreBreakdownByResponsibilityStatus = Object.values(
    incidents
      .filter(
        (row) =>
          row.scoreImpactStatus === "applied" &&
          Number(row.scoreDelta || 0) !== 0,
      )
      .reduce((acc, row) => {
        const responsibilityStatus = String(
          row.responsibilityStatus || "unknown",
        );
        if (!acc[responsibilityStatus]) {
          acc[responsibilityStatus] = {
            responsibilityStatus,
            totalDelta: 0,
            count: 0,
          };
        }
        acc[responsibilityStatus].totalDelta += Number(row.scoreDelta || 0);
        acc[responsibilityStatus].count += 1;
        return acc;
      }, {}),
  );

  return {
    employeeId: String(employeeId),
    restaurantId: String(restaurantId),
    periodStart,
    periodEnd,
    finalPerformanceScore: Number(snapshot?.finalPerformanceScore ?? 0),
    baseScore: 100,
    totalScoreDelta,
    appliedAdjustmentCount: adjustments.length + reversals.length,
    pendingReviewIncidentCount: incidents.filter(
      (row) =>
        row.responsibilityStatus === "pending_review" ||
        row.scoreImpactStatus === "pending",
    ).length,
    eligibleIncidentCount: incidents.filter(
      (row) => row.scoreImpactStatus === "eligible",
    ).length,
    appliedIncidentCount: incidents.filter(
      (row) => row.scoreImpactStatus === "applied",
    ).length,
    waivedIncidentCount: incidents.filter(
      (row) => row.scoreImpactStatus === "waived",
    ).length,
    notApplicableIncidentCount: incidents.filter(
      (row) => row.scoreImpactStatus === "not_applicable",
    ).length,
    latestAppliedAt,
    scoreBreakdownByEventType,
    scoreBreakdownByResponsibilityStatus,
  };
}

export async function getStaffPerformanceSummary(input, actor) {
  const { restaurantId, employeeId } = input;
  await assertReadPermission(actor, restaurantId, employeeId);
  const { periodStart, periodEnd } = resolvePeriodBounds(input);
  const periodFilter = {
    ...(periodStart ? { periodEnd: { $gte: periodStart } } : {}),
    ...(periodEnd ? { periodStart: { $lte: periodEnd } } : {}),
  };
  const [snapshot, adjustments, reversals, incidents] = await Promise.all([
    StaffPerformanceSnapshot.findOne({
      restaurantId,
      employeeId,
      ...periodFilter,
    }).sort({ periodEnd: -1, createdAt: -1 }),
    StaffPerformanceScoreAdjustment.find({
      restaurantId,
      employeeId,
      ...buildRangeFilter("appliedAt", periodStart, periodEnd),
    }).sort({ appliedAt: -1, createdAt: -1 }),
    StaffPerformanceScoreReversal.find({
      restaurantId,
      employeeId,
      ...buildRangeFilter("reversedAt", periodStart, periodEnd),
    }).sort({ reversedAt: -1, createdAt: -1 }),
    PerformanceIncident.find({
      restaurantId,
      employeeId,
      ...buildRangeFilter("occurredAt", periodStart, periodEnd),
    }),
  ]);
  return mapSummary({
    snapshot,
    restaurantId,
    employeeId,
    periodStart,
    periodEnd,
    adjustments,
    reversals,
    incidents,
  });
}

export async function listStaffPerformanceSummaries(input, actor) {
  const { restaurantId } = input;
  await assertReadPermission(actor, restaurantId, null, { allowList: true });
  const { periodStart, periodEnd } = resolvePeriodBounds(input);
  const employeeFilter = input.employeeIds?.length
    ? { _id: { $in: input.employeeIds } }
    : {};
  const snapshotQuery = {
    restaurantId,
    ...(input.employeeIds?.length
      ? { employeeId: { $in: input.employeeIds } }
      : {}),
    ...(periodStart ? { periodEnd: { $gte: periodStart } } : {}),
    ...(periodEnd ? { periodStart: { $lte: periodEnd } } : {}),
  };

  const [snapshots, activeStaff] = await Promise.all([
    StaffPerformanceSnapshot.find(snapshotQuery).sort({
      finalPerformanceScore: 1,
      updatedAt: -1,
    }),
    Staff.find({
      ...employeeFilter,
      $or: [
        { restaurantForStaff: restaurantId },
        { refRestaurants: restaurantId },
      ],
      employmentStatus: "working",
      status: "active",
      deletedAt: null,
    })
      .select("_id")
      .lean(),
  ]);

  const employeeIds = Array.from(
    new Set([
      ...activeStaff.map((row) => String(row._id)),
      ...snapshots.map((row) => String(row.employeeId)),
    ]),
  );

  const summaries = await Promise.all(
    employeeIds.map((employeeId) =>
      getStaffPerformanceSummary(
        {
          restaurantId,
          employeeId,
          fromDate: periodStart,
          toDate: periodEnd,
        },
        actor,
      ),
    ),
  );

  return summaries
    .filter((row) =>
      typeof input.minScore === "number"
        ? row.finalPerformanceScore >= input.minScore
        : true,
    )
    .filter((row) =>
      typeof input.maxScore === "number"
        ? row.finalPerformanceScore <= input.maxScore
        : true,
    )
    .filter((row) =>
      input.onlyWithAdjustments ? row.appliedAdjustmentCount > 0 : true,
    )
    .sort(
      (left, right) =>
        left.finalPerformanceScore - right.finalPerformanceScore,
    )
    .slice(
      Number(input.offset || 0),
      Number(input.offset || 0) + Number(input.limit || 50),
    );
}

export async function listStaffPerformanceScoreAdjustments(input, actor) {
  await assertReadPermission(actor, input.restaurantId, input.employeeId);
  const query = {
    restaurantId: input.restaurantId,
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.incidentId ? { incidentId: input.incidentId } : {}),
    ...(input.eventType ? { reason: input.eventType } : {}),
    ...(input.appliedBy ? { appliedBy: input.appliedBy } : {}),
    ...buildRangeFilter(
      "appliedAt",
      input.fromDate ? new Date(input.fromDate) : null,
      input.toDate ? new Date(input.toDate) : null,
    ),
  };
  return StaffPerformanceScoreAdjustment.find(query)
    .sort({ appliedAt: -1, createdAt: -1 })
    .skip(Number(input.offset || 0))
    .limit(Number(input.limit || 50));
}

export async function getStaffPerformanceScoreTimeline(input, actor) {
  await assertReadPermission(actor, input.restaurantId, input.employeeId);
  const fromDate = input.fromDate ? new Date(input.fromDate) : null;
  const toDate = input.toDate ? new Date(input.toDate) : null;
  const adjustmentQuery = {
    restaurantId: input.restaurantId,
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.incidentId ? { incidentId: input.incidentId } : {}),
    ...(input.eventType ? { reason: input.eventType } : {}),
    ...(input.appliedBy ? { appliedBy: input.appliedBy } : {}),
    ...buildRangeFilter("appliedAt", fromDate, toDate),
  };
  const reversalQuery = {
    restaurantId: input.restaurantId,
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.incidentId ? { incidentId: input.incidentId } : {}),
    ...(input.eventType
      ? { "metadata.incidentEventType": input.eventType }
      : {}),
    ...(input.appliedBy ? { reversedBy: input.appliedBy } : {}),
    ...buildRangeFilter("reversedAt", fromDate, toDate),
  };
  const [adjustments, reversals] = await Promise.all([
    StaffPerformanceScoreAdjustment.find(adjustmentQuery).sort({
      appliedAt: 1,
      createdAt: 1,
    }),
    StaffPerformanceScoreReversal.find(reversalQuery).sort({
      reversedAt: 1,
      createdAt: 1,
    }),
  ]);
  const timeline = [
    ...adjustments.map((row) => ({
      at: row.appliedAt,
      score: Number(row.newScore || 0),
      scoreDelta: Number(row.scoreDelta || 0),
      incidentId: row.incidentId,
      eventType: row.reason || null,
      note: row.note || "",
    })),
    ...reversals.map((row) => ({
      at: row.reversedAt,
      score: Number(row.newScore || 0),
      scoreDelta: Number(row.reversalDelta || 0),
      incidentId: row.incidentId,
      eventType: "APPEAL_SCORE_REVERSED",
      note: row.note || "",
    })),
  ].sort(
    (left, right) =>
      new Date(left.at).getTime() - new Date(right.at).getTime(),
  );
  const offset = Math.max(Number(input.offset || 0), 0);
  const limit = Math.min(Math.max(Number(input.limit || 50), 1), 200);
  return timeline.slice(offset, offset + limit);
}
