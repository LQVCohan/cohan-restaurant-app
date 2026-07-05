import {
  PerformanceIncident,
  Staff,
  StaffPerformanceScoreAdjustment,
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
  incidents,
}) {
  const appliedAdjustments = adjustments.filter(
    (row) => Number(row.scoreDelta || 0) !== 0,
  );
  const totalScoreDelta = appliedAdjustments.reduce(
    (acc, row) => acc + Number(row.scoreDelta || 0),
    0,
  );
  const latestAppliedAt =
    adjustments
      .map((row) => row.appliedAt)
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ||
    null;

  const scoreBreakdownByEventType = Object.values(
    appliedAdjustments.reduce((acc, row) => {
      const eventType = String(
        row.reason || row.metadata?.incidentEventType || "unknown",
      );
      if (!acc[eventType]) {
        acc[eventType] = { eventType, totalDelta: 0, count: 0 };
      }
      acc[eventType].totalDelta += Number(row.scoreDelta || 0);
      acc[eventType].count += 1;
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
    appliedAdjustmentCount: adjustments.length,
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
  const [snapshot, adjustments, incidents] = await Promise.all([
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
  const adjustments = await listStaffPerformanceScoreAdjustments(input, actor);
  return adjustments
    .slice()
    .sort(
      (left, right) =>
        new Date(left.appliedAt).getTime() -
        new Date(right.appliedAt).getTime(),
    )
    .map((row) => ({
      at: row.appliedAt,
      score: Number(row.newScore || 0),
      scoreDelta: Number(row.scoreDelta || 0),
      incidentId: row.incidentId,
      eventType: row.reason || null,
      note: row.note || "",
    }));
}
