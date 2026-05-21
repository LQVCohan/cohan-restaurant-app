import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  Order,
  Review,
  Shift,
  Staff,
  StaffPerformanceReview,
  StaffPerformanceSnapshot,
  Timesheet,
  KitchenOrderWorkItem,
} from "../../../models/index.js";
import { markUnacceptedKitchenOrderWorkItems } from "../kitchen/kitchenOrderWorkItem.service.js";

const { Types } = mongoose;

export const PERFORMANCE_WEIGHTS = {
  productivity: 25,
  punctuality: 25,
  quality: 20,
  managerReview: 20,
  compliance: 10,
};

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new Types.ObjectId(value);
}

function toValidDate(value, fieldName) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }
  return date;
}

function toStartOfDay(value) {
  const date = toValidDate(value, "Ngày bắt đầu");
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(value) {
  const date = toValidDate(value, "Ngày kết thúc");
  date.setHours(23, 59, 59, 999);
  return date;
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getActorId(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
}

function getActorName(ctx) {
  return (
    ctx?.user?.fullName ||
    ctx?.user?.name ||
    ctx?.user?.username ||
    ctx?.user?.email ||
    "Người dùng"
  );
}

function getActorRole(ctx) {
  return normalizeRole(
    ctx?.user?.roleName ||
      ctx?.user?.userType ||
      ctx?.user?.role?.slug ||
      ctx?.user?.role ||
      "",
  );
}

function assertCanManagePerformance(ctx) {
  const role = getActorRole(ctx);
  if (!["admin", "manager", "hr"].includes(role)) {
    throw new Error("Bạn không có quyền cập nhật hiệu suất nhân viên.");
  }
}

function assertCanViewPerformance(ctx, employeeId) {
  const role = getActorRole(ctx);
  const actorId = getActorId(ctx);

  if (["admin", "manager", "hr", "accountant"].includes(role)) return;

  if (role === "staff" && actorId && String(actorId) === String(employeeId)) {
    return;
  }

  throw new Error("Bạn không có quyền xem hiệu suất nhân viên này.");
}

function clampScore(value, fallback = 75) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getOverlapMinutes(start, end, rangeStart, rangeEnd) {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const fromDate = rangeStart ? new Date(rangeStart) : null;
  const toDate = rangeEnd ? new Date(rangeEnd) : null;
  if (
    !startDate ||
    !endDate ||
    !fromDate ||
    !toDate ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime())
  ) {
    return 0;
  }
  const overlapStart = Math.max(startDate.getTime(), fromDate.getTime());
  const overlapEnd = Math.min(endDate.getTime(), toDate.getTime());
  if (overlapEnd <= overlapStart) return 0;
  return (overlapEnd - overlapStart) / (1000 * 60);
}

function sumScheduledMinutes(shifts, periodStart, periodEnd) {
  return Math.round(
    (shifts || []).reduce(
      (sum, shift) =>
        sum +
        getOverlapMinutes(shift?.startTime, shift?.endTime, periodStart, periodEnd),
      0,
    ),
  );
}

function weightedFinalScore(components) {
  const totalWeight = Object.values(PERFORMANCE_WEIGHTS).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  if (totalWeight <= 0) return 75;

  const raw =
    (components.productivity.score * PERFORMANCE_WEIGHTS.productivity +
      components.punctuality.score * PERFORMANCE_WEIGHTS.punctuality +
      components.quality.score * PERFORMANCE_WEIGHTS.quality +
      components.managerReview.score * PERFORMANCE_WEIGHTS.managerReview +
      components.compliance.score * PERFORMANCE_WEIGHTS.compliance) /
    totalWeight;

  return clampScore(raw);
}

export function resolvePerformanceLevel(score) {
  const n = Number(score || 0);

  if (n >= 90) return "excellent";
  if (n >= 80) return "good";
  if (n >= 65) return "average";
  if (n >= 50) return "needs_attention";
  return "poor";
}

function mapSnapshot(doc) {
  if (!doc) return null;

  const employee = doc.employeeId;

  return {
    id: String(doc._id),

    employeeId: String(employee?._id || employee),
    employeeName: employee?.fullName || null,
    employeeCode: employee?.employeeCode || null,
    employeeRole: employee?.positionTitle || employee?.roleName || null,
    employeeAvatar: employee?.avatarUrl || employee?.avatar || null,

    restaurantId: String(doc.restaurantId),
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,

    productivity: doc.productivity,
    punctuality: doc.punctuality,
    quality: doc.quality,
    managerReview: doc.managerReview,
    compliance: doc.compliance,

    finalPerformanceScore: Number(doc.finalPerformanceScore || 0),
    performanceLevel: doc.performanceLevel || "average",

    factors: doc.factors || {},

    generatedBy: doc.generatedBy ? String(doc.generatedBy) : null,
    generatedByName: doc.generatedByName || "",

    reviewedBy: doc.reviewedBy ? String(doc.reviewedBy) : null,
    reviewedAt: doc.reviewedAt || null,
    lockedAt: doc.lockedAt || null,

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function mapReview(doc) {
  if (!doc) return null;

  const employee = doc.employeeId;

  return {
    id: String(doc._id),

    employeeId: String(employee?._id || employee),
    employeeName: employee?.fullName || null,
    employeeCode: employee?.employeeCode || null,

    restaurantId: String(doc.restaurantId),
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,

    managerRatingScore: Number(doc.managerRatingScore || 0),
    attitudeScore: Number(doc.attitudeScore || 0),
    teamworkScore: Number(doc.teamworkScore || 0),
    skillScore: Number(doc.skillScore || 0),

    note: doc.note || "",

    reviewedBy: doc.reviewedBy ? String(doc.reviewedBy) : null,
    reviewedByName: doc.reviewedByName || "",

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

async function getPeerOrderBenchmark({ restaurantId, periodStart, periodEnd }) {
  const rows = await Order.aggregate([
    {
      $match: {
        restaurantId,
        userId: { $ne: null },
        createdAt: { $gte: periodStart, $lte: periodEnd },
        currentStatus: { $in: ["served", "completed", "paid"] },
      },
    },
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
      },
    },
    {
      $sort: { orderCount: -1 },
    },
  ]);

  const maxOrders = Number(rows?.[0]?.orderCount || 0);

  return {
    maxOrders,
    byEmployeeId: new Map(
      rows.map((row) => [String(row._id), Number(row.orderCount || 0)]),
    ),
  };
}


function buildKitchenMetricsMatchForEmployee({
  employeeId,
  restaurantId,
  periodStart,
  periodEnd,
}) {
  return {
    restaurantId,
    kitchenEnteredAt: { $gte: periodStart, $lte: periodEnd },
    $or: [
      { headChefId: employeeId },
      { assistantChefIds: employeeId },
      { teamEmployeeIds: employeeId },
      { barLeadId: employeeId },
      { barStaffIds: employeeId },
      { unacceptedResponsibleEmployeeIds: employeeId },
    ],
  };
}

function resolveKitchenMetricRoleForEmployee(workItem, employeeId) {
  const employeeIdText = String(employeeId || "");
  const hasInArray = (arr) =>
    Array.isArray(arr) && arr.some((item) => String(item || "") === employeeIdText);

  return {
    isHeadChef: String(workItem?.headChefId || "") === employeeIdText,
    isAssistant: hasInArray(workItem?.assistantChefIds),
    isTeam: hasInArray(workItem?.teamEmployeeIds),
    isBarLead: String(workItem?.barLeadId || "") === employeeIdText,
    isBarStaff: hasInArray(workItem?.barStaffIds),
    isUnacceptedResponsible: hasInArray(workItem?.unacceptedResponsibleEmployeeIds),
  };
}

function buildKitchenMetricsSummary(workItems = [], employeeId) {
  const summary = {
    totalItems: 0,
    kitchenItems: 0,
    barItems: 0,
    preparedItems: 0,
    servedItems: 0,
    cancelledItems: 0,
    returnedItems: 0,
    onTimeItems: 0,
    lateItems: 0,
    veryLateItems: 0,
    unacceptedItems: 0,
    headChefItems: 0,
    assistantItems: 0,
    teamItems: 0,
    barLeadItems: 0,
    barStaffItems: 0,
    unacceptedResponsibleItems: 0,
    avgPrepMinutes: 0,
    targetPrepMinutesAvg: 0,
    noRosterItems: 0,
    attributionSource: "kitchen_order_work_items",
    affectsScore: false,
    note: "Không có dữ liệu bếp/bar liên quan nhân viên trong kỳ.",
  };

  const actualPrepValues = [];
  const targetPrepValues = [];

  for (const workItem of workItems) {
    summary.totalItems += 1;
    const roleFlags = resolveKitchenMetricRoleForEmployee(workItem, employeeId);

    if (workItem?.station === "kitchen") summary.kitchenItems += 1;
    if (workItem?.station === "bar") summary.barItems += 1;
    if (["ready", "served"].includes(workItem?.status) || workItem?.readyAt) summary.preparedItems += 1;
    if (workItem?.status === "served" || workItem?.servedAt) summary.servedItems += 1;
    if (workItem?.status === "cancelled" || workItem?.cancelledAt) summary.cancelledItems += 1;
    if (workItem?.status === "returned" || workItem?.returnedAt) summary.returnedItems += 1;
    if (workItem?.timeLevel === "on_time") summary.onTimeItems += 1;
    if (workItem?.timeLevel === "late") summary.lateItems += 1;
    if (workItem?.timeLevel === "very_late") summary.veryLateItems += 1;
    if (workItem?.noRoster === true) summary.noRosterItems += 1;

    if (roleFlags.isHeadChef) summary.headChefItems += 1;
    if (roleFlags.isAssistant) summary.assistantItems += 1;
    if (roleFlags.isTeam) summary.teamItems += 1;
    if (roleFlags.isBarLead) summary.barLeadItems += 1;
    if (roleFlags.isBarStaff) summary.barStaffItems += 1;
    if (roleFlags.isUnacceptedResponsible) summary.unacceptedResponsibleItems += 1;

    if (workItem?.unaccepted === true && roleFlags.isUnacceptedResponsible) {
      summary.unacceptedItems += 1;
    }

    const actualPrepMinutes = Number(workItem?.actualPrepMinutes);
    if (Number.isFinite(actualPrepMinutes) && actualPrepMinutes >= 0) actualPrepValues.push(actualPrepMinutes);

    const targetPrepMinutes = Number(workItem?.targetPrepMinutes);
    if (Number.isFinite(targetPrepMinutes) && targetPrepMinutes > 0) targetPrepValues.push(targetPrepMinutes);
  }

  if (actualPrepValues.length > 0) {
    const avg = actualPrepValues.reduce((sum, v) => sum + v, 0) / actualPrepValues.length;
    summary.avgPrepMinutes = Math.round(avg * 10) / 10;
  }

  if (targetPrepValues.length > 0) {
    const avg = targetPrepValues.reduce((sum, v) => sum + v, 0) / targetPrepValues.length;
    summary.targetPrepMinutesAvg = Math.round(avg * 10) / 10;
  }

  if (summary.totalItems > 0) {
    summary.note = "Dữ liệu bếp/bar chỉ dùng tham khảo, chưa ảnh hưởng điểm hiệu suất.";
  }

  return summary;
}

async function getKitchenMetricsForEmployee({ employeeId, restaurantId, periodStart, periodEnd }) {
  const match = buildKitchenMetricsMatchForEmployee({ employeeId, restaurantId, periodStart, periodEnd });
  const workItems = await KitchenOrderWorkItem.find(match).lean();
  return buildKitchenMetricsSummary(workItems, employeeId);
}
async function calculateSnapshotForEmployee({
  employeeId,
  restaurantId,
  periodStart,
  periodEnd,
  ctx,
}) {
  const staff = await Staff.findById(employeeId).lean();

  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const [timesheets, shifts, correctionsCount, review, benchmark, customerRatingAgg, kitchenMetrics] =
    await Promise.all([
      Timesheet.find({
        employeeId,
        restaurantId,
        workDate: { $gte: periodStart, $lte: periodEnd },
      }).lean(),

      Shift.find({
        employeeId,
        restaurantId,
        startTime: { $lte: periodEnd },
        endTime: { $gte: periodStart },
        status: { $ne: "cancelled" },
      }).lean(),

      AttendanceCorrectionRequest.countDocuments({
        employeeId,
        restaurantId,
        workDate: { $gte: periodStart, $lte: periodEnd },
        status: { $in: ["pending", "approved", "applied", "rejected"] },
      }),

      StaffPerformanceReview.findOne({
        employeeId,
        restaurantId,
        periodStart,
        periodEnd,
      }).lean(),

      getPeerOrderBenchmark({
        restaurantId,
        periodStart,
        periodEnd,
      }),
      Review.aggregate([
        {
          $match: {
            staffId: employeeId,
            restaurantId,
            createdAt: { $gte: periodStart, $lte: periodEnd },
            status: "published",
            rating: { $gte: 1, $lte: 5 },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
      getKitchenMetricsForEmployee({ employeeId, restaurantId, periodStart, periodEnd }),
    ]);

  const staffRateRaw = Number(customerRatingAgg?.[0]?.averageRating || 0);
  const staffRate = Number.isFinite(staffRateRaw)
    ? Math.round(staffRateRaw * 100) / 100
    : 0;
  const staffRateCount = Number(customerRatingAgg?.[0]?.totalReviews || 0);
  const customerRatingScore = clampScore(staffRate * 20, 0);

  const orderCount = benchmark.byEmployeeId.get(String(employeeId)) || 0;
  const shiftsCount = shifts.length;
  const scheduledMinutes = sumScheduledMinutes(shifts, periodStart, periodEnd);
  const actualWorkedMinutes = Math.round(
    timesheets.reduce((sum, row) => {
      const workedMinutes = Number(row?.workedMinutes);
      if (Number.isFinite(workedMinutes) && workedMinutes > 0) {
        return sum + workedMinutes;
      }
      const checkIn = row?.actualCheckInAt ? new Date(row.actualCheckInAt) : null;
      const checkOut = row?.actualCheckOutAt ? new Date(row.actualCheckOutAt) : null;
      if (
        !checkIn ||
        !checkOut ||
        Number.isNaN(checkIn.getTime()) ||
        Number.isNaN(checkOut.getTime()) ||
        checkOut <= checkIn
      ) {
        return sum;
      }
      return sum + (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
    }, 0),
  );

  const recordCount = timesheets.length;
  const lateEvents = timesheets.filter(
    (row) => Number(row.latenessMinutes || 0) > 0,
  ).length;
  const earlyEvents = timesheets.filter(
    (row) => Number(row.earlyLeaveMinutes || 0) > 0,
  ).length;
  const absenceEvents = timesheets.filter((row) => !row.actualCheckInAt).length;

  const totalLateMinutes = timesheets.reduce(
    (sum, row) => sum + Number(row.latenessMinutes || 0),
    0,
  );
  const totalEarlyMinutes = timesheets.reduce(
    (sum, row) => sum + Number(row.earlyLeaveMinutes || 0),
    0,
  );

  const punctualityPenalty =
    lateEvents * 6 +
    earlyEvents * 5 +
    absenceEvents * 12 +
    totalLateMinutes * 0.15 +
    totalEarlyMinutes * 0.12;

  const punctualityScore =
    recordCount > 0 ? clampScore(100 - punctualityPenalty, 75) : 75;

  const qualityScore = review ? clampScore(review.skillScore, 75) : 75;
  const managerBaseScore = review ? clampScore(review.managerRatingScore, 75) : 75;

  const compliancePenalty = correctionsCount * 7;
  const complianceScore = clampScore(100 - compliancePenalty, 75);

  const hasPerformanceActivity =
    scheduledMinutes > 0 ||
    actualWorkedMinutes > 0 ||
    recordCount > 0 ||
    orderCount > 0 ||
    Boolean(review) ||
    correctionsCount > 0;
  const insufficientData = !hasPerformanceActivity;

  const productivityScore = insufficientData
    ? 0
    : scheduledMinutes > 0
      ? clampScore((actualWorkedMinutes / scheduledMinutes) * 100, 0)
      : recordCount > 0
        ? 75
        : 0;

  const productivityNote = insufficientData
    ? "Không có dữ liệu làm việc trong kỳ."
    : scheduledMinutes > 0
      ? "Dựa trên tỷ lệ hoàn thành thời lượng ca được phân công trong kỳ; order chỉ dùng làm dữ liệu tham khảo."
      : "Có dữ liệu chấm công nhưng thiếu lịch phân ca, dùng điểm trung lập.";

  const components = {
    productivity: {
      score: productivityScore,
      weight: PERFORMANCE_WEIGHTS.productivity,
      note: productivityNote,
    },
    punctuality: {
      score: insufficientData ? 0 : punctualityScore,
      weight: PERFORMANCE_WEIGHTS.punctuality,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : "Dựa trên đi trễ, về sớm, vắng mặt và tổng số phút vi phạm.",
    },
    quality: {
      score: insufficientData ? 0 : qualityScore,
      weight: PERFORMANCE_WEIGHTS.quality,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : review
          ? "Dựa trên điểm kỹ năng/chất lượng chuyên môn theo vai trò do quản lý nhập."
          : "Chưa có đánh giá quản lý, dùng điểm trung lập cho kỹ năng/chất lượng chuyên môn.",
    },
    managerReview: {
      score: insufficientData ? 0 : managerBaseScore,
      weight: PERFORMANCE_WEIGHTS.managerReview,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : review
          ? "Dựa trên điểm đánh giá tổng quan của quản lý trong kỳ."
          : "Chưa có đánh giá quản lý, dùng điểm trung lập.",
    },
    compliance: {
      score: insufficientData ? 0 : complianceScore,
      weight: PERFORMANCE_WEIGHTS.compliance,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : "Dựa trên số yêu cầu chỉnh công và mức độ tuân thủ quy trình.",
    },
  };

  const finalPerformanceScore = insufficientData
    ? 0
    : weightedFinalScore(components);

  const actorId = getActorId(ctx);

  const doc = await StaffPerformanceSnapshot.findOneAndUpdate(
    {
      employeeId,
      restaurantId,
      periodStart,
      periodEnd,
    },
    {
      $set: {
        ...components,
        finalPerformanceScore,
        performanceLevel: insufficientData
          ? "poor"
          : resolvePerformanceLevel(finalPerformanceScore),
        factors: {
          orderCount,
          peerMaxOrderCount: benchmark.maxOrders,
          shiftsCount,
          recordCount,
          lateEvents,
          earlyEvents,
          absenceEvents,
          totalLateMinutes,
          totalEarlyMinutes,
          correctionsCount,
          staffRate,
          staffRateCount,
          customerRatingScore,
          hasManagerReview: Boolean(review),
          scheduledMinutes,
          actualWorkedMinutes,
          productivitySource: "shift_completion",
          hasPerformanceActivity,
          insufficientData,
          kitchenMetrics,
        },
        generatedBy: actorId,
        generatedByName: getActorName(ctx),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .lean();

  return mapSnapshot(doc);
}

export async function upsertStaffPerformanceReview({ input, ctx }) {
  assertCanManagePerformance(ctx);

  const employeeId = toObjectId(input.employeeId);
  const restaurantId = toObjectId(input.restaurantId);

  if (!employeeId) throw new Error("employeeId không hợp lệ.");
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");

  const periodStart = toStartOfDay(input.periodStart);
  const periodEnd = toEndOfDay(input.periodEnd);

  if (periodEnd < periodStart) {
    throw new Error("Khoảng thời gian đánh giá không hợp lệ.");
  }

  const doc = await StaffPerformanceReview.findOneAndUpdate(
    {
      employeeId,
      restaurantId,
      periodStart,
      periodEnd,
    },
    {
      $set: {
        managerRatingScore: clampScore(input.managerRatingScore, 75),
        attitudeScore: clampScore(input.attitudeScore, 75),
        teamworkScore: clampScore(input.teamworkScore, 75),
        skillScore: clampScore(input.skillScore, 75),
        note: String(input.note || "").trim(),
        reviewedBy: getActorId(ctx),
        reviewedByName: getActorName(ctx),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate("employeeId", "fullName employeeCode")
    .lean();

  return mapReview(doc);
}

export async function recalculateStaffPerformanceSnapshots({ input, ctx }) {
  assertCanManagePerformance(ctx);

  const restaurantId = toObjectId(input.restaurantId);
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");

  const periodStart = toStartOfDay(input.periodStart);
  const periodEnd = toEndOfDay(input.periodEnd);

  if (periodEnd < periodStart) {
    throw new Error("Khoảng thời gian đánh giá không hợp lệ.");
  }

  const employeeId = toObjectId(input.employeeId);

  await markUnacceptedKitchenOrderWorkItems({
    restaurantId,
    now: periodEnd,
  });

  const staffFilter = {
    userType: "STAFF",
    deletedAt: null,
    $or: [
      { restaurantForStaff: restaurantId },
    ],
  };

  if (employeeId) {
    staffFilter._id = employeeId;
    delete staffFilter.$or;
  }

  const staffList = await Staff.find(staffFilter).select({ _id: 1 }).lean();

  const results = [];

  for (const staff of staffList) {
    const result = await calculateSnapshotForEmployee({
      employeeId: staff._id,
      restaurantId,
      periodStart,
      periodEnd,
      ctx,
    });

    results.push(result);
  }

  return results;
}

export async function listStaffPerformanceSnapshots({ filter = {}, ctx }) {
  const query = {};

  const restaurantId = toObjectId(filter.restaurantId);
  const employeeId = toObjectId(filter.employeeId);

  if (restaurantId) query.restaurantId = restaurantId;
  if (employeeId) query.employeeId = employeeId;

  if (filter.periodStart || filter.periodEnd) {
    query.periodStart = {};
    if (filter.periodStart)
      query.periodStart.$gte = toStartOfDay(filter.periodStart);
    if (filter.periodEnd) query.periodStart.$lte = toEndOfDay(filter.periodEnd);
  }

  if (employeeId) {
    assertCanViewPerformance(ctx, employeeId);
  }

  const rows = await StaffPerformanceSnapshot.find(query)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .sort({ periodEnd: -1, finalPerformanceScore: -1 })
    .limit(1000)
    .lean();

  return rows.map(mapSnapshot);
}

export async function getLatestStaffPerformanceSnapshot({
  employeeId,
  restaurantId,
  atDate,
}) {
  const eid = toObjectId(employeeId);
  const rid = toObjectId(restaurantId);

  if (!eid || !rid) return null;

  const date = atDate ? new Date(atDate) : new Date();

  const exact = await StaffPerformanceSnapshot.findOne({
    employeeId: eid,
    restaurantId: rid,
    periodStart: { $lte: date },
    periodEnd: { $gte: date },
  })
    .sort({ periodEnd: -1, createdAt: -1 })
    .lean();

  if (exact) return exact;

  return StaffPerformanceSnapshot.findOne({
    employeeId: eid,
    restaurantId: rid,
    periodEnd: { $lte: date },
  })
    .sort({ periodEnd: -1, createdAt: -1 })
    .lean();
}
